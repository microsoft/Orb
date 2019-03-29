//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------
// Custom Edgejs integration for PowerShell
//

using System.Globalization;
using System.Management.Automation.Host;

namespace Orb
{

    using System;

    public class PSEdgeHost : PSHost
    {
        private readonly CultureInfo _currentCulture = System.Threading.Thread.CurrentThread.CurrentCulture;

        private readonly CultureInfo _currentUiCulture = System.Threading.Thread.CurrentThread.CurrentUICulture;

        private readonly Guid _instanceId = Guid.NewGuid();

        private readonly string _name = "OrbPSHost";

        private readonly PSHostUserInterface _ui;

        private readonly Version _version = new Version(1,0);

        public PSEdgeHost(PSHostUserInterface ui)
        {
            this._ui = ui;
        }

        public override void SetShouldExit(int exitCode)
        {
        }

        public override void EnterNestedPrompt()
        {

        }

        public override void ExitNestedPrompt()
        {
        }

        public override void NotifyBeginApplication()
        {
        }

        public override void NotifyEndApplication()
        {
            
        }

        public override CultureInfo CurrentCulture
        {
            get { return _currentCulture; }
        }

        public override CultureInfo CurrentUICulture
        {
            get { return _currentUiCulture; }
        }

        public override Guid InstanceId
        {
            get { return _instanceId; }
        }

        public override string Name
        {
            get { return _name; }
        }

        public override PSHostUserInterface UI
        {
            get { return _ui; }
        }

        public override Version Version
        {
            get { return _version; }
        }
    }

}
