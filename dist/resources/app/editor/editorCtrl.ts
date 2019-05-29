//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />

import { remote, ipcRenderer } from "electron";
import { Map, Constants } from "../state/state";
import { ModelReader } from "../modelReader/modelReader";
const log = require("loglevel");

export class EditorRequest {
    url: string; // TODO move this to file path instead.
    title?: string;
    onCloseCallback?: () => void;
    onClosedCallback?: () => void;
    onSavedChangesCallback?: () => void;
}

class EditorInstance {
    request: EditorRequest;
    window: Electron.BrowserWindow;
}

export class EditorCtrl {
    private editorWindows: Map<EditorInstance>;
    private static _instance: EditorCtrl;

    private constructor() {
        this.editorWindows = {};

        // Received the closing request from mainProcess.
        ipcRenderer.on("editor-close-allWindows", (event, arg) => {
            const keys = Object.keys(this.editorWindows);
            if (keys.length == 0) {
                // All windows have been closed.
                ipcRenderer.send("editor-did-close-allWindows");
            } else {
                // Send the request to close each child window.
                keys.forEach((key) => {
                    if (this.editorWindows[key]) {
                        this.editorWindows[key].window.webContents.send("editor-close-window");
                    }
                })
            }
        })

        ipcRenderer.on("editor-force-close-allWindows", (event, arg) => {
            const keys = Object.keys(this.editorWindows);
            if (keys.length == 0) {
                return;
            } else {
                // Send the request to close each child window.
                keys.forEach((key) => {
                    let window = this.editorWindows[key].window;
                    if (window && !window.isDestroyed()) {
                        window.destroy();
                    }
                });
            }
        });

        ipcRenderer.on("editor-instance-saved-callback", (event, arg) => {
            let key = arg.toLowerCase();
            let instance = this.editorWindows[key];
            if (instance && instance.request.onSavedChangesCallback) {
                instance.request.onSavedChangesCallback();
            }
        });
    }

    openEditor(request: EditorRequest) {

        let { url, onCloseCallback, onClosedCallback } = request;

        let key = url.toLowerCase();

        if (this.editorWindows[key]) {
            log.error("File has been already opened for editing.");
            return;
        }

        let win = new remote.BrowserWindow({ width: 1200, height: 900, backgroundColor: '#303030', title: request.title });
        this.editorWindows[key] = {
            window: win,
            request: request
        };

        win.on('close', (e) => {
            e.preventDefault();
            !onCloseCallback || onCloseCallback();
        });

        win.on('closed', () => {
            delete this.editorWindows[key];
            win = null;
            !onClosedCallback || onClosedCallback();
            // If all the childWindows are closed. Let mainProcess know it can close the mainWindow.
            if (Object.keys(this.editorWindows).length == 0) {
                ipcRenderer.send("editor-did-close-allWindows");
            }
        });

        ipcRenderer.send("editor-did-openWindow");
        win.loadURL(url);
    }

    appendEditorOption(contextMenu: Electron.Menu, url: string, title: string, label = "Edit", onCloseCallback?: () => any, onSavedCallback?: () => any) {
        contextMenu.append(
            new remote.MenuItem(
                {
                    label: label,
                    sublabel: ModelReader.isProtected(url) ? "Protected Resource" : "",
                    click: () => {
                        EditorCtrl._instance.openEditor({ url: url, title: title, onCloseCallback: onCloseCallback, onSavedChangesCallback: onSavedCallback });
                    },
                }
            ));
    }

    public static instance() {
        if (EditorCtrl._instance == null) {
            EditorCtrl._instance = new EditorCtrl();
        }

        return EditorCtrl._instance;
    }
}