//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------
// Custom Edgejs integration for PowerShell
//

using System.Collections.Concurrent;
using System.Management.Automation.Runspaces;

namespace Orb
{

    using System;
    using System.Collections.Generic;
    using System.IO;
    using System.Linq;
    using System.Management.Automation;
    using System.Text;
    using System.Threading.Tasks;

    public class PSEdge
    {
        public class PSResult {
            public object Output {get;set;}
            public List<string> Errors {get;set;}
            public List<string> Warnings {get;set;}
        }


        private static ConcurrentDictionary<string, PowerShell> activePowerShells = new ConcurrentDictionary<string, PowerShell>();
        private static ConcurrentDictionary<string, RunspacePool> runspacePools = new ConcurrentDictionary<string, RunspacePool>();

        private const int MinRunspacesPerKey = 1;

        private const int MaxRunspacesPerKey = 1;

        public async Task<object> CreateRunspacePool(object input)
        {
            var inputDict = input as IDictionary<string, object>;
            if (inputDict == null)
            {
                throw new ArgumentException("input");
            }

            var runspaceKey = (string) inputDict["RunspaceKey"];
            var startupScript = (string) inputDict["StartupScript"];

            if (runspacePools.ContainsKey(runspaceKey))
            {
                throw new InvalidOperationException("Runspace already created with key" + runspaceKey);
            }

            if (string.IsNullOrEmpty(startupScript))
            {
                // Assign a dummy script if not provided.
                startupScript = "Out-Null";
            }

            var initialState = InitialSessionState.CreateDefault();

            var promptHandler = (Func<object, Task<object>>)inputDict["PromptHandler"];
            PSEdgeRawUI rawUI = new PSEdgeRawUI();
            PSEdgeHostUI hostUI = new PSEdgeHostUI(rawUI, promptHandler);

            PSEdgeHost host = new PSEdgeHost(hostUI);

            // inject the startup script in the runspace so it is invoked automatically.
            initialState.Variables.Add(
                new SessionStateVariableEntry("orbPrivate_RunspaceStartupScript", startupScript,"", ScopedItemOptions.AllScope));

            var runspace = RunspaceFactory.CreateRunspacePool(MinRunspacesPerKey, MaxRunspacesPerKey, initialState, host);

            await Task.Factory.FromAsync(runspace.BeginOpen, runspace.EndOpen, null);
            runspacePools[runspaceKey] = runspace;

            return true;
        }

        private static string ErrorRecordToString(ErrorRecord error)
        {
            StringBuilder sb = new StringBuilder(error.ToString());
            if (error.ScriptStackTrace != null)
            {
                sb.AppendLine("");
                sb.AppendLine(error.ScriptStackTrace);
            }
            if (error.Exception != null && error.Exception.StackTrace != null)
            {
                sb.AppendLine("");
                sb.AppendLine(error.Exception.StackTrace.ToString());
            }

            return sb.ToString();
        }

        ///
        /// Invoke a script and return a string.
        /// Automatically adds Out-String in the Cmdlet pipeline to ensure the end result is a string.
        /// The runspace key is used to select the runspace pool for the requests.
        /// The request Id is used to associate a request with an Id and is used for cancellation.
        ///
        public async Task<object> InvokeScriptAsString(object input)
        {
            var inputDict = input as IDictionary<string, object>;

            if (inputDict == null)
            {
                throw new ArgumentException("input");
            }

            string runspaceKey = inputDict["RunspaceKey"] as string;
            string requestId = inputDict["RequestId"] as string;
            string script = inputDict["Script"] as string;

            if (string.IsNullOrEmpty(runspaceKey))
            {
                Console.WriteLine("Null Runspace Key");
                throw new ArgumentNullException("runspaceKey");
            }

            if (string.IsNullOrEmpty(requestId))
            {
                Console.WriteLine("Null requestId");
                throw new ArgumentNullException("requestId");
            }

            RunspacePool rsPool;

            if (!runspacePools.TryGetValue(runspaceKey, out rsPool))
            {
                Console.WriteLine("Runspace pool not created.");
                throw new InvalidOperationException("Runspace pool not created for " + runspaceKey);
            }

            var powerShell = PowerShell.Create();
            powerShell.RunspacePool = rsPool;

            // Wrap the original startup script and inject it as a variable in the runspace.
            // This startup script is then automatically invoked when commands are later called.
            string wrappedStartupScript =
                @"if(!$orbPrivate_RunspaceInitialized){iex $orbPrivate_RunspaceStartupScript | Out-Null; $orbPrivate_RunspaceInitialized = $true};" + script;

            powerShell.AddScript(wrappedStartupScript);
            powerShell.AddCommand("Out-String");

            activePowerShells[requestId] = powerShell;

            var result = new PSResult();
            result.Output = string.Empty;
            result.Warnings = new List<string>();
            result.Errors = new List<string>();

            try
             {
                var output = await Task.Factory.FromAsync<PSDataCollection<PSObject>, PSInvocationSettings, PSDataCollection<PSObject>>(
                    powerShell.BeginInvoke,
                    powerShell.EndInvoke,
                    new PSDataCollection<PSObject>(),
                    new PSInvocationSettings(),
                    null,
                    TaskCreationOptions.None);

                foreach(var psObject in output){
                    result.Output += psObject.ToString().TrimEnd();
                }

                foreach (var errorRecord in powerShell.Streams.Error) {
                    result.Errors.Add(ErrorRecordToString(errorRecord));
                }

                foreach (var warning in powerShell.Streams.Warning) {
                    result.Warnings.Add(warning.ToString());
                }
            }
            catch(Exception e)
            {
                result.Errors.Add(e.ToString());
                Console.Write(e.ToString());
            }
            finally
            {
                PowerShell dummy = null;
                activePowerShells.TryRemove(requestId, out dummy);

                powerShell.Dispose();
            }

            return result;
        }

        public async Task<object> CancelInvoke(string requestId)
        {
            PowerShell ps = null;
            if (activePowerShells.TryGetValue(requestId, out ps))
            {
                await Task.Factory.FromAsync(
                    ps.BeginStop,
                    ps.EndStop,
                    null);

                PowerShell dummy;
                activePowerShells.TryRemove(requestId, out dummy);
                ps.Dispose();
                return true;
            }

            return Task.FromResult(false);
        }
    }

}
