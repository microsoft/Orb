# File Format

Orb allows you to save all state to a file and share that with others.

Orb also supports share by link.See [Link Support](linkSupport.md) for more details.

You can also create custom Orb files based on the file format described below.

> You can pin files in the Orb jump list on Windows to get to your data faster.

## Sample Orb File

The below file opens up the Version Summary resource defined in Global\ComputeManager.
```
{
    "instance": "new",
    "searchNamespace": "OrbSample",
    "explorerTrees": [
        {
            "objectId": "OrbSample\\Compute\\VM\\df9df236-22fe-4d84-8c6b-42c6d63704e1",
            "namespace": "OrbSample",
            "objectPath": "Compute\\VM",
            "requiredProps": {
                "VMId": "df9df236-22fe-4d84-8c6b-42c6d63704e1"
            }
        }
    ],
    "openTabs": [
        {
            "type": "explorerResource",
            "objectId": "OrbSample\\Compute\\VM\\df9df236-22fe-4d84-8c6b-42c6d63704e1",
            "relativePath": "Events\\VM Events (Kusto Example).kusto"
        }
    ],
    "explorerTime": {
        "type": "relative",
        "ago": "30d"
    }
}
```

### instance

This field controls launch behavior. Three launch modes are available:

* 1. 'new' - Launch a new instance of Orb and apply state. If no instance is specified, this mode is selected.
* 2. 'default' - Launch a new instance only if there is no running instance. Otherwise *append* state to the first opened Orb instance (the default instance).
* 3. {Guid} - Append state to a specific instance provided by the Guid. This is useful for terminal interaction purposes. See example below.

### explorerTrees

An array of trees that should be added to the explorer page. Each tree requires the Object namespace, path and all required props.

*objectId* is used to identify the tree for which tabs are opened in the openTabs sections

### explorerTime

Start time/End time/TimeAgo for the explorer page to use. Both absolute time and relative time are supported at this point.

absolute time example:

```
{
    "explorerTime": {
        "type": "absolute",
        "startTime": "Thu, 13 Apr 2017 05:38:34 GMT",
        "endTime": "Fri, 14 Apr 2017 05:38:34 GMT"
    }
}
```

relative time example:

```
{
    "explorerTime": {
        "type": "relative",
        "ago": "1h"
    }
}
```

### openTabs

An array of tabs to open. Three tab types are possible.

* 1. *explorerResource* - Every explorer resource needs a *type*, *objectId* and *relativePath*.
* 2. *link* - This can be any arbitrary link. Just the *type* and *link* fields are required.
* 3. *localTerminal* - Open a locally defined terminal. Just the *type* and *relativePath* fields are required. Look at [Terminal Management](terminal.md) for details.

## Other Examples

### Open a User-Defined Terminal

Launch 'UserDefinedPowerShellResourceProfile' in the default Orb instance.

```
{
    "instance":"Default",
    "openTabs": [
            {
                "type": "localTerminal",
                "relativePath": "UserDefinedPowerShellResourceProfile"
            }
    ]
}
```

### Open Web Links

Launch bing.com in a new Orb instance.

```
{
    "instance":"Default",
    "openTabs":[
            {
            "type": "link",
            "relativePath": "https://www.bing.com"
        }
    ]
}
```

### Terminal Interaction and Automation

The Guid instance launch mode allows you to target a specific orb instance.

This behavior can be used to create interactions between the Orb powershell terminal and the rest of Orb.

The example PowerShell script below demonstrates taking an object in the Orb powershell terminal and adding it to the Orb explorer.

The special [environment variables](terminal.md) injected into Orb terminals are used to create this interaction.

```powershell
function Add-ToOrb {
    <#
    .SYNOPSIS
    Adds an powershell object to the Orb explorer.

    .EXAMPLE
    C:\PS> $o | Add-ToOrb;
    #>

    [CmdletBinding()]
    param (
        [Parameter(Mandatory = $true, ValueFromPipeline = $true)]
        [ValidateNotNullOrEmpty()]
        [object[]]$Object,
        [Parameter()]
        [ValidateNotNullOrEmpty()]
        [string[]]$OpenTabs)

    Begin {
        if (!$env:OrbInstanceId -or $env:OrbInstanceId -eq "") {
            throw "Not running in an Orb terminal."
        }
        $explorerJson = "";
        $resourceString = ', "openTabs":[';
    }

    Process {
        $orbFileTemplate = '{{"instance":"{0}","explorerTrees":[{1}]{2}}}';
        $resourceTemplate = '{{"type":"explorerResource", "objectId":"{0}", "relativePath":"{1}"}},';

        foreach ($o in $Object) {
            $treeTemplate = '{{"namespace":"OrbSample","objectPath":"{0}","requiredProps":{1},"objectId":"{2}"}}';

            $type = ($o | gm |? {$_.Name -eq "GetType"}).TypeName
            $treeJson = "";
            $objectId = "";

            switch ($type) {
                {$_ -eq "Orb.VM"} {
                    $requiredProps = '{{"VMId":"{0}"}}' -f $o.Id;
                    $objectId = "OrbSample\\Compute\\VM\\$($o.Id)";
                    $treeJson = $treeTemplate -f "Compute\\VM", $requiredProps, $objectId
                    break;
                }
            }

            if ($treeJson -eq "") {
                throw "Could not add provided object to orb. Make sure the provided object type is supported.";
            }
            else {
                $explorerJson += ($treeJson + ",");
            }

            if ($OpenTabs -and $OpenTabs.Length -gt 0 -and $objectId -ne "") {

                $OpenTabs | % {
                    $resourceString += ($resourceTemplate -f $objectId, $_.Replace("\", "\\"))
                }
            }
        }
    }
    End {

        # remove the last ","
        $explorerJson = $explorerJson -replace ".$"

        if ($OpenTabs -and $OpenTabs.Length -gt 0 -and $objectId -ne "") {

            # remove the last ","
            $resourceString = $resourceString -replace ".$";

        }

        $resourceString += "]";
        $json = $orbFileTemplate -f $env:OrbInstanceId, $explorerJson, $resourceString
        Write-Verbose $json
        $name = [guid]::NewGuid();
        $dest = Join-Path $env:TEMP "\$name.orb"
        $json | sc -Path $dest -Force
        $dummy = "dummy";
        Start-Process $env:OrbProcessPath -ArgumentList $dest -RedirectStandardOutput $dummy;
    }
}
```
