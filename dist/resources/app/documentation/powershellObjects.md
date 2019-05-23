# PowerShell-Defined Objects and Attributes

* [Back to Help](all.md)

## The Basics
As with any non-global object, there are a few required keys in the configuration JSON.

```
{
    "namespace": "Demo",
    "path": "PowerShell\\Employee",
    "requiredProps": [
        "name",
        "level"
    ],
    "key": "name",
    "constructor": {
        "type": "powershell",
        "powershellProfile": "demops",
        "script": "$result = $employees|where-object{$_.name -like \"{name}*\"}; $result"
    },
    "resources": [
        {
            "type": "link",
            "link": "https://www.bing.com/search?q={name}",
            "description": "Bing Search for Employee",
            "relativePath": "BingSearch"
        }
    ]
}
```

In the case of a PowerShell-defined object, the _namespace_, _path_, _key_, and _requiredProps_ are exactly the same. Where things differ is the _constructor_ key.

### Constructor

#### Type
In the above example, the _type_ is defined as "__powershell__". This lets Orb know that it needs to run PowerShell to get the object.

#### PowerShell Profile
The _powershellProfile_ key lets Orb know which scripts it needs to run _before_ running the script. These are definied in the _namespaceConfig.json_ file. This field is optional, and if left blank, the script will run in a fresh PowerShell instance.

#### Script
This is run when Orb wants to create the object you're defining. The script needs to be able to accept regular expression input as well as raw text. This input is subsituted in at runtime in areas that include the text  ```{key}```. In the above example, the value ```{name}``` is substituted with either search text or an explicitly defined _name_.

> The expected output is an array of PowerShell objects with the properties definied in _requiredProps_.

## Additional Properties
Another way to add PowerShell data to existing Orb objects is to add a PowerShell additional property.

```
{
    "additionalProps": [
        {
            "name": ["FavoriteNumber", "SecondFavoriteNumber"],
            "type": "powershell",
            "powershellProfile": "demops",
            "script": "New-Object -TypeName PSObject -Prop (@{'FavoriteNumber'=Get-Random; 'SecondFavoriteNumber'=Get-Random})"
        }
    ]
}
```

For PowerShell-defined properties, there are four possible entries into the definition JSON:
> _name_, _type_, _powershellProfile_, and _script_

### Name
This is defined as an array of property names. In the case of the above example, the model is telling Orb that it should expect to get the _FavoriteNumber_ and _SecondFavoriteNumber_ properties from this script.

### Type
In the above example, the _type_ is defined as "__powershell__". This lets Orb know that it needs to run PowerShell to get the properties.

### PowerShell Profile
The _powershellProfile_ key lets Orb know which scripts it needs to run _before_ running the script. These are definied in the _namespaceConfig.json_ file. This field is optional, and if left blank, the script will run in a fresh PowerShell instance.

### Script
This is run when Orb wants to fetch the properties. All _requiredProps_, _baseRequiredProps_, and other _additionalProps_ (as long as there are no circular dependencies) can be substituted using the ```{value}``` format.

> The expected output is a PowerShell object with each of the properties defined in the _name_ key.

## PowerShell Associated Objects
The last way to add PowerShell data to objects is to define an association. In essence, associated objects are objects that can be fetched using an object's _requiredProps_, _baseRequiredProps_, and _additionalProps_.

```
{
    "associations": [
        {
            "type": "powershell",
            "relativePath": "Coworkers",
            "associatedObjectPath": "Powershell\\Employee",
            "powershellProfile": "demops",
            "script": "$result = $employees|where-object{$_.name -notlike \"{name}*\"}; $result"
        }
    ]
}
```

### Type
In the above example, the _type_ is defined as "__powershell__". This lets Orb know that it needs to run PowerShell to get the associated objects.

### Relative Path
The relative path defines where the associated objects should be located in the object's hierarchy.

### Associated Object Path
This tells Orb where the associated object is defined. Associated objects need to be located in the same namespace as the root object.

### PowerShell Profile
The _powershellProfile_ key lets Orb know which scripts it needs to run _before_ running the script. These are definied in the _namespaceConfig.json_ file. This field is optional, and if left blank, the script will run in a fresh PowerShell instance.

### Script
This is run when Orb wants to fetch the properties. All _requiredProps_, _baseRequiredProps_, and other _additionalProps_ can be substituted using the ```{value}``` format.

> The expected output is an array of PowerShell objects with the properties definied in the associated object's _requiredProps_.

## Live Demo
Under the _Demo_ namespace, you can search through a simple live demonstration of PowerShell-defined objects, properties, and associations.

## Quirks
* Because objects are created using PowerShell, be cognizant of the time it takes to run a script and its preceeding profile. If the script takes a long time to load and run, searches will take a long time to run.
* Each PowerShell script has *|ConvertTo-JSON* appended to it to pass the data to Orb. If your object has a
deep level of nesting, this command can take a long amount of time. Consider controlling the depth of your returned object like below:

```powershell
Get-Process | ConvertTo-Json -Depth 1 | ConvertFrom-Json
```
