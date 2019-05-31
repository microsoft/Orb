//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------
/// <reference path="./typings/index.d.ts" />

let startTime = process.hrtime();

// Required by Squirrel
const path = require("path");
const fs = require("fs");
const uuidV4 = require("uuid/v4");
const net = require("net");
const socket = "\\\\.\\pipe\\orb-default-pipe";
const semver = require('semver');

handleCustomSquirrelEvents();

if (!require("electron-squirrel-startup")) {

    const cp = require("child_process");
    const util = require("util");
    const { default: installExtension, REACT_DEVELOPER_TOOLS } = require("electron-devtools-installer");
    const regedit = require("regedit");

    // Module to control application life and create native browser window
    const { app, ipcMain, dialog, BrowserWindow, Menu, session, shell } = require("electron");
    const prompt = require("./node_modules_forked/electron-prompt");

    let updateInterval;

    // Keep a global reference of the window object, if you don't, the window will
    // be closed automatically when the JavaScript object is garbage collected.
    let mainWindow;
    let statePersistedOnClose = false;
    let canClose = true; // Indicates whether we can close the mainWindow.
    let isClosingRequestPending = false; // Whether the closing request is in progress.
    let isDefaultInstance = false;
    let alreadySentNotification = false;
    let defaultNamedPipeClient;
    let instanceNamePipeClient;
    let filePath, fileData, parsedFileData;
    let instanceId;

    let fileFilters = [
        { name: "Orb Files", extensions: ["orb"] },
        { name: "All Files", extensions: ["*"] }
    ];

    let getTitle = () => {
        let title = "Orb";
        if (isInsiders()) {
            title = "Orb - Insiders"
        }

        if (filePath) {
            title = path.basename(filePath) + " - " + title;
        }

        return title;
    }

    let createWindow = () => {

        let title = getTitle();

        // Create the browser window.
        mainWindow = new BrowserWindow({
            show: false,
            minWidth: 400,
            backgroundColor: "#303030",
            titleBarStyle: "hidden",
            title: title,
            webPreferences: {
                nodeIntegration: true
            }
        });
        mainWindow.maximize();

        global.mainWindowHandle = mainWindow.getNativeWindowHandle();

        mainWindow.webContents.session.on("will-download", (event, item: Electron.DownloadItem, webContents) => {

            let mimeType = item.getMimeType();
            let fileName = item.getFilename();

            if ((mimeType && mimeType.toLowerCase() === "application/x-ms-application") ||
                (fileName && fileName.toLowerCase().endsWith(".application") && mimeType.toLowerCase() === "application/octet-stream")) {
                // ClickOnce support.
                event.preventDefault(); // Stop the file download.
                let url = item.getURL();
                // https://www.mking.net/blog/programmatically-launching-clickonce-applications

                // Escape '&' in the url for cmd. Required for clickonce applications using query parameters.
                url = url.replace(/&/g, "^&");
                cp.exec("rundll32.exe dfshim.dll,ShOpenVerbApplication " + url);
            }
        });

        const menuTemplate = [
            {
                label: "File",
                submenu: [
                    {
                        label: "Open File",
                        accelerator: "CmdOrCtrl+O",
                        click() {
                            handleOpenFile();
                        }
                    },
                    {
                        label: "Save",
                        accelerator: "CmdOrCtrl+S",
                        click() {
                            handleSaveFile();
                        }
                    },
                    {
                        label: "Save as",
                        accelerator: "CmdOrCtrl+Shift+S",
                        click() {
                            handleSaveFile(true);
                        }
                    },
                    {
                        label: "Copy Link",
                        accelerator: "CmdOrCtrl+L",
                        click() {
                            handleCopyLink();
                        }
                    },
                    {
                        label: "New Resource from Current Tab",
                        accelerator: "CmdOrCtrl+Shift+N",
                        click() {
                            handleGenerateResource();
                        }
                    },
                    {
                        label: "New Resource from Clipboard",
                        accelerator: "CmdOrCtrl+N",
                        click() {
                            handleGenerateResourceFromClipboard();
                        }
                    }
                ]
            },
            {
                label: "Edit",
                submenu: [
                    {
                        label: "Preferences",
                        click() {
                            if (mainWindow) {
                                mainWindow.webContents.send("config-open-editor");
                            }
                        }
                    }
                ]
            },
            {
                label: "Browser",
                submenu: [
                    {
                        label: "Search in Page",
                        accelerator: "CmdOrCtrl+F",
                        click() {
                            if (mainWindow.isFocused()) {
                                mainWindow.webContents.send("tab-manager-toggleSearch");
                            }
                        }
                    },
                    {
                        label: "Reload Page",
                        accelerator: "F5",
                        click() {
                            if (mainWindow.isFocused()) {
                                mainWindow.webContents.send("tab-manager-reload");
                            }
                        }
                    },
                    {
                        label: "Back",
                        accelerator: "Alt+Left",
                        click() {
                            if (mainWindow.isFocused()) {
                                mainWindow.webContents.send("tab-manager-goback");
                            }
                        }
                    },
                    {
                        label: "Forward",
                        accelerator: "Alt+Right",
                        click() {
                            if (mainWindow.isFocused()) {
                                mainWindow.webContents.send("tab-manager-goforward");
                            }
                        }
                    },
                    {
                        label: "Open New Tab",
                        accelerator: "CmdOrCtrl+T",
                        click() {
                            if (mainWindow.isFocused()) {
                                mainWindow.webContents.send("tab-manager-openNewTab");
                            }
                        }
                    },
                    {
                        label: "Switch Tab",
                        accelerator: "CmdOrCtrl+Tab",
                        click() {
                            if (mainWindow.isFocused()) {
                                mainWindow.webContents.send("tab-manager-switchTab");
                            }
                        }
                    },
                    {
                        label: "Focus on Address Bar",
                        accelerator: "Alt+D",
                        click() {
                            if (mainWindow.isFocused()) {
                                mainWindow.webContents.send("tab-manager-selectAll");
                            }
                        }
                    },
                    {
                        label: "Close Current Tab",
                        accelerator: "CmdOrCtrl+W",
                        click() {
                            if (mainWindow.isFocused()) {
                                mainWindow.webContents.send("tab-manager-closeCurrentTab");
                            }
                        }
                    },
                    {
                        label: "Clear History",
                        click() {
                            if (mainWindow.isFocused()) {
                                mainWindow.webContents.send("tab-manager-clear-history");
                            }
                        }
                    },
                    {
                        label: "Clear Cache",
                        click() {
                            if (mainWindow.isFocused()) {
                                mainWindow.webContents.session.clearCache(() => {
                                    mainWindow.webContents.send("renderer-clear-cache");
                                });
                            }
                        }
                    }
                ]
            }, {
                label: "Tools",
                submenu: [
                    {
                        label: "Toggle Developer Tools",
                        accelerator: "Ctrl+Shift+D",
                        click() {
                            mainWindow.toggleDevTools();
                        }
                    },
                    {
                        label: "Restart Orb",
                        accelerator: "Shift+F5",
                        click() {
                            mainWindow.webContents.send("editor-force-close-allWindows");

                            mainWindow.getChildWindows().forEach(w => {
                                // Close all children on refresh.
                                if (!w.isDestroyed()) {
                                    w.close();
                                }
                            });

                            // The actual reload will complete once the persistence completes.
                            mainWindow.webContents.send("state-manager-persistStateOnReload");

                            if (fileData && !filePath) {

                                // clear out file data so reload doesn"t reload the file if launched in 'default'/append mode.
                                global.fileData = null;
                                fileData = null;
                            }
                        }
                    }
                ]
            }
        ];

        const menu = Menu.buildFromTemplate(menuTemplate);
        mainWindow.setMenu(menu);
        //mainWindow.setMenuBarVisibility(false);

        // and load the index.html of the app.
        mainWindow.loadURL(`file://${__dirname}/index.html`)
        //mainWindow.toggleDevTools();

        mainWindow.webContents.on("will-navigate", (event, url) => {
            // required since adal ends up reloading the app without this.
            event.preventDefault();
        });


        mainWindow.on("app-command", (e, cmd) => {
            // Navigate the window back when the user hits their mouse back button
            if (cmd === "browser-backward") {
                if (mainWindow.isFocused()) {
                    mainWindow.webContents.send("tab-manager-goback");
                }
            } else if (cmd === "browser-forward") {
                if (mainWindow.isFocused()) {
                    mainWindow.webContents.send("tab-manager-goforward");
                }
            }
        });

        // Focus the selected webview when mainWindow focused.
        mainWindow.on("focus", () => {
            mainWindow.webContents.send("tab-manager-focus");
        })

        ipcMain.on("dialog-output", (event, args) => {
            // Proxy the result from the dialog window to the main renderer window.
            // https://github.com/electron/electron/issues/7193
            // Electron does not allow two renderer processes to communicate directly for security reasons, hence the need for this proxy.
            mainWindow.webContents.send("dialog-output", args);
        })

        ipcMain.on("editor-instance-saved-callback", (event, args) => {
            // Proxy the request from the editor window to the renderer process.
            mainWindow.webContents.send("editor-instance-saved-callback", args);
        });

        ipcMain.on("terminal-title-changed-callback", (event, args) => {
            // Proxy the request from the terminal window to the renderer process.
            mainWindow.webContents.send("terminal-title-changed-callback", args, event.sender.id);
        });

        ipcMain.on("resourceEditor-saved-callback", (event, args) => {
            // Proxy the request from the editor window to the renderer process.
            mainWindow.webContents.send("resourceEditor-saved-callback", args);
        });

        mainWindow.webContents.on("did-finish-load", () => {
            mainWindow.show();
        });

        /* Use the below test window to test any new html pages under development.
        var testWindow = new BrowserWindow({ width: 800, height: 600 })
        testWindow.loadURL(`file://${__dirname}/markdown/markdownView.html`)
        */

        app.on("select-client-certificate", (event, webContents, url, list, callback) => {

            let certWindow = new BrowserWindow({ width: 550, height: 350, show: false, backgroundColor: "#303030" })
            certWindow.loadURL(`file://${__dirname}/certSelector.html`);
            certWindow.setMenuBarVisibility(false);

            //certWindow.toggleDevTools();
            // This prevents electron from using the first certificate.
            event.preventDefault();

            ipcMain.once("client-certificate-selected", (event, item) => {
                callback(item)
                certWindow.destroy();
            })

            certWindow.webContents.on("did-finish-load", () => {
                certWindow.webContents.send("select-client-certificate", list);
                certWindow.show();
            });

        });

        updateInterval = setInterval(() => checkForUpdate(), 60 * 60 * 1000);

        ipcMain.on("state-manager-persistStateOnCloseCompleted", () => {
            statePersistedOnClose = true;
            console.log("State persisted. Closing window.");
            mainWindow.close();
        });

        ipcMain.on("state-manager-persistStateOnReloadCompleted", () => {
            console.log("State persisted. Reloading window.");
            mainWindow.reload();
        });

        // Emitted when the window is closed.
        mainWindow.on("closed", () => {
            // Dereference the window object, usually you would store windows
            // in an array if your app supports multi windows, this is the time
            // when you should delete the corresponding element.

            mainWindow = null
        })

        ipcMain.on("editor-did-close-allWindows", (event, arg) => {
            // Received the events indicated all childWindows are closed.
            canClose = true;
            if (isClosingRequestPending) {
                // If the request was not cancelled, we close the mainWindow.
                mainWindow.close();
            }
        })

        ipcMain.on("editor-did-openWindow", (event, arg) => {
            // A new window opened.
            canClose = false;
        })

        ipcMain.on("editor-cancel-closingRequest", (event, arg) => {
            // The closingRequest has been cancelled by user.
            isClosingRequestPending = false;
        })

        // Emitted when the window is about to be closed.
        mainWindow.on("close", (e) => {
            // Check if we can close the mainWindow.
            if (canClose) {
                // Close the window if there are no child windows.
                // Check if state has been persisted.
                if (!statePersistedOnClose) {
                    mainWindow.webContents.send("state-manager-persistStateOnClose");
                    mainWindow.webContents.send("tab-manager-mainWindow-close");
                    e.preventDefault();
                }

                return;
            }

            e.preventDefault();
            // Send the event to close all childWindows.
            isClosingRequestPending = true;
            mainWindow.webContents.send("editor-close-allWindows");
        })
    }

    let setCurrentInstanceFilePathAndTitle = (file) => {
        setCurrentInstanceFilePath(file);
        process.argv[1] = file;
        let newTitle = getTitle();
        mainWindow.setTitle(newTitle);
    }

    let setCurrentInstanceFilePath = (file) => {
        filePath = file;
        global.filePath = file;
    }

    let handleSaveFile = (saveAs = false) => {
        if (!filePath || saveAs) {
            dialog.showSaveDialog(null, { filters: fileFilters, defaultPath: filePath }, (file) => {
                if (file && mainWindow) {
                    setCurrentInstanceFilePathAndTitle(file);
                    mainWindow.webContents.send("state-manager-save-state", filePath);
                    app.addRecentDocument(filePath);
                }
            });
        } else if (filePath && mainWindow) {
            mainWindow.webContents.send("state-manager-save-state", filePath);
        }
    }

    let parseFileData = (data) => {
        let parsedData = JSON.parse(data);
        if (parsedData.Instance && !parsedData.instance) {
            // Handle any casing differences.
            // TODO: Do this generically for all fields in the file if required.
            parsedData.instance = parsedData.Instance;
        }

        if (parsedData.instance) {
            parsedData.instance = parsedData.instance.toLowerCase();
        }

        return parsedData;
    }

    let handleOpenFile = () => {
        dialog.showOpenDialog(null, { properties: ["openFile"], filters: fileFilters }, (files) => {

            if (files && files.length > 0 && files[0] && mainWindow) {

                fs.readFile(files[0], "utf-8", (err, data) => {
                    if (err) {
                        dialog.showErrorBox("File Not Found", err.toString());
                    }

                    if (data) {
                        let parsedData = parseFileData(data);
                        if (parsedData.instance && parsedData.instance === "default") {
                            mainWindow.webContents.send("state-manager-append-state", data);
                        } else {
                            cp.spawn(process.execPath, [files[0]], { detached: true });
                        }

                        app.addRecentDocument(files[0]);
                    }
                });
            }
        })
    }

    let handleNewConnection = (connection) => {
        connection.setEncoding("utf-8");
        connection.on("data", (data) => {
            if (mainWindow) {
                if (data.startsWith("orbx://")) {
                    let url = data.replace("orbx://", "");
                    let instance = url.split("/")[0];
                    mainWindow.webContents.send("state-manager-append-state-from-link", url.replace(instance + "/", ""));
                } else if (data.startsWith("notification://")) {
                    let event = data.replace("notification://", "");
                    mainWindow.webContents.send(event);
                } else {
                    mainWindow.webContents.send("state-manager-append-state", data);
                }

                mainWindow.focus();
            }
        });
    }

    let handleClientError = (socket, err) => {
        if (process.platform === "win32") {
            try {
                fs.unlinkSync(socket);
            } catch (e) {
                if (e.code !== "ENOENT") {
                    console.log(e);
                }
            }
        }
    }

    let handleCopyLink = () => {
        mainWindow.webContents.send("state-manager-copy-link");
    }

    let handleGenerateResource = () => {
        mainWindow.webContents.send("tab-manager-generate-resource");
    }

    let handleGenerateResourceFromClipboard = () => {
        mainWindow.webContents.send("tab-manager-generate-resource-from-clipboard");
    }

    let openNamedPipes = () => {

        if (alreadySentNotification) {
            return;
        }

        // check if you need to deliver a message to a specific instance and then quit
        if (parsedFileData && parsedFileData.instance && parsedFileData.instance !== "default" && parsedFileData.instance !== "new") {
            instanceNamePipeClient = net.connect({ path: socket + parsedFileData.instance }, () => {
                //console.log("Sending parsedFileData to instance " + parsedFileData.instance);
                if (!alreadySentNotification) {
                    instanceNamePipeClient.write(fileData);
                    instanceNamePipeClient.end();
                    alreadySentNotification = true;
                    app.quit();
                }
            });

            instanceNamePipeClient.on("error", (err) => {
                handleClientError(socket + parsedFileData.instance, err);
            });
        }

        defaultNamedPipeClient = net.connect({ path: socket }, () => {
            //console.log("Not the default instance since named pipe was in use.");
            if (parsedFileData && parsedFileData.instance && parsedFileData.instance === "default" && !alreadySentNotification) {
                defaultNamedPipeClient.write(fileData);
                defaultNamedPipeClient.end();

                // In electron v.1.7.5+, the connection callback can get refired as the app quit is invoked.
                // This was causing duplicate state notifications to be sent.
                // this flag prevents that.
                alreadySentNotification = true;
                app.quit();
            }
        });

        defaultNamedPipeClient.on("error", (err) => {
            handleClientError(socket, err);

            let server = net.createServer((connection) => {
                handleNewConnection(connection);
            });

            server.on("error", (err) => {
                console.log(err);
                isDefaultInstance = false;
            })

            server.listen(socket);

            isDefaultInstance = true;

            if (!mainWindow && fileData) {
                // There was no default session and a file was specified.
                // In this case, the top level code will not create the window since it is dependent on socket creation.
                // create the window here.
                //console.log("No default session found for file. Creating new window.");
                createWindow();
            }
        });

        defaultNamedPipeClient.on("end", () => {
            //console.log("Named pipe client closed.")
            openNamedPipes();
        });

        // create the instance specific named pipe.
        if (!instanceId) {
            instanceId = uuidV4();
            process.env.OrbInstanceId = instanceId;
            process.env.OrbProcessPath = process.execPath;
            //console.log(instanceId);

            let instanceServer = net.createServer((connection) => {
                handleNewConnection(connection);
            });

            instanceServer.on("error", (err) => {
                dialog.showErrorBox("Error creating named pipe server", err.toString());
            })

            instanceServer.listen(socket + instanceId);

            // set the instance id on the global object for the renderer process
            global.instanceId = instanceId;
        }
    }

    let checkForUpdate = () => {

        // Orb uses squirrel for managing updates.
        // Call update.exe (squirrel) and try upgrading orb.
        let dirName = path.dirname(process.execPath);

        let autoUpdateFileName = isInsiders() ?
            "autoUpdatePath_insiders.txt" : "autoUpdatePath.txt";


        let autoUpdateFilePath = path.resolve(dirName, "resources/app", autoUpdateFileName);
        console.log(autoUpdateFilePath);

        fs.readFile(autoUpdateFilePath, "utf8", (err, updatePath) => {
            if (err) {
                console.warn(err);
            } else {
                let updateDotExe = path.resolve(dirName, "..", "update.exe");
                // Use fs.stat to check for the file existence.
                fs.stat(updateDotExe, (err, stat) => {
                    if (err) {
                        console.warn(err);
                    } else {
                        let args = ["--update", updatePath];

                        let child = cp.spawn(updateDotExe, args, { detached: true });

                        child.on("close", (code) => {
                            console.log("Checking for updates terminated with exit code %d", code);
                        });
                    }
                });
            }
        })
    }

    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    app.on("ready", () => {

        // Modify the user agent for all requests to the following urls.
        const filter = {
            urls: []
        };

        session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
            // Acis auth doesn't support chrome for now, as a workaround, set the User-Agent to edge.
            details.requestHeaders["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Safari/537.36 Edge/15.15063 ";

            callback({ cancel: false, requestHeaders: details.requestHeaders });
        });

        session.defaultSession.allowNTLMCredentialsForDomains("*");

        if (process.argv.length === 2 && !process.argv[1].startsWith("-")) {
            let arg = process.argv[1];
            if (arg.startsWith("orbx://")) {
                let instance = "new";
                let url = arg.replace("orbx://", "");
                instance = url.split("/")[0].toLowerCase();

                global.linkData = url.replace(instance + "/", "");
                fileData = arg;
                parsedFileData = {
                    instance: instance
                }

                if (instance === "new") {
                    createWindow();
                }

                openNamedPipes();
            } else {
                fs.readFile(arg, "utf-8", (err, data) => {
                    if (err) {
                        dialog.showErrorBox("File Not Found", err.toString());
                    }

                    if (data) {
                        parsedFileData = parseFileData(data);
                        fileData = data;
                        global.fileData = data;
                        if (!parsedFileData.instance || parsedFileData.instance === "new") {
                            // set the filePath only if this is new instance (not default or a specific instance)

                            setCurrentInstanceFilePath(arg);
                            createWindow();
                        }

                        openNamedPipes();
                        app.addRecentDocument(arg);
                    } else {
                        createWindow();
                        openNamedPipes();
                    }
                });
            }
        } else {
            createWindow();
            openNamedPipes();
        }

        setTimeout(() => {
            // Check for updates 5 minutes after launching Orb.
            // Updates can impact startup perf, hence the delay.
            checkForUpdate();
        }, 5 * 60 * 1000);

        let jumpList = [];

        // Tasks
        jumpList.push({
            type: "tasks",
            items: [
                {
                    type: "task",
                    title: "New Instance",
                    program: process.execPath,
                    iconPath: process.execPath,
                    iconIndex: 0
                }
            ]
        });

        // Recent
        jumpList.push({
            type: "recent" // this enables to show files in the "recent" category
        });

        app.setJumpList(jumpList);
        let timeCost = process.hrtime(startTime);
        loadRegedit().installAll();

        // Install React Dev Tools.
        installExtension(REACT_DEVELOPER_TOOLS);
    });

    // Quit when all windows are closed.
    app.on("window-all-closed", () => {
        // On OS X it is common for applications and their menu bar
        // to stay active until the user quits explicitly with Cmd + Q
        if (process.platform !== "darwin") {
            app.quit()
        }
    });

    app.on("activate", () => {
        // On OS X it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (mainWindow === null) {
            createWindow();
        }
    });

    app.on("login", (event, webContents, request, authInfo, callback) => {
        event.preventDefault();
        prompt({
            title: "Sign in",
            inputAttrs: [
                {
                    label: "Username",
                    type: "text"
                },
                {
                    label: "Password",
                    type: "password"
                }]
        }, mainWindow).then((r) => {
            if (r === null) {
                console.log("user cancelled");
            } else {
                callback(r[0], r[1]);
            }
        }).catch(console.error);
    });
}

