# Onboarding
Onboarding your organization to Orb only needs few steps.

Orb shipped with a sample Database provided by Azure Data Explorer (https://azure.microsoft.com/en-us/services/data-explorer/) and sample OrbModels hosted on [Azure Devops](https://azure.microsoft.com/en-us/services/devops/).

	Database connection URI: https://orbcluster.westus2.kusto.windows.net

	OrbModels: https://dev.azure.com/orbModels/_git/OrbModels

You can onboard your organization with your own Database, OrbModels and manage authentication:

[Create an Azure Data Explorer cluster and database](https://docs.microsoft.com/en-us/azure/data-explorer/create-cluster-database-portal)

[Create a project in Azure DevOps](https://docs.microsoft.com/en-us/azure/devops/organizations/projects/create-project?view=azure-devops)

Update Orb config to use your own OrbModels as below:
```
%AppData%\Orb\config.json
{
	"modelRepoDir": "C:\\Users\\xxx\\AppData\\Roaming\\Orb\\OrbModels",
	"remoteOrigin": "https://dev.azure.com/orbModels/_git/OrbModels", // Replaces remoteOrigin with your own models uri.
	"alwaysOpenInNewTab": true,
	"vstsBaseUri": "https://dev.azure.com/orbModels/_apis/git/repositories/d4136505-6729-4843-9213-84b700af567d", // [Replaces the Azure Devops API uri](https://docs.microsoft.com/en-us/rest/api/azure/devops/?view=azure-devops-rest-5.0)
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
}
```
