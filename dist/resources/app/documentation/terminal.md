# Terminal Management

Orb has an integrated terminal that can be configured to launch custom terminal resources.

To configure your terminal preferences, right-click on the terminal icon in the NavBar on the left, then select edit.

Any resource you define in the terminal config, will be available in the terminal right-click menu.

These resource definitions are identical to .terminal resource definitions and can reference shared profiles.

The launchParameters not available in the .terminal resource but can be used here to specify the startup switches of the powershell executable.

> You can select a default terminal resource to launch when you click the terminal icon.
> You can also customize "fontSize", "backgroundColor", "textColor" for each terminal type. The new config will be immediately effective when you open a new terminal.

## Sample Terminal Config

```
{
	"modelRepoDir": "C:\\Users\\xxx\\AppData\\Roaming\\Orb\\OrbModels",
	"remoteOrigin": "https://dev.azure.com/orbModels/_git/OrbModels",
	"alwaysOpenInNewTab": true,
	"vstsBaseUri": "https://dev.azure.com/orbModels/_apis/git/repositories/d4136505-6729-4843-9213-84b700af567d",
	"homePageUrl": "https://github.com/Microsoft/Orb",
	"terminalConfig": {
		"default": "PowerShell",
		"resources": [
			{
				"relativePath": "PowerShell",
				"namespace": "",
				"powershellProfile": "",
				"script": "",
				"style": {
					"fontSize": "15px",
					"backgroundColor": "rgb(57, 56, 62)",
					"textColor": "rgb(238,237,240)"
				}
			}
		]
	}
```

## Special Environment Variables

Orb Terminals have two special environment variables that can be used for special casing behavior.

* 1. OrbInstanceId - This is the unique ID for the Orb App Instance. See [File Format](fileFormat.md) for details.
* 2. OrbProcessPath - Full path to the current orb process which is hosting the terminal.
