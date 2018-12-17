# Folder Structure
```
src
|
package.json --> The top level package file is for installing dev/test node module dependencies.
   |
   node_modules --> This folder contains all the installed node modules for build dependencies like gulp/electron.
     |
   dist -> This folder contains all assets needed to run the app.
     |
     resources
       |
       app -> The folder where html/js/css etc need to be placed.
        |
        package.json --> This package file lists all distributable/test dependencies.
```

# Install typings.
Typings are required to transpile tsx/ts files to plain js.

Orb uses npm to install all typings. Sample command:

    npm install --save-dev @types/chai

# Building
To enable compile on save, in VSCode, run Ctrl+Shift+B once. The watcher task will auto compile on any *ts* file modifications.
For a local build, run build.cmd.
Official builds and releases are managed via Azure Pipelines.

# OS Support
Only Windows is supported as a build environment for now.

# Testing
Orb uses electron-mocha for testing.
https://github.com/jprichardson/electron-mocha

By default, most tests run in the renderer process.

To run all the tests, run 'npm test' in the root folder.