# Updating Orb Models

* [Back to Help](all.md)
* [PowerShell Objects](powershellObjects.md)

>* You can Add/Remove/Update Objects and Namespaces in the Edit Page.

>* The fastest way to create a new namespace is to browse through existing examples and clone one.

>* To edit existing objects, you can also right-click on any Object in the Explorer Page and click Edit.

# Models Overview

Orb uses a git repository to store all object and resource definitions.

>* Orb automatically syncs with the Models git repository to continuously update definitions.

The Orb Models Repository is located [here.](https://msazure.visualstudio.com/DefaultCollection/One/_git/Azure-OrbModels)

You can explore your local git repository in the Edit page. You can also right-click folders and click 'Reveal in Explorer'.

>* Any changes made locally need to be explicitly pushed through Pull Requests in the *Changes* section.

## Public Models

Anything located under src\Models is considered Public. Public Model updates require no Code Reviews.

## Protected Models

Anything located under src\ProtectedModels is considered Protected. Protected Models require Code Reviews.

>* All PowerShell Object definitions and resources (psx, psmd, terminal, etc.) must be placed under the Protected Models folder.
>* Since Constants can be used by any definition, these have to be added to Protected Models.

# Namespaces

>* Namespaces are designed to be at the scope of a large organization and not individual teams.

Object trees can span namespaces if required.

## Creating a new Namespace

To create a namespace, you need to create a new folder and a namespaceconfig.json file.

You can pick one of the 3 directory layouts below.

### Fully Public Definition

>* This setup is recommended if you plan to use Kusto objects and non-PowerShell resources.

For example, to create a namespace "foo", this should be the folder structure.

<pre>
Models
|
foo
   |
   namespaceConfig.json
   |
   Objects
      |
      object1.json
</pre>

### Fully Protected Definition

If you want your entire namespace config to be only modifiable through code reviews, you can place it in the protected folder.

>* You can create owners.txt files at every folder to control Ownership Enforcer approvals.
>* This setup is recommended if you plan to only use PowerShell objects and resources.

<pre>
ProtectedModels
|
foo
   |
   owners.txt
   namespaceConfig.json
   |
   Objects
      |
      object1.json
</pre>

### Hybrid Definition (Most Flexible)

You can choose to split your config into multiple files and decide what portion goes through code reviews. Note that PowerShell related definition must always go in the protected folder.

>* This setup is recommended if you plan to use a combination of Kusto and PowerShell objects/resources.

<pre>
src
|
Models
 |
 foo
   |
   namespaceConfig.json
   |
   Objects
      |
      object1Hybrid.json
      object2FullyPublic.json
|
ProtectedModels
 |
 foo
   |
   owners.txt
   namespaceconfig.protected.json #Contains just the stuff that needs CRs
   |
   Objects
      |
      owners.txt
      object1Hybrid.protected.json #Contains just the stuff that needs CRs
      object3FullyProtected.json
</pre>


## NamespaceConfig.json

The namespaceConfig contains several resource profiles.

These resource profiles tell Orb about how to connect to key resources like Kusto, Dgrep, etc.

This allows individual resource definitions to share connection configuration.

Sample namespace config for Compute:

```json
{
    "name": "Compute",
    "requiredBaseProps": [
        {
            "name": "cloudType",
            "type": "enum",
            "label": "Environment",
            "value": [
                "Public",
                "Fairfax",
                "Mooncake",
                "Blackforest"
            ]
        }
    ],
    "resourceProfiles": [
        {
            "type": "kusto",
            "name": "ACMKusto",
            "clustersByCloudType": {
                "Public": "https://azurecm.kusto.windows.net",
                "Fairfax": "https://azurecmff.kusto.usgovcloudapi.net",
                "Mooncake": "https://azurecmmc.kusto.chinacloudapi.cn",
                "Blackforest": "https://azurecmbf.kusto.cloudapi.de"
            },
            "db": "AzureCM"
        },
        {
            "type": "dgrep",
            "name": "ACMDgrep",
            "endpointsByCloudType": {
                "Public": "Diagnostics PROD",
                "Mooncake": "CA Mooncake",
                "Fairfax": "CA Fairfax",
                "Blackforest": "CA Blackforest"
            }
        },
        {
            "type": "powershell",
            "name": "FcShell",
            "startupScript": ".(Join-Path $env:FcShellLatestRoot '\\FcShellBootstrap.ps1');"
        }
    ]
}
```

### requiredBaseProps

This is a set of properties that all objects in the namespace will inherit.

>* requiredBaseProps can be used to implement national clouds support

Currently, only enums are supported as requiredBaseProps. These enum choices are automatically displayed on the search page.

### National Clouds Support

If requiredBaseProps are setup for your namespace as shown in the example above, every object will automatically include the *cloudType* variable.

Kusto/Dgrep resources will be automatically converted to the endpoint defined for the given cloudType.

> Orb will automatically convert saved queries to Public endpoints if the underlying object is in a different cloudType.

# Objects

>* Objects are a collection of resources. These resources are organized as trees called Resource Trees.

## Create a new Object

Under the *Objects* folder for your namespace create a file *objectName*.json.

>* The object json file can be under any subdirectory of *Objects*.
>* An Object can be split into multiple files like *objectName*.file1.json, *objectName*.file2.json. However, *objectName*.json is always required.
>* Protected resources needing Code Reviews (all PowerShell snippets) need to be placed in the ProtectedModels folder. See the Namespace Section above for directory definition examples.

## Global Object json

Global objects do not have any object specific context and do not need any keys for lookups.

Sample global object json file:

```json
{
    "namespace": "Compute",
    "path": "Global\\Compute Manager",
    "resources": [
        {
            "type": "jarvis",
            "relativePath": "FC\\Global EKG",
            "description": "Global Compute VM, Node Availability",
            "link": "https://jarvis-west.dc.ad.msft.net/dashboard/AzureComputeManager/Fabricator/GlobalEKG"
        }
    ]
}
```

Resource definition details can be found in [this section](#resources)

## Object json

All objects need to specify a path. The path can contain subdirectories.

>* Ideally, the path specified should match the folder structure where the .json file is placed.

Sample object json file:

```json
{
    "namespace": "Compute",
    "path": "FC\\Tenant",
    "requiredProps": [
        "tenantName",
        "Tenant"
    ],
    "key": "tenantName",
    "displayName": "Compute: {tenantName}",
    "disablePathlessSearch": false,
    "constructor": {
        "type": "kusto",
        "connectionProfile": "ACMKusto",
        "query": "LogContainerSnapshot | where {timeRange} and tenantName == \"{tenantName}\" | take 1 | project tenantName, Tenant",
        "wildcardQuery": "LogContainerSnapshot | where {timeRange} and tenantName matches regex \"{tenantName}\" | summarize by tenantName, Tenant",
        "minimumResolutionInMinutes": 120,
        "searchHint": "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[0-9a-f]{8}[0-9a-f]{4}[1-5][0-9a-f]{3}[89ab][0-9a-f]{3}[0-9a-f]{12}"
    },
    "resources": [
        {
            "type": "dgrep",
            "relativePath": "DGrep\\TenantEvents",
            "connectionProfile": "ACMDgrep",
            "description": "",
            "link": "https://jarvis-west.dc.ad.msft.net/?page=logs&be=DGrep&time=2016-11-18T02:26:00.000Z&offset=~60&offsetUnit=Minutes&UTC=true&ep=Diagnostics%20PROD&ns=Fc&en=TMMgmtTenantEventsEtwTable&scopingConditions=[[\"Tenant\",\"{Tenant}\"]]&serverQuery=TenantName%20%3D%3D%20\"{tenantName}\"&aggregates=[\"Count%20by%20resultType\"]&chartEditorVisible=true&chartType=Line&chartLayers=[[\"New%20Layer\",\"\"]]%20"
        },
        {
            "type": "kusto",
            "relativePath": "Kusto\\TenantEvents",
            "connectionProfile": "ACMKusto",
            "description": "",
            "query": "TMMgmtTenantEventsEtwTable | where {timeRange} and TenantName == \"{tenantName}\" | project PreciseTimeStamp, Message "
        },
        {
            "type": "psmd",
            "relativePath": "FcShell\\Get-Fabric",
            "powershellProfile": "FcShell",
            "description": "",
            "script": "{gf}$f"
        }
    ],
    "additionalProps": [
        {
            "name": "gf",
            "type": "constant",
            "value": "$f = Get-FabricCached {Tenant};"
        }
    ],
    "associations": [
        {
            "type": "kusto",
            "relativePath": "Fabric",
            "associatedObjectPath": "FC\\Fabric",
            "description": "",
            "connectionProfile": "ACMKusto",
            "query": "LogContainerSnapshot | where {timeRange} and tenantName == \"{tenantName}\" | limit 1 | project Tenant",
            "minimumResolutionInMinutes": 120
        }
    ]
}
```

### requiredProps

This is a list of property names that are **required** to construct the object.
>* The requiredProps define the concrete instances of an object.
>* Keep this list to a minimum since every object Search and Association would need to provide all required Props to construct the object.

### key

This is a property from the requiredProps set that is required to search for this object. This is typically the object Id.

### disablePathlessSearch

This prevents the object from being searched when a path is not specified (either in the search pane or in IcM mode). This defaults to *false* if not defined.
Please use this if your constructor takes a long time to run or requires user input.

### displayName

This overrides the default Orb display name for the specified object. *requiredProps* and *requiredBaseProps* can be subsituted into the display name using the *{requiredProp}* syntax.

### hideFromSearch

This prevents the object from being searched in the search pane. Usefull when you want to make the object available only by associations. The object will be hidden from path and will never be searched. Even if the path is not specified and the `disablePathlessSearch` is set to `false`. The setting defaults to *false* if not defined.

### constructor

>* The constructor is a way to obtain all requiredProps for the object given a key.
>* It is primarily used in the Search view.
>* You can construct Objects using PowerShell or Kusto.

#### Kusto
>* The connection profile should be present in the namespaceConfig.json
>* A wildcard constructor needs to be provided to allow matching on regex inputs
>* Generally, your Kusto queries should end with *project requiredProp1, requireProp2 ...* or *summarize by requiredProp1, requireProp2 ...*

>#### minimumResolutionInMinutes
>
> The *minimumResolutionInMinutes* allows you to specify the minimum time range difference that must be present to run the query.

>* If you are using snapshots to construct objects, set the minimumResolutionInMinutes to at least 2x the snapshot frequency.
>
> For example, if you have an event that emits how many objects exist every 15 minutes, a query with a time range of 5 minutes may not yield any results.
>
> In this case, if you set the min resolution to 30 minutes, for object search to work, the time range in the Search View will automatically expand to be at least 30 minutes, making the search more meaningful.

#### PowerShell

To use Powershell to define objects, see [this](powershellObjects.md) section.

### searchHint

Regex pattern used to identify how to discover keys that might match the given object type.

For example, if your object keys are all of type guid, use the following searchHint.

```json
{
    "searchHint": "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"
}
```

> searchHint is required to enable suggested objects in IcM triage mode.

More details about IcM triage mode can be found [here.](icmIntegration.md)

### additionalProps
These are properties that are not required to create the object, but are additional properties on the object.

>* Minimize how many properties are present in requiredProps. More requiredProps makes adding associations to the object much harder.

#### C# Analogy

```csharp

public class MyObject
{
    public MyObject(string requiredProp1, string requiredProp2)
    {
        // This is your constructor. Any one needing to construct this object needs to pass 2 required props.
    }

    public AdditionalProp1
    {
        get
        {
            // This property can be inferred using the required props above.
            return someFunction(requiredProp1, requiredProp2).
        }
    }
}

```

#### constant additionalProps

This allows re-using code/text snippets in the object definition file.

> Constants can only be added under ProtectedModels and must go through Code Reviews. This is because they can be used in any resource, including PowerShell.

```json
{
    "additionalProps": [
        {
            "name": "gf",
            "type": "constant",
            "value": "$f = Get-FabricCached {Tenant};\n"
        }
    ]
}
```

#### Kusto additionalProps

Append your object with any number of properties from Kusto.

>* You can pull multiple properties from a single kusto query.

>* AdditionalProps can depend on other required/additional Props, as long as there are no circular dependencies.

```json
{
    "additionalProps": [
        {
            "name": ["Region", "DC"],
            "type": "kusto",
            "connectionProfile": "ACMKusto",
            "query": "LogClusterSnapshot | where {timeRange} and Region != \"\" and Tenant == \"{Tenant}\" | take 1 | project Region, DC=DataCenterName",
            "minimumResolutionInMinutes": 120
        }
    ]
}
```

Now you can use {Region} and {DC} in any resource definition.

#### PowerShell additionalProps

Append your object with a number of properties from PowerShell scripts.

>* You can pull multiple properties from a single PowerShell script.
>* AdditionalProps can depend on other required/additionalProps, as long as there are no circular dependencies.

```json
{
    "additionalProps": [
        {
        "name": [ "SLBTenantName" ],
        "type": "powershell",
        "powershellProfile": "SlbShell",
        "script": "$t = $null; $t = Get-TenantCached {Cluster} {deploymentId}; if(!$t){return};$lbsettings = $t.LoadBalancerSettings; $vip = $lbsettings[0].VirtualIP.ToString();$f = Get-Fabric {Cluster} -SetAsDefaultForSession; $slbTenantName = get-slbforvip -Vip $vip -Fabric $f; new-object psobject -property @{SLBTenantName=$slbTenantName}"
        }
    ]
}
```

# Resources

To add a resource to the object, append to the list of resources in object.json.

Every resource can substitute any *requiredProps* in the resource definition.

In addition to *requiredProps*, the following global variables are also available for substitution.

## Global context variables

Variable | Description
------------ | -------------
{startTime} | Start time in UTC that is selected on the Explorer/Search views.
{endTime} | End time in UTC that is selected on the Explorer/Search views.
{timeRange} | Kusto query snippet that can be used in a where clause to combine start/end times. Used in Kusto resources only.
{icmId} | IcM incident Id when using triage mode.

>* Not all resource group types need to use these variables.

>* Some resource handlers automatically inject these variables for you.

## Example of Contextualization

Contextualization is the process of making a generic resource definition a contrete one by replacing *requiredProps* values and global variables.

Sample resource definition:
<pre>
TMMgmtTenantEventsEtwTable | where {timeRange} and TenantName == {tenantName} and Tenant == {Tenant} | project PreciseTimeStamp, Message
</pre>

Let's say we have a concrete Tenant with *requiredProp* values.

```json
{
    "requiredProps": {
        "tenantName": "slb",
        "Tenant": "CH1StageApp01"
    }
}
```

Also, suppose the time range selected is the last 2 hours.

Output concrete resource:
<pre>
 TMMgmtTenantEventsEtwTable | where PreciseTimeStamp > ago(2h) and TenantName == "slb" and Tenant == "Ch1StageApp01" | project PreciseTimeStamp, Message
</pre>

Note all the variable substitutions that occurred above.

## Shared Resource Properties

All resource types share some properties. These are described below.

### type
The type of resource. This must be one of the supported resource types listed below.

### relativePath
The relative path for this resource in explorer. Resources can be organized under arbitrary directories.

### description
A detailed description of the resource.

### showInContextMenu
Setting this to true will show the resource in the right-click context menu instead of explorer.
The relativePath will be converted to sub-menus if it contains any directories.
For example, a relative path of *foo\bar\myResource* will be converted to a menu foo, and sub-menu bar as *foo->bar->myResource*.

### showInQuickActionMenu
Setting this to true will show this resource in the quick action menu when using the IcM triage mode.
More details can be found [here.](icmIntegration.md)

---

## Resource Types

### .link

This is the most basic resource type. It's a general purpose link.

Sample definition:

```json
{
    "type": "link",
    "relativePath": "myDir\\myObject",
    "description": "Sample resource link",
    "link": "https://www.foo.com/?objectId={requiredProp1}"
}
```

### .acis

This is a link to a Geneva Action (formerly Acis).

>* Click the link button and select the long link option.

* Replace any variables with property names from the object definition.

```json
{
    "type": "acis",
    "relativePath": "CRP\\Get Sub",
    "description": "",
    "link": "https://jarvis-west.dc.ad.msft.net/?page=actions&acisEndpoint=Public&extension=CRP&group=Subscription%20Operations&operationId=GetCRPSubscriptionDetails&operationName=Get%20Subscription%20Details%20(persistent%20data)&params={\"wellknownsubscriptionid\":\"{subscriptionId}\",\"smecrpregion\":\"WestUS\",\"smecrpsuffixparam\":\"/ResourceGroups\"}&actionEndpoint=Production&genevatraceguid=911f7cc0-a575-4bc9-b4c6-6b9f647d8259&startExecution=false"
}
```

### .jarvis

This is a link to Jarvis dashboards.

>* You can map requiredProps to jarvis dashboard overrides.

>* Time range does not need to be specified on the link. The resource handler automatically inserts the time range.

To get the jarvis link:

* If you need dashboard overrides replaced, make sure you add the override on the jarvis dashboard with any value.

* Click the share button to generate a link.

* Make sure you link to a saved dashboard and not a temporary one.

* Replace the override value with property names from requiredProps.

Sample definition:

```json
{
    "type": "jarvis",
    "relativePath": "Health\\Cluster EKG",
    "description": "VM and Node Availability Dashboard",
    "link": "https://jarvis-west.dc.ad.msft.net/dashboard/AzureComputeManager/Fabricator/ClusterEKG?overrides=[{%22query%22:%22//*[id=%27Tenant%27]%22,%22key%22:%22value%22,%22replacement%22:%22{Tenant}%22}]%20"
}
```

### .dgrep

This is a link to Dgrep searches. The resource handler automatically inserts the time range.

>* If a time range is present on the link, you do not need to modify the time range in any way.

To get the Dgrep link:

 * Click the share button.

 * Make sure you select the full query with absolute times.

 * Replace actual object values with requiredProps property names.

 * You can ignore all time range properties. These are automatically handled.

 >* Make sure you escape quotes using \ in the json definition.

Sample definition:

```json
{
    "type": "dgrep",
    "relativePath": "DGrep\\TenantEvents",
    "connectionProfile": "ACMDgrep",
    "description": "",
    "link": "https://jarvis-west.dc.ad.msft.net/?page=logs&be=DGrep&time=2016-11-18T02:26:00.000Z&offset=~60&offsetUnit=Minutes&UTC=true&ep=Diagnostics%20PROD&ns=Fc&en=TMMgmtTenantEventsEtwTable&scopingConditions=[[\"Tenant\",\"{Tenant}\"]]&serverQuery=TenantName%20%3D%3D%20\"{tenantName}\"&aggregates=[\"Count%20by%20resultType\"]&chartEditorVisible=true&chartType=Line&chartLayers=[[\"New%20Layer\",\"\"]]%20"
}
```


### .kusto

This is a kusto query definition.

Use the *{timeRange}* variable in a where clause in the query.

>* Do not hardcode time ranges (relative or absolute) in your query.

Sample definition:

```json
{
    "type": "kusto",
    "relativePath": "Kusto\\TenantEvents",
    "connectionProfile": "ACMKusto",
    "description": "",
    "query": "TMMgmtTenantEventsEtwTable | where {timeRange} and TenantName == {tenantName} and Tenant == {Tenant} | project PreciseTimeStamp, Message "
}
```

### .psx

Open any PowerShell script in an external window.

You can specify a PowerShell profile specified in namespaceconfig.json to preload modules for the script.

The profile can be left unspecified if no modules need to be preloaded explicitly.

>* Make sure to escape characters \ (as \\) and " (as \\")
> Must be in ProtectedModels.

```json
{
    "type": "psx",
    "relativePath": "Connect with FcShell",
    "powershellProfile": "FcShell",
    "description": "Open a new FcShell window and connect to the Fabric.",
    "script": "$f = gf {Tenant}",
    "showInContextMenu": "true"
}
```

### .terminal

Open an Orb powershell terminal and run the provided script. The schema is identical to psx resources.

> Must be in ProtectedModels.

### .psmd

Render any PowerShell script as markdown automatically.

You can specify a PowerShell profile specified in namespaceconfig.json to preload modules for the script.

The profile can be left unspecified if no modules need to be preloaded explicitly.

> Must be in ProtectedModels.

>* Only output, errors and warnings are rendered automatically.

>* Stdout (Write-Host, Write-Verbose) is not displayed.

>* Output format can be set to _auto_, _rawMarkdown_, or _objectExplorer_

>* Object explorer takes a script that returns a PowerShell object and renders the object in an explorable tree.

>* If you specify _objectExplorer_ as an output format, you can also specify _objectExplorerDepth_, which controls how many levels of the tree are initially expanded. If not specified, it expands the tree two levels down.

>* Make sure your scripts return outputs instead of writing to Stdout.

>* Make sure to escape characters \ (as \\) and " (as \\")

