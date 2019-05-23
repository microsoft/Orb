//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="./typings/index.d.ts" />
// import DevTools, { configureDevtool } from "mobx-react-devtools";

import * as React from "react";
import * as ReactDOM from "react-dom";
import getMuiTheme from "material-ui/styles/getMuiTheme";
import darkBaseTheme from "material-ui/styles/baseThemes/darkBaseTheme";
import * as injectTapEventPluginExport from "react-tap-event-plugin";
import { StateManager } from "./state/state";
import * as Promise from "bluebird";
import { Util } from "./util/util";
import { ConfigUtil } from "./config/configUtil";
import { Repo } from "./repo/repo";
import { App } from "./app";

let log;

// Needed for onTouchTap
// http://stackoverflow.com/a/34015469/988941
injectTapEventPluginExport();

Promise.config({ cancellation: true });

let theme = getMuiTheme(darkBaseTheme);

theme.listItem.nestedLevelDepth = 10;
theme.textField.focusColor = "rgb(255,255,255)";

let store = StateManager.getStore();

const initialize = (): Promise<any> => {
    if (Util.isRunningInTest()) {
        return Promise.resolve();
    }

    return ConfigUtil.promptForMissingConfiguration().then(() => {
        Util.mkDirSync(ConfigUtil.GetSetting("modelRepoDir"));
        return new Promise<any>((resolve) => {
            const repo = Repo.instance();
            if (!repo.existsSync()) {
                resolve(repo.gitClone());
            } else {
                resolve();
            }
        })
    })
}

// Todo: Show mobx devtools based on hotkey or clicking debug.
// <DevTools />
initialize()
    .catch((e) => {
        alert("Failed to load object definitions from origin: {0}. Error: {1}".format(ConfigUtil.GetSetting("remoteOrigin"), e.toString()));
    }).finally(() => {
        ReactDOM.render(
            <App orbState={store} theme={theme} />,
            document.getElementById("react-app")
        );

        Repo.instance().gitPull();
        if (!Util.isRunningInTest()) {
            setInterval(() => {
                Repo.instance().gitPull().catch((e) => {
                    log.info(e.toString());
                })
            }, 10 * 60 * 1000);
        }

        // Injecting configured styles to app header and excluding chrome styles
        Util.injectFontFamily(["html", "div", "body"], "Roboto,sans-serif", true);
        Util.injectFontSize(["html", "div:not([class^='chrome']):not([class^='address']):not([class^='exclude'])", "body"], "14px", true);

        sendNotification();
    })

import { NotificationConfig } from "Model";
import { ModelReader } from "./modelReader/modelReader";
import { remote, ipcRenderer } from "electron";

// Customizes loglevel.
log = require("loglevel");
log.enableAll();
let originalFactory = log.methodFactory;
log.methodFactory = function (methodName, logLevel, loggerName) {
    let rawMethod = originalFactory(methodName, logLevel, loggerName);

    return function (message) {
        let msgString = message;
        if (!(typeof message === 'string' || message instanceof String)) {
            msgString = JSON.stringify(message);
        }

        if (methodName === "error") {
            remote.dialog.showErrorBox(msgString, "");
        } else {
            StateManager.getStore().toast.inner.showToast(msgString, methodName === "trace"
                || methodName == "debug" ? "info" : methodName);
        }

        rawMethod(message);
    };
};

window.alert = function (message: string) {
    log.error(message);
}

log.setLevel(log.getLevel());

let sendUpdateNotification = () => {
    StateManager.getStore().toast.inner.showToast("A new version is available. Restart Orb to get the latest updates.", "info", "tc", null, 0);
}

ipcRenderer.on("renderer-update-available", () => {
    sendUpdateNotification();
    setInterval(() => sendUpdateNotification(), 24 * 3600 * 1000);
});

ipcRenderer.on("renderer-clear-cache", () => {
    StateManager.getStore().toast.inner.showToast("Orb cache has been cleared.", "info", "tc", null, 0);
});

let sendNotification = () => {
    ModelReader.getConfigByName("notification").then((notification: NotificationConfig) => {
        if (notification) {
            let now = new Date().getTime();
            let endTime = new Date(notification.endTimeUtc).getTime();
            if (!notification.on || now > endTime || !notification.message) {
                return;
            }

            if (notification.userDomain != Util.getUserDomain()) {
                return;
            }

            let showNotification = () => {
                StateManager.getStore().toast.inner.showToast(notification.message, "info", "tc", notification.action ? {
                    label: notification.action.label,
                    callback: () => {
                        StateManager.getStore().tabManager.inner.openTab({
                            url: notification.action.url,
                            title: notification.action.label,
                            isForegroundTab: true,
                            openInNew: true
                        })
                    }
                } : null,
                    notification.autoHideDurationInSeconds ? notification.autoHideDurationInSeconds : 0,
                )
            }

            setTimeout(() => {
                showNotification();
            }, 5 * 1000);

            if (notification.showIntervalInMinutes > 0) {
                setInterval(() => showNotification(), notification.showIntervalInMinutes * 60 * 1000);
            }
        }
    }).catch((e) => {
        console.log(e);
    })
}


