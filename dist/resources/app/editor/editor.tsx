//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />

import * as React from "react";
import * as injectTapEventPluginExport from "react-tap-event-plugin";
import { observer } from "mobx-react";
import * as ReactDOM from "react-dom";
import { remote, ipcRenderer } from "electron";
import * as path from "path";
import RaisedButton from "material-ui/RaisedButton";
import MuiThemeProvider from "material-ui/styles/MuiThemeProvider";
import getMuiTheme from "material-ui/styles/getMuiTheme";
import lightBaseTheme from "material-ui/styles/baseThemes/lightBaseTheme";
import AppBar from "material-ui/AppBar";
import IconButton from "material-ui/IconButton";
import CircularProgress from "material-ui/CircularProgress";
import { EditorDataType } from "../state/state";
import { ModelReader } from "../modelReader/modelReader";
import { Repo } from "../repo/repo";
import * as Promise from "bluebird";
import { Util } from "../util/util";

const Config = require('electron-config');
const config = new Config();

declare let monaco: any;
declare let amdRequire: any;
declare let self: any;

const readJson: any = Promise.promisify(require("fs-extra").readJson);
const appPath = remote.app.getAppPath();
let theme = getMuiTheme(lightBaseTheme);
injectTapEventPluginExport();

interface DataSource {
    type: EditorDataType;
    data: string;
}

interface EditorState {
    originalSrc?: DataSource;
    modifiedSrc?: DataSource;
    language?: string;
    modified?: boolean;
    inProgress?: boolean;
}

// The editor takes URL as input, retrieves the filePath/rawContent from query string.
// Examples:
//     ./editor/editor.html?originalSrc={0}&originalSrcType={1}&modifiedSrc={2}&modifiedSrcType={3}&language={4}&isDiff={5}
// {0}: filePath, URI or RawContent for original source. (optional)
// {1}: the original source type. Enum {URI, RAW_CONTENT}, default URI. (optional)
// {2}: filePath, URI or RawContent for modified source. (optional)
// {3}: the modified source type. Enum {URI, RAW_CONTENT}, default URI. (optional)
// {4}: the language. (optional)
// {5}: if isDiff sets to true, originalSrc will be ignored, a diff editor will be created based on modifiedSrc.
// If modified source is specified, a diff editor will be created.
class Editor extends React.Component<any, EditorState> {
    private editor: any;
    constructor(props) {
        super(props);
        this.handleSaveClick = this.handleSaveClick.bind(this);
        this.handleEditorContentChange = this.handleEditorContentChange.bind(this);
        this.handleWindowClose = this.handleWindowClose.bind(this);
        this.state = {};
        window.onbeforeunload = (e) => {
            if (!this.state.modified) {
                return null;
            }

            this.handleWindowClose().then((canClose) => {
                if (canClose) {
                    window.close();
                }
            });
            return true;
        }

        ipcRenderer.on("editor-close-window", (event, arg) => {
            this.handleWindowClose().then((canClose) => {
                if (canClose) {
                    window.close();
                } else {
                    // The pending request was cancelled by user.
                    ipcRenderer.send("editor-cancel-closingRequest");
                }
            });
        })
    }

    componentWillMount() {
        let params = this.getParams(window.location.search);
        let originalSrc: DataSource = null;
        if (params["originalSrc"]) {
            const type = params["originalSrcType"] || "URI";
            if (type === "RAW_CONTENT") {
                originalSrc = {
                    type: "RAW_CONTENT",
                    data: decodeURI(params["originalSrc"])
                }
            } else if (type === "URI") {
                let filePath = decodeURI(params["originalSrc"]);
                originalSrc = {
                    type: "URI",
                    data: path.isAbsolute(filePath) ? filePath : path.join(appPath, filePath)
                }
            } else {
                alert("Type: " + type + " is not supported");
            }
        }

        let modifiedSrc: DataSource = null;
        if (params["modifiedSrc"]) {
            const type = params["modifiedSrcType"] || "URI";

            if (type === "RAW_CONTENT") {
                modifiedSrc = {
                    type: "RAW_CONTENT",
                    data: decodeURI(params["modifiedSrc"])
                }
            } else if (type === "URI") {
                let filePath = decodeURI(params["modifiedSrc"]);
                modifiedSrc = {
                    type: "URI",
                    data: path.isAbsolute(filePath) ? filePath : path.join(appPath, filePath)
                }
            } else {
                alert("Type: " + type + " is not supported");
            }
        }

        let extension = "";

        // The language mode is determined by following order:
        //  1. Use the language specified in URI query.
        //  2. If the type of modifiedSrc is URI, use the extension.
        //  3. If the type of originalSrc is URI, use the extension.
        //  4. Otherwise, json is the default.
        if (params["language"]) {
            extension = params["language"];
        } else if (modifiedSrc !== null && modifiedSrc.type === "URI") {
            extension = path.extname(modifiedSrc.data);
        } else if (originalSrc !== null && originalSrc.type === "URI") {
            extension = path.extname(originalSrc.data);
        }

        if (extension.startsWith(".")) {
            extension = extension.substring(1);
        }

        if (params["isDiff"] === "true" && modifiedSrc.type === "URI") {
            Repo.instance().gitShow(modifiedSrc.data).then((res) => {
                let diffSrc: DataSource = {
                    type: "RAW_CONTENT",
                    data: res
                };

                this.setState({
                    originalSrc: diffSrc,
                    modifiedSrc: modifiedSrc,
                    language: extension || "json",
                    modified: false,
                    inProgress: false
                });

                this.init();
            }).catch((e) => {
                alert(e);
            })
        } else {
            this.setState({
                originalSrc: originalSrc,
                modifiedSrc: modifiedSrc,
                language: extension || "json",
                modified: false,
                inProgress: false
            });

            this.init();
        }
    }

