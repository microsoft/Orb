# electron-regedit
File associations, file icons &amp; open with... for electron apps

This module allows you to register your app in the windows registry, manipulate context menus & handle native open, edit, print, preview actions ect.

## Installation
```shell
npm install electron-regedit
```

## Usage
### Toy Example
As a short documentation, here is how the module is used:
```javascript
const {ProgId, ShellOption, Regedit} = require('electron-regedit')

new ProgId({
    description: 'My App File',
    icon: 'myicon.ico',
    extensions: ['myapp'],
    shell: [
        new ShellOption({verb: ShellOption.OPEN}),
        new ShellOption({verb: ShellOption.EDIT, args: ['--edit']}),
        new ShellOption({verb: ShellOption.PRINT, args: ['--print']})
    ]
})

Regedit.installAll()
```

### Squirrel integration
You will need to call ```Regedit.installAll()``` and ```Regedit.uninstallAll()``` when installing/uninstalling your application to clean up the registry. If you are using Squirrel there is a helping function to handle this. It is **very** important that all instantions of ```new ProgId({...})``` have been done **before** handling Squirrel events or installing/uninstalling into the registry.
```javascript
const {Regedit} = require('electron-regedit')

//... instantiate your ProgIds

if (Regedit.squirrelStartupEvent()) return

//... the rest of your application code
```

# Documentation
Please see the [wiki](https://github.com/Tympanix/electron-regedit/wiki) for detailed information