function loadRegedit() {
    const { ProgId, ShellOption, Regedit } = require("./node_modules_forked/electron-regedit-forked");
    let appName = "Orb";
    if (isInsiders()) {
        appName = "OrbInsiders"
    }

    let exeName = path.basename(process.execPath);

    // Point to the squirrel stub exe one level above the executing process.

    let command = path.join(path.dirname(path.dirname(process.execPath)), exeName);

    new ProgId({
        description: "Orb File",
        appName: appName,
        icon: "",
        extensions: ["orb"],
        shell: [
            new ShellOption({ verb: ShellOption.OPEN, command: command })
        ]
    });

    return Regedit;
}

function notifyUpdateAvailable() {
    let client = net.connect({ path: socket }, () => {
        client.write("notification://renderer-update-available");
        client.end();
    });
}

function handleCustomSquirrelEvents() {
    if (process.platform !== "win32") {
        return;
    }
    let squirrelCommand = process.argv[1];
    switch (squirrelCommand) {
        case "--squirrel-updated":
            copySquirrelStubExe();
            console.log("Install file associations and links.");
            loadRegedit().installAll();
            console.log("Notify update available.");
            notifyUpdateAvailable();
            cleanupFiles();
            break;
        case "--squirrel-install":
            copySquirrelStubExe();
            console.log("Install file associations and links.");
            loadRegedit().installAll();
            cleanupFiles();
            break;
        case "--squirrel-uninstall":
            console.log("Uninstall file associations and links.");
            loadRegedit().uninstallAll();
            break;
    }
}

