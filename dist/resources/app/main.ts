//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------
/// <reference path="./typings/index.d.ts" />

import { app, BrowserWindow } from 'electron';

if (require('electron-squirrel-startup')) { app.quit(); }

const path = require('path');
const fs = require('fs');
const cp = require('child_process');

let mainWindow: BrowserWindow;
let updateInterval: any;

let createWindow = () => {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 800, height: 600
    });
    //mainWindow.maximize();

    mainWindow.loadFile('index.html');
    //mainWindow.toggleDevTools();

    updateInterval = setInterval(() => checkForUpdate(), 60 * 60 * 1000);

    setTimeout(() => {
        // Check for updates 2 minutes after launching Orb.
        // Updates can impact startup perf slightly, hence a 2 minute delay.
        checkForUpdate();
    }, 5 * 60 * 1000);
}

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow();
    }
});

app.on('ready', createWindow)

let checkForUpdate = () => {

    // Orb uses squirrel for managing updates.
    // Call update.exe (squirrel) and try upgrading orb.
    let dirName = path.dirname(process.execPath);

    let autoUpdateFilePath =
        path.resolve(dirName, 'autoUpdatePath.txt');

    fs.readFile(autoUpdateFilePath, 'utf8', (err, updatePath) => {
        if (err) {

        } else {
            let updateDotExe =
                path.resolve(dirName, '..', 'update.exe');
            // Use fs.stat to check for the file existence.
            fs.stat(updateDotExe, (err, stat) => {
                if (err) {
                    console.warn(err);
                } else {
                    let args = ['--update', updatePath];

                    let child = cp.spawn(updateDotExe, args, { detached: true });

                    child.on('close', (code) => {
                        console.log("Checking for updates terminated with exit code %d", code);
                    });
                }
            });
        }
    })



}