```json
{
    "type": "psmd",
    "relativePath": "Connect with FcShell",
    "powershellProfile": "FcShell",
    "description": "Open a new FcShell window and connect to the Fabric.",
    "script": "$f = gf {Tenant}",
    "options": {
        "outputFormat": "auto"
    }
}
```

#### options

The options field is optional.

The outputFormat can be set to *auto*, *objectExplorer* or *rawMarkdown*.

In *auto* the output is formatted automatically. This is the default setting.

If your powershell script output returns custom markdown, use *rawMarkdown*.
This turns off any auto formatting of the output and provides complete control to the PowerShell script to format the output section.
Errors and Warnings returned from the script will still be rendered automatically.

If your script returns a PowerShell object, use *objectExplorer* to enable interactive, tree-based views of the object. You can also
control the default display depth of the tree view using the *formatOptions* tag.

```json
{
    "type": "psmd",
    "relativePath": "ObjectExplorer",
    "powershellProfile": "demops",
    "description": "",
    "script": "$result = $employees|where-object{$_.name -notlike \"{name}*\"}; $result",
    "options": {
        "outputFormat": "objectExplorer",
        "formatOptions": {
            "displayDepth": 0,
            "parseDepth": 4
        }
    }
}
```

If you use the *objectExplorer*, the script you run has *|ConvertTo-JSON* appended to it to pass the data to Orb. To control the depth of the *ConvertTo-JSON* operation, specify the *parseDepth* tag.

### .heatmap

See [this](heatmaps.md) for more information.

# Associations

Object Resource Trees can be linked together using associations.

Kusto queries and PowerShell scripts are supported as associations at this point.

To add an association from *ObjectTypeA* to *ObjectTypeB*:

>* You need to provide a query that can produce all requiredProps of *ObjectTypeB*

In other words, you need to be able to construct objectB given context from objectA.

Sample definition:

```json
{
    "associations": [
        {
            "type": "kusto",
            "relativePath": "Fabric",
            "associatedObjectPath": "FC\\Fabric",
            "description": "",
            "connectionProfile": "ACMKusto",
            "query": "LogContainerSnapshot | where {timeRange} and tenantName == {tenantName} | limit 1 | project Tenant",
            "minimumResolutionInMinutes": 120
        }
    ]
}
```

In the above example a Tenant is associated with a Fabric.

For details on minimumResolutionInMinutes see the [constructor section](#constructor) above.

* [Back to Help](all.md)
* [Top](#updating-orb-models)