function copySquirrelStubExe() {
    const fse = require("fs-extra");

    // see gulpfile.js for details on the stub exe
    let dirName = path.dirname(process.execPath);
    let exeName = path.basename(process.execPath);
    let stubPath = path.join(dirName, (isInsiders() ? "orb_insiders" : "orb") + ".ExecutionStub.exe");
    let dest = path.join(dirName, "..", exeName);

    fse.copySync(stubPath, dest);

    let appDir = path.dirname(dirName);

    fse.readdirSync(appDir).filter(d => {
        let dir = d.toLowerCase();
        if (dir.startsWith("app-") && dir.split(".").length === 4) {
            // rename a legacy version directory with 4 "." in it's version.
            // the squirrel stub exe requires semantic versioning (major.minor.patch).
            // it crashes with directories with invalid versions.
            let newPath = path.join(appDir, ("/deprecated" + uuidV4().toString()))
            let oldPath = path.join(appDir, "/", dir);
            fse.renameSync(oldPath, newPath);
        }
    });
}

function isInsiders() {
    return path.basename(process.execPath).toLowerCase() === "orb_insiders.exe";
}

function readDir(directory): Promise<string[]> {
    return new Promise((resolve, reject) => {
        fs.readdir(directory, (err, files) => {
            if (err) {
                reject(err);
            } else {
                let appFolders = [];

                files.forEach((file) => {
                    try {
                        if (file.startsWith("app-") && fs.statSync(path.join(directory, file)).isDirectory()) {
                            appFolders.push(file);
                        }
                    } catch (e) {
                        console.log(e);
                    }
                })

                let indexStart = "app-".length;
                try {
                    appFolders.sort((a, b) => {
                        return semver.lt(a.substring(indexStart), b.substring(indexStart)) ? 1 : -1;
                    })
                } catch (e) {
                    console.log(e);
                }

                resolve(appFolders);
            }
        });
    });
};