    private getParams(query) {
        if (!query) {
            return {};
        }

        return (/^[?#]/.test(query) ? query.slice(1) : query)
            .split("&")
            .reduce((params, param) => {
                let [key, value] = param.split("=");
                params[key] = value ? decodeURIComponent(value.replace(/\+/g, " ")) : "";
                return params;
            }, {});
    }

    private init() {

        amdRequire.config({
            paths: {
                "vs": path.join(appPath, "node_modules/monaco-editor/min/vs")
            },
        })

        // This is needed for electron.
        self.module = undefined;
        self.process.browser = true;

        amdRequire(["vs/editor/editor.main"], () => {
            if (typeof monaco != "undefined") {
                // Possible themes: "vs" (default), "vs-dark", "hc-black".
                const options = {
                    "theme": "vs-dark",
                    "contextmenu": false
                };

                this.editor = this.state.originalSrc && this.state.modifiedSrc ?
                    monaco.editor.createDiffEditor(this.refs["editor"] as HTMLDivElement, options) :
                    monaco.editor.create(this.refs["editor"] as HTMLDivElement, options);

                this.editor.onDidChangeModelContent((event) => {
                    this.handleEditorContentChange();
                });

                // Bind shortcut for saving.
                this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S, () => {
                    this.handleSaveClick();
                });

                this.loadEditor();
            } else {
                alert("monaca editor is undefined.");
            }
        })
    }

    private loadEditor() {
        let promises = [];

        if (this.state.originalSrc) {
            promises.push(this.fetchDataSource(this.state.originalSrc));
        }

        if (this.state.modifiedSrc) {
            promises.push(this.fetchDataSource(this.state.modifiedSrc));
        }

        if (promises.length === 0) {
            // Create an empty editor in case no data source specified.
            this.editor.setModel(monaco.editor.createModel("", this.state.language));
            return;
        }

        monaco.Promise.join(promises).then((r) => {

            if (r.length < 2) {
                this.editor.setModel(monaco.editor.createModel(r[0].responseText, this.state.language));
            } else if (r.length === 2) {
                // Create/Set models for diff editor.
                this.editor.setModel({
                    original: monaco.editor.createModel(r[0].responseText, this.state.language),
                    modified: monaco.editor.createModel(r[1].responseText, this.state.language),
                });
            } else {
                alert("Unexpected response: " + r);
            }
        });
    }

    private destroy() {
        if (typeof this.editor != "undefined") {
            this.editor.destroy();
        }
    }

    private updateDimensions() {
        if (typeof this.editor != "undefined") {
            this.editor.layout();
        }
    }

    private fetchDataSource(dataSource: DataSource) {
        let req = null;

        return new monaco.Promise((c, e, p) => {
            if (dataSource.type === "RAW_CONTENT") {
                req = {
                    responseText: dataSource.data
                };
                c(req);
                return;
            }

            if (!Util.existsSync(dataSource.data)) {
                req = {
                    responseText: ""
                };
                c(req);
                return;
            }
            req = new XMLHttpRequest();
            req.onreadystatechange = () => {
                if (req._canceled) { return; }
                if (req.readyState === 4) {
                    if ((req.status >= 200 && req.status < 300) || req.status === 1223) {
                        c(req);
                    } else {
                        e(req);
                    }
                    req.onreadystatechange = () => { };
                } else {
                    p(req);
                }
            };
            req.open("GET", dataSource.data, true);
            req.responseType = "";
            req.send(null);
        }, () => {
            req._canceled = true;
            req.abort();
        });
    }

    handleEditorContentChange() {
        // The versionId identifies file changes. Original value is 1.
        let versionId = this.editor.modifiedEditor ? this.editor.modifiedEditor.model.getAlternativeVersionId() : this.editor.model.getAlternativeVersionId();
        if (!this.state.modified && versionId != 1) {
            this.setState({ modified: true });
        } else if (this.state.modified && versionId === 1) {
            this.setState({ modified: false });
        }
    }

    componentDidMount() {
        window.addEventListener("resize", this.updateDimensions.bind(this));
    }

    componentWillUnmount() {
        this.destroy();
        window.removeEventListener("resize", this.updateDimensions.bind(this));
    }

    handleSaveClick(): Promise<boolean> {
        let fileContent = this.editor.getValue();
        return new Promise<boolean>((resolve) => {
            if (!this.state.modified) {
                return resolve(true);
            }

            this.setState({ inProgress: true });

            if (this.state.language === 'json') {
                // File validation currently only supports json.
                try {
                    // TODO: The editor should allow callers to specify the validation method.
                    const object = JSON.parse(fileContent);
                    if (this.state.modifiedSrc.data.toLowerCase() === config.path.toLowerCase()) {
                        // Just validate the json schema for config for now.
                        resolve(true);
                    } else if (Util.isConfig(this.state.modifiedSrc.data)) {
                        resolve(true);
                    } else if (this.state.modifiedSrc.data.indexOf("namespaceConfig.json") !== -1) {
                        ModelReader.validateNamespace(object);
                        resolve(true);
                    } else {
                        ModelReader.validateObjectDefinition({}, object, this.state.modifiedSrc.data);
                        resolve(true);
                    }
                } catch (e) {
                    alert(e.toString() + ". Please modify your changes.");
                    resolve(false);
                }
            }
        }).then((canSave) => {
            if (!canSave) {
                this.setState({ inProgress: false });
                return false;
            }

            return new Promise<boolean>((resolve) => {
                let fs = require("fs");

                fs.writeFile(this.state.modifiedSrc.data, fileContent, (err) => {
                    if (err) {
                        this.setState({ inProgress: false });
                        return resolve(false);
                    }

                    if (this.state.modified) {
                        ipcRenderer.send("editor-instance-saved-callback", window.location.href);
                    }

                    this.setState({ inProgress: false, modified: false });
                    return resolve(true);
                });
            });
        })
    }

    handleWindowClose(): Promise<boolean> {

        return new Promise<boolean>((resolve, reject) => {
            if (!this.state.modified) {
                resolve(true);
                return;
            }

            remote.dialog.showMessageBox({
                message: "Do you want to save the changes you made: " + this.state.modifiedSrc.data,
                buttons: ["Save", "Don't save", "Cancel"]
            }, (buttonIndex) => {
                switch (buttonIndex) {
                    case 2:
                        resolve(false);
                        break;
                    case 0:
                        this.handleSaveClick().then((saveComplete) => {
                            if (saveComplete) {
                                this.setState({ modified: false });
                                resolve(true);
                            } else {
                                resolve(false);
                            }
                        })

                        break;
                    case 1:
                    default:
                        this.setState({ modified: false });
                        resolve(true);
                }
            });
        })
    }

    renderSaveButton() {
        if (this.state.inProgress) {
            return <RaisedButton style={{ float: "right" }} disabled={true} buttonStyle={{ backgroundColor: "rgb(109, 109, 109)" }} labelPosition="after" label="Save" icon={<CircularProgress size={23} />} />;
        } else {
            return <RaisedButton buttonStyle={{ backgroundColor: "rgb(109, 109, 109)" }} onClick={() => this.handleSaveClick()} style={{ marginLeft: 10, float: "right" }} labelStyle={{ color: "white" }} label="Save" />
        }
    }

    render() {
        return (
            <div style={{ height: "97vh" }}>
                <AppBar
                    title={<span>{(this.state.modifiedSrc ? this.state.modifiedSrc.data : "") + (this.state.modified ? " *" : "")}</span>}
                    style={{ height: 40, backgroundColor: "rgb(48, 48, 48)" }}
                    titleStyle={{ height: 40, lineHeight: 3, fontSize: "13.5px", color: "rgb(189, 189, 189)" }}
                    iconElementLeft={<div />}
                    iconElementRight={null}
                    iconStyleRight={{ marginTop: 0 }}
                />
                <div style={{ height: "calc(100% - 85px)", backgroundColor: 'rgb(48, 48, 48)' }} className="monaco-editor" ref="editor" />
                <div style={{ paddingTop: 10 }}>
                    {this.renderSaveButton()}
                    <RaisedButton style={{ float: "right" }} onClick={() => window.close()} labelStyle={{ color: "white" }} label="Close" backgroundColor={"rgb(109, 109, 109)"} />
                </div>
            </div >);
    }
}

const App = () => (
    <MuiThemeProvider muiTheme={theme}>
        <Editor />
    </MuiThemeProvider>
);


ReactDOM.render(
    <App />,
    document.getElementById("react-app")
);
