//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------
// Custom Edgejs integration for PowerShell
//

using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Globalization;
using System.Management.Automation;
using System.Management.Automation.Host;
using System.Security;
using System.Text;
using System.Threading.Tasks;

namespace Orb
{

    using System;

    public class PSEdgeHostUI : PSHostUserInterface
    {
        class EdgePromptInput
        {
            public string Message { get; set; }

            public string Caption { get; set; }

            public List<EdgeFieldDescription> FieldDescriptions { get; set; }
        }
        

        class EdgeFieldDescription
        {
            public string Name { get; set; }

            public string Type { get; set; }

            public bool IsArray { get; set; }

            public bool IsSecureString { get; set; }
        }

        private readonly PSHostRawUserInterface rawUi;
        private readonly Func<object, Task<object>> promptHandler;

        public PSEdgeHostUI(
            PSHostRawUserInterface rawUi,
            Func<object, Task<object>> promptHandler)
        {
            if (rawUi == null)
            {
                throw new ArgumentNullException("rawUi");
            }
            if (promptHandler == null)
            {
                throw new ArgumentNullException("promptHandler");
            }

            this.rawUi = rawUi;
            this.promptHandler = promptHandler;
        }

        public override string ReadLine()
        {
            //Console.WriteLine("HostUI:ReadLine");
            throw new NotImplementedException();
        }

        public override SecureString ReadLineAsSecureString()
        {
            //Console.WriteLine("HostUI:ReadLineSecu");
            throw new NotImplementedException();
        }

        public override void Write(string value)
        {
            //Console.WriteLine("HostUI:Write " + value);
        }

        public override void Write(ConsoleColor foregroundColor, ConsoleColor backgroundColor, string value)
        {
            //Console.WriteLine("HostUI:WriteColor " + value);
        }

        public override void WriteLine(string value)
        {
            //Console.WriteLine("HostUI:WriteLine " + value);
        }

        public override void WriteErrorLine(string value)
        {
            //Console.WriteLine("HostUI:WriteErrorLine " + value);

        }

        public override void WriteDebugLine(string message)
        {
            //Console.WriteLine("HostUI:WriteDebugLine " + message);
        }

        public override void WriteProgress(long sourceId, ProgressRecord record)
        {
            //Console.WriteLine("HostUI:WriteProgress ");
        }

        public override void WriteVerboseLine(string message)
        {
            //Console.WriteLine("HostUI:Verbose " + message);
        }

        public override void WriteWarningLine(string message)
        {
            //Console.WriteLine("HostUI:Warning " + message);
        }

        public override Dictionary<string, PSObject> Prompt(string caption, string message, Collection<FieldDescription> descriptions)
        {
            // Maintain the list of all secure strings. These will have to be converted later.
            var secureStrings = new HashSet<string>();

            var promptInput = new EdgePromptInput()
            {
                Caption = caption,
                Message = message,
                FieldDescriptions = new List<EdgeFieldDescription>()
            };

            var result = new Dictionary<string, PSObject>();

            for(int i = 0; i < descriptions.Count; i++)
            {
                // Handle credential types. Add a dummy result for these fields without prompting the user in this call.
                // The PS engine will later call one of the PromptForCredentials callbacks.
                if (descriptions[i].ParameterTypeFullName.Equals("System.Management.Automation.PSCredential", StringComparison.OrdinalIgnoreCase))
                {
                    result[descriptions[i].Name] = "";
                    continue;
                }

                var isSecureString = descriptions[i].ParameterTypeFullName.Contains("System.Security.SecureString");

                promptInput.FieldDescriptions.Add(new EdgeFieldDescription()
                    {
                        Name = descriptions[i].Name,
                        Type = descriptions[i].ParameterTypeName,
                        IsArray = descriptions[i].ParameterTypeName.EndsWith("[]"), // TODO: This approach is fast, but may not work for arrays containing generics.
                        IsSecureString = isSecureString
                    });

                if (isSecureString)
                {
                    secureStrings.Add((descriptions[i].Name));
                }
            }

            if (promptInput.FieldDescriptions.Count > 0)
            {
                var output = this.promptHandler(promptInput).Result;

                var outputDict = (IDictionary<string, object>) output;

                foreach (var entry in (object[]) outputDict["Results"])
                {
                    var entryDict = (IDictionary<string, object>) entry;

                    var fieldName = (string) entryDict["Name"];
                    var fieldValue = entryDict["Value"];

                    if (secureStrings.Contains(fieldName))
                    {
                        var singleStr = fieldValue as string;
                        if (singleStr != null)
                        {
                            fieldValue = ToSecureString(singleStr);
                        }

                        var arrayStr = fieldValue as object[];
                        if (arrayStr != null)
                        {
                            fieldValue = new SecureString[arrayStr.Length];
                            for (int i = 0; i < arrayStr.Length; i++)
                            {
                                ((SecureString[])fieldValue)[i] = ToSecureString((string)arrayStr[i]);
                            }
                        }
                    }

                    result[fieldName] = PSObject.AsPSObject(fieldValue);
                }

            }

            return result;
        }

        private static SecureString ToSecureString(string input)
        {
            var result = new SecureString();
            foreach (char c in input)
            {
                result.AppendChar(c);
            }

            return result;
        }

        public override PSCredential PromptForCredential(string caption, string message, string userName, string targetName)
        {
            return PromptForCredential(caption, message, userName, targetName, PSCredentialTypes.Default, PSCredentialUIOptions.Default);
        }