function deleteFolderRecursive(path) {
    try {
        if (fs.existsSync(path)) {
            fs.readdirSync(path).forEach((file, index) => {
                let curPath = path + "/" + file;
                if (fs.lstatSync(curPath).isDirectory()) {
                    deleteFolderRecursive(curPath);
                } else {
                    fs.unlinkSync(curPath);
                }
            });
            fs.rmdirSync(path);
        }
    } catch (e) {

    }
};

function cleanupFiles() {
    let directory = path.dirname(path.dirname(process.execPath));
    readDir(directory).then((appFolders) => {
        let count = 0;
        let exeName = path.basename(process.execPath);
        appFolders.forEach((appFolder) => {
            try {
                count++;
                if (count > 2) {
                    // Keep latest two versions.
                    let directoryToDelete = path.join(directory, appFolder);
                    let exePath = path.join(directoryToDelete, exeName);
                    if (fs.existsSync(exePath)) {
                        fs.unlink(exePath, (err) => {
                            // Check if any older version is in use. If yes and version is greater than 1.0.0. Do not delete.
                            if (err) {
                                console.log(err);
                                return;
                            }

                            deleteFolderRecursive(directoryToDelete);
                        })
                    } else {
                        deleteFolderRecursive(directoryToDelete);
                    }
                }
            } catch (e) {
                console.log(e);
            }
        })
    }).catch(function (e) {
        console.log(e);
    })
}
