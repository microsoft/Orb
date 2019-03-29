# Terminal Management

* [Back to Help](all.md)

Orb has an integrated terminal that can be configured to launch custom terminal resources.

> Orb Terminals allow searching through output using Ctrl+F.

To configure your terminal preferences, right-click on the terminal icon in the NavBar on the left, then select edit.

Any resource you define in the terminal config, will be available in the terminal right-click menu.

These resource definitions are identical to .terminal resource definitions and can reference shared profiles.

The launchParameters not available in the .terminal resource but can be used here to specify the startup switches of the powershell executable.

> You can select a default terminal resource to launch when you click the terminal icon.
> You can also customize "fontSize", "backgroundColor", "textColor" for each terminal type. The new config will be immediately effective when you open a new terminal.

## Sample Terminal Config

<objectExplorer>
{
	"modelRepoDir": "C:\\Users\\gajagt\\AppData\\Roaming\\OrbInsiders\\OrbModels",
	"remoteOrigin": "https://msazure.visualstudio.com/One/_git/Azure-OrbModels/",
	"terminalConfig": {
		"default": "FcShell\\Full",
		"resources": [
			{
				"relativePath": "PowerShell",
				"namespace": "",
				"powershellProfile": "",
				"script": "",
				"launchParameters": "-NoLogo",
				"style": {
					"fontSize": "100px",
					"backgroundColor": "rgb(57, 56, 62)",
					"textColor": "rgb(238,237,240)"
				}
			},
			{
				"relativePath": "FcShell\\Constrained",
				"namespace": "Compute",
				"powershellProfile": "FcShell",
				"script": "",
				"launchParameters": "-NoLogo -NoProfie",
				"style": {
					"fontSize": "100px",
					"backgroundColor": "rgb(57, 56, 62)",
					"textColor": "rgb(238,237,240)"
				}
			},
			{
				"relativePath": "FcShell\\Full",
				"namespace": "Compute",
				"powershellProfile": "FcShellFull",
				"script": "",
				"style": {
					"fontSize": "100px",
					"backgroundColor": "rgb(57, 56, 62)",
					"textColor": "rgb(238,237,240)"
				}
			}
		]
	}
}
</objectExplorer>

## Special Environment Variables

Orb Terminals have two special environment variables that can be used for special casing behavior.

* 1. OrbInstanceId - This is the unique ID for the Orb App Instance. See [File Format](fileFormat.md) for details.
* 2. OrbProcessPath - Full path to the current orb process which is hosting the terminal.

* [Back to Help](all.md)
* [Top](#terminal-management)