        public override PSCredential PromptForCredential(string caption, string message, string userName, string targetName,
            PSCredentialTypes allowedCredentialTypes, PSCredentialUIOptions options)
        {
            var promptInput = new EdgePromptInput()
            {
                Caption = caption,
                Message = message,
                FieldDescriptions = new List<EdgeFieldDescription>()
            };

            promptInput.FieldDescriptions.Add(new EdgeFieldDescription()
            {
                Name = "UserName",
                IsArray = false,
                IsSecureString = false,
                Type = "String"
            });

            promptInput.FieldDescriptions.Add(new EdgeFieldDescription()
            {
                Name = "Password",
                IsArray = false,
                IsSecureString = true,
                Type = "SecureString"
            });

            var output = this.promptHandler(promptInput).Result;
            var outputDict = (IDictionary<string, object>) output;
            var user = string.Empty;
            var password = string.Empty;

            foreach (var entry in (object[]) outputDict["Results"])
            {
                var entryDict = (IDictionary<string, object>) entry;

                if (entryDict["Name"].Equals("UserName"))
                {
                    user = (string) entryDict["Value"];
                }

                if(entryDict["Name"].Equals("Password"))
                {
                    password = (string)entryDict["Value"];
                }
            }

            return new PSCredential(user, ToSecureString(password));
        }

        /// <summary>
        /// Parse a string containing a hotkey character.
        /// Take a string of the form
        ///    Yes to &amp;all
        /// and returns a two-dimensional array split out as
        ///    "A", "Yes to all".
        /// </summary>
        /// <param name="input">The string to process</param>
        /// <returns>
        /// A two dimensional array containing the parsed components.
        /// </returns>
        private static string[] GetHotkeyAndLabel(string input)
        {
            string[] result = new string[] { String.Empty, String.Empty };
            string[] fragments = input.Split('&');
            if (fragments.Length == 2)
            {
                if (fragments[1].Length > 0)
                {
                    result[0] = fragments[1][0].ToString().
                    ToUpper(CultureInfo.CurrentCulture);
                }

                result[1] = (fragments[0] + fragments[1]).Trim();
            }
            else
            {
                result[1] = input;
            }

            return result;
        }

        /// <summary>
        /// This is a private worker function splits out the
        /// accelerator keys from the menu and builds a two
        /// dimentional array with the first access containing the
        /// accelerator and the second containing the label string
        /// with the &amp; removed.
        /// </summary>
        /// <param name="choices">The choice collection to process</param>
        /// <returns>
        /// A two dimensional array containing the accelerator characters
        /// and the cleaned-up labels</returns>
        private static string[,] BuildHotkeysAndPlainLabels(
             Collection<ChoiceDescription> choices)
        {
          // Allocate the result array
          string[,] hotkeysAndPlainLabels = new string[2, choices.Count];

          for (int i = 0; i < choices.Count; ++i)
          {
            string[] hotkeyAndLabel = GetHotkeyAndLabel(choices[i].Label);
            hotkeysAndPlainLabels[0, i] = hotkeyAndLabel[0];
            hotkeysAndPlainLabels[1, i] = hotkeyAndLabel[1];
          }

          return hotkeysAndPlainLabels;
        }

        public override int PromptForChoice(string caption, string message, Collection<ChoiceDescription> choices, int defaultChoice)
        {
            var promptInput = new EdgePromptInput()
            {
                Caption = caption,
                Message = message,
                FieldDescriptions = new List<EdgeFieldDescription>()
            };

            // Convert the choice collection into something that is
            // easier to work with. See the BuildHotkeysAndPlainLabels 
            // method for details.
            string[,] promptData = BuildHotkeysAndPlainLabels(choices);

            // Format the overall choice prompt string to display.
            StringBuilder sb = new StringBuilder();
            for (int element = 0; element < choices.Count; element++)
            {
                sb.Append(String.Format(
                                        CultureInfo.CurrentCulture,
                                        "[{0}] {1}  ",
                                        promptData[0, element],
                                        promptData[1, element]));
            }

            sb.Append(String.Format(
                                    CultureInfo.CurrentCulture,
                                    "(Default is [\"{0}\"])",
                                    promptData[0, defaultChoice]));

            promptInput.FieldDescriptions.Add(new EdgeFieldDescription()
            {
                Name = "Choice",
                IsArray = false,
                IsSecureString = false,
                Type = sb.ToString()
            });

            // Read prompts until a match is made, the default is
            // chosen, or the loop is interrupted with ctrl-C.
            while (true)
            {
                var output = this.promptHandler(promptInput).Result;
                var outputDict = (IDictionary<string, object>) output;
                var choice = string.Empty;

                foreach (var entry in (object[]) outputDict["Results"])
                {
                    var entryDict = (IDictionary<string, object>) entry;

                    if (entryDict["Name"].Equals("Choice"))
                    {
                        choice = (string) entryDict["Value"];
                    }
                }

                // If the choice string was empty, use the default selection.
                if (choice.Length == 0)
                {
                    return defaultChoice;
                }

                // See if the selection matched and return the
                // corresponding index if it did.
                for (int i = 0; i < choices.Count; i++)
                {
                    if (promptData[0, i].Equals(choice, StringComparison.CurrentCultureIgnoreCase) ||
                        promptData[1, i].Equals(choice, StringComparison.CurrentCultureIgnoreCase))
                    {
                        return i;
                    }
                }
            }
        }

        public override PSHostRawUserInterface RawUI
        {
            get { return rawUi; }
        }
    }

}
