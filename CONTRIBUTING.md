# Contributing to Orb
Welcome, and thank you for your interest in contributing to Orb! Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.microsoft.com..

When you submit a pull request, a CLA-bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., label, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

There are many ways in which you can contribute, beyond writing code. The goal of this document is to provide a high-level overview of how you can get involved.

## Reporting Issues

Have you identified a reproducible problem in Orb? Have a feature request? We want to hear about it! Submit your feature requests [here](https://github.com/microsoft/Orb/issues).

## Code Contribution

## Get Started
### Prerequisites

#### Install node.js v8.15.0
https://nodejs.org/dist/v8.15.0/

#### Install typescript & tslint

```
npm uninstall -g typescript
npm install -g tslint typescript@2.5.3
```
#### Install VSCode (Optional)
https://code.visualstudio.com/Download

### Clone repository
Open cmd:
```
cd *yourWorkingDir*
git clone https://github.com/microsoft/Orb.git
```

### Compiling
To enable ts compile on save, in VSCode, open directory: *yourWorkingDir*/Orb, press Ctrl+Shift+B once. The watcher task will auto compile on any ts file modifications. This will only complie ts to js. Most of cases if your change is only within ts/tsx, you don't need to run the full build.   


### Build
Orb has dependencis on node modules which needs precompiling with electron (Native Dependencies) and .dll (Edge Depdencies) for invoking [edge](https://github.com/kexplo/electron-edge) commands. Hence, in addition to compiling ts, full build take care of precompiling Native Dependencies, Edge Depdencies, and etc. More information available on Orb/build/gulpfiles.js

```
cd *yourWorkingDir*\Orb
npm install
build.cmd
```

### Run
```
cd *yourWorkingDir*\Orb\dist
Orb.exe
```

### Debugging
Once you've launched orb. To bring up the chrome dev tools, use Ctrl+Shift+D. You can hit Shift+F5 in the debug tools to refresh without restarting after ts/tsx code changes. You can "disable cache (while DevTools is open)" and hitting Shift+F5 in the debugger reloads the app without restarting.

### Unit Tests
Orb uses many popular JS frameworks for unit testing.

> <a href = "http://airbnb.io/enzyme/" target="_blank">enzyme</a> testing utility for react component testing.

> <a href = "http://chaijs.com/" target="_blank">chai</a> assertion library for Node and browsers.

> <a href = "https://mochajs.org/" target="_blank">mocha</a> test frameworks running on Node and browsers.

> <a href = "https://sinonjs.org/" target="_blank">sinon</a> standalone test spies, stubs and mocks for JavaScript.

> <a href = "https://electron.atom.io/spectron/" target="_blank">spectron</a> test Electron apps using ChromeDriver and WebdriverIO.

To run tests, simply run below command under Orb/dist/resources/app.

```
npm test
```
This will run "mocha test/test*.js".

Note testing files should be placed under Orb/dist/resources/app/test, and the name of any runnable testing files must start with "test".

Running tests is also part of build (YAML) pipeline, make sure tests are passed before submitting PR.


### Logging
loglevel replaces console.log() and friends with level-based logging and filtering, with none of console's downsides.

Usage:
```
  let log = require('loglevel');
  log.info("unreasonably simple");
```

5 actual logging methods, ordered and available as:
```
  log.trace(msg)
  log.debug(msg)
  log.info(msg)
  log.warn(msg)
  log.error(msg)
```
Documentation - https://github.com/pimterry/loglevel

Enable production logging for main process.

Orb.exe --enable-logging


### Notifications
Notifications are configured by notification.config.json under OrbModels.
File path: %appdata%\Orb\OrbModels\src\ProtectedModels\notification.config.json

Example:
```
{
    "name": "notification",
    "endTimeUtc": "2018-2-15T00:00:00.685Z",
    "owner": "microsoft",
    "message": "Welcome to Orb",
    "on": true,
    "showIntervalInMinutes": 0,
    "autoHideDurationInSeconds": 10,
    "action": {
        "label": "Welcome!",
        "url": "https://github.com/microsoft/Orb"
    }
}
```
To apply your notification change, simply push models to remote.

### Orb Settings
Orb allows you to change a setting by modifying orb.config.json.
File path: %appdata%\Orb\OrbModels\src\ProtectedModels\orb.config.json

```
{
    "name": "orb",
    "settings": {
        "enableProtectedResourceValidation": {
            "owner": "microsoft",
            "value": {
                "dev": false,
                "insiders": false,
                "production": false
            }
        }
    }
}
```
To consume your setting in Orb:

```
 ModelReader.getOrbSetting("SettingName").then((value) => {

 }
```

### Native dependencies
These modules are native code compiled against a specific version of Node. To install and use native node modules:

```
cd *yourWorkingDir*\Orb\node_modules_native
npm install
cd ..
build.cmd
```

### More Info
[Help Page](dist/resources/app/documentation/all.md)
