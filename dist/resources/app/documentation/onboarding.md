# Onboarding

Onboarding to Orb requires the following steps:

* Onboard your Event Log Data to Azure Data Explorer (recommended). Alternatively, you can also use PowerShell to create an Object Heirarchy.
* Create an Azure DevOps Git repo (Free)
* Create your Object and resource definitions in the Git Repo.
* Modify Orb preferences to use your Git repo.

Orb ships with a sample ADX Database and model repo hosted on Azure Devops. You can use these as reference samples throughout the onboarding process.

	Sample ADX Cluster: https://orbcluster.westus2.kusto.windows.net

	Sample OrbModels Repo: https://dev.azure.com/orbModels/_git/OrbModels


## Onboarding to Azure Data Explorer

If you don't already have an Azure Data Explorer cluster setup, take a look at [this guide.](https://docs.microsoft.com/en-us/azure/data-explorer/create-cluster-database-portal)

Orb works best if you have snapshot events that your service emits that can help locate various objects. Some patterns of how to do this are shared in [this post.](https://techcommunity.microsoft.com/t5/Azure-Data-Explorer/Object-Modeling-in-Azure-Data-Explorer/m-p/740546)

If you'd like to model your entire object graph using PowerShell, you can skip ADX integration.

## Creating an Azure DevOps repo

You'll need a project in Azure DevOps if you don't already have one. Take a look at [this guide](https://docs.microsoft.com/en-us/azure/devops/organizations/projects/create-project?view=azure-devops) to get started. You can create a repo free of charge.

## Creating Object Definitions and Resources

You can use the [sample Orb Model](https://dev.azure.com/orbModels/_git/OrbModels) repo as a starting point.
For more details on all the object definition files take a look at the [Adding Objects and Resources page.](./models.md)
It is recommended that you also enforce code review enabledment on your repository, especially on the protected folder which hosts PowerShell scripts.

## Modifying your Orb preferences

By default Orb ships with config set to use the sample repo. You have to edit your local Orb preferences to use the new repo you created. All users in your organization will have to do the same one-time setup.

You need to include the *remoteOrigin* which points to the repo you created. The remoteOrigin URL is typically of this format:

```
https://dev.azure.com/<organization>/_git/<repo>
```

You also need to provide the *vstsBaseUrl*. To get this URL, first open up the following URL in a browser (the below URL is not what goes into the config).

```
https://dev.azure.com/<organization>/_apis/git/repositories
```

From the output of the above URL in the browser, find the id of the repository you'd like to use. The final URL that goes into the *vstsBaseUrl* will look like:

```
https://dev.azure.com/<organization>/_apis/git/repositories/<repoId>
```

The local user Orb config can be accessed from Edit->Preferences inside Orb.

```
%AppData%\Orb\config.json
{
	"modelRepoDir": "C:\\Users\\xxx\\AppData\\Roaming\\Orb\\OrbModels",
	"remoteOrigin": "https://dev.azure.com/orbModels/_git/OrbModels", // Replace with your own
	"alwaysOpenInNewTab": true,
	"vstsBaseUri": "https://dev.azure.com/orbModels/_apis/git/repositories/d4136505-6729-4843-9213-84b700af567d", // [Replace with your own
}
