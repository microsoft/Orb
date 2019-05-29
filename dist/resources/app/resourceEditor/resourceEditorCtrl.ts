import { remote, ipcRenderer, clipboard } from "electron";
import { LinkManager } from "../linkManager/linkManager";
import { Map, Constants, StateManager } from "../state/state";

const log = require("loglevel");

export interface ResourceInfo {
    resource: string;
    namespace: string;
    path: string;
}

export class ResourceEditorCtrl {
    public static openResourceEditor(fromClipboard: boolean = false, addNewResource: boolean = true, resourceInfo: ResourceInfo, onSavedCallback?: () => void, onCloseCallback?: () => void) {
        if (resourceInfo) {
            ResourceEditorCtrl.launchResourceEditor(false, addNewResource, resourceInfo, onSavedCallback, onCloseCallback)
        } else if (fromClipboard) {
            ResourceEditorCtrl.launchResourceEditor(true, addNewResource, { resource: clipboard.readText(), namespace: "", path: "" }, onSavedCallback, onCloseCallback);
        } else {
            LinkManager.generateResource().then((resource) => {
                if (resource) {
                    ResourceEditorCtrl.launchResourceEditor(false, addNewResource, { resource: resource, namespace: "", path: "" }, onSavedCallback, onCloseCallback);
                }
            }).catch((e) => {
                log.error(e);
            });
        }
    }

    private static launchResourceEditor(fromClipboard: boolean, addNewResource: boolean, resourceInfo: ResourceInfo, onSavedCallback?, onCloseCallback?) {
        let win = new remote.BrowserWindow({ width: 800, height: 900, backgroundColor: '#303030', title: "Orb" });
        win.on('close', (e) => {
            e.preventDefault();
            !onCloseCallback || onCloseCallback();
        });

        ipcRenderer.on("resourceEditor-saved-callback", (event, arg) => {
            win = null;
            !onSavedCallback || onSavedCallback();
        });

        win.loadURL(Constants.resourceEditorUrl);
        let state = StateManager.getStore();
        const explorerTrees = state.sideBar.inner.explorer.inner.trees;
        if (!resourceInfo.namespace || !resourceInfo.path) {
            if (explorerTrees && explorerTrees.length > 0) {
                let node = explorerTrees[0].root.node;
                resourceInfo.namespace = node.namespace;
                resourceInfo.path = node.objectPath;
            } else {
                const searchState = state.sideBar.inner.search.inner;
                resourceInfo.namespace = searchState.namespace;
                resourceInfo.path = searchState.path;
            }
        }

        win.webContents.addListener("dom-ready", () => {
            win.webContents.send("context-received", {
                fromClipboard: fromClipboard,
                resourceInfo: resourceInfo,
                addNewResource: addNewResource
            });
        });
    }
}