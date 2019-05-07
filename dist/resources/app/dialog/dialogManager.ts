//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />
/// <reference path="./dialog.d.ts" />

import { remote, ipcRenderer } from 'electron';
import * as Promise from 'bluebird';
let log = require('loglevel');

export class DialogManager {

    private static dialogHtml = remote.app.getAppPath() + "/dialog/dialog.html";
    private static isInitialized = false;
    private static promiseId = 0;
    private static promiseCache: { [key: number]: any } = {};

    private static initialize() {
        if (!DialogManager.isInitialized) {
            // main.js proxies dialog-output messages back to the this window process.
            ipcRenderer.on('dialog-output', (event, args: DialogOutput) => {
                //console.log(args);
                let resolver = DialogManager.promiseCache[args.promiseId];
                if (resolver) {
                    resolver(args);
                    delete DialogManager.promiseCache[args.promiseId];
                }
            });

            DialogManager.isInitialized = true;
        }
    }

    static prompt(title: string, message: string, caption: string, keys: string[]): Promise<{}> {
        let inputFields: FieldDescription[] = [];
        keys.forEach((key) => {
            inputFields.push({
                Name: key,
                Type: "string",
                IsArray: false,
                IsSecureString: false
            })
        })

        return DialogManager.showFieldDialog(title, message, caption, inputFields).then((res) => {
            return res.fieldValues;
        });
    }

    static showFieldDialog(title: string, message: string, caption: string, inputFields: FieldDescription[]): Promise<DialogOutput> {
        DialogManager.initialize();

        let height = 100 + 105 * inputFields.length;
        if (caption) {
            height += 50;
        }

        inputFields.forEach(f => {
            if (f.IsArray) {
                height += 50;
            }
        });

        let dialogWindow = new remote.BrowserWindow({ title: title, show: false, height: height, parent: remote.getCurrentWindow() });

        var newPromise = new Promise<DialogOutput>((resolve) => {
            let promiseId = DialogManager.promiseId;
            DialogManager.promiseCache[promiseId] = resolve;

            dialogWindow.loadURL(DialogManager.dialogHtml);

            dialogWindow.webContents.on('did-finish-load', function () {

                if (!dialogWindow.isDestroyed()) {
                    // Send a message to the dialog window so it can render fields.
                    // The dialog window replies to the main window, which proxies it back to this renderer window.
                    dialogWindow.webContents.send(
                        'dialog-input',
                        <DialogInput>{
                            promiseId: promiseId,
                            message: message,
                            caption: caption,
                            inputFields: inputFields
                        });

                    dialogWindow.show();

                    //dialogWindow.webContents.toggleDevTools();
                }
            });

            dialogWindow.on('closed', (event) => {
                let cancelledResult = <DialogOutput>{
                    promiseId: promiseId,
                    fieldValues: {},
                    cancelled: true
                }

                resolve(cancelledResult);
            })

        })

        newPromise.then(r => {
            if (!dialogWindow.isDestroyed()) {
                dialogWindow.close();
            }
        })

        DialogManager.promiseId++;

        return newPromise;
    }
}