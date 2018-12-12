//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------
/// <reference path="./typings/index.d.ts" />

import { app, BrowserWindow } from 'electron';

if (require('electron-squirrel-startup')) { app.quit(); }

let mainWindow: BrowserWindow;

let createWindow = () => {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 800, height: 600
    });
    //mainWindow.maximize();

    mainWindow.loadFile('index.html');
    //mainWindow.toggleDevTools();

}

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow();
    }
});

app.on('ready', createWindow)

