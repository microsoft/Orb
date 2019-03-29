//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />

import * as React from "react";
import { Util } from "../util/util";
import { Collapse } from "../collapse/collapse";
import * as path from "path";
import { FileItem } from "./fileItem";
import InlineEdit from "../inlineEdit/inlineEdit";
import { StateManager } from "../state/state";
import { Repo, GitFile } from "../repo/repo";
import { remote, shell } from "electron";
import { ModelReader } from "../modelReader/modelReader";
import { TreeGenerator } from "../Explorer/treeGenerator";
import * as Promise from "bluebird";
const log = require("loglevel");

interface NewFile {
    originalFile: GitFile,
    modifiedFile: GitFile
}

interface Props {
    parentDir?: any,
    directory: string,
    style?: Object,
    innerDivStyle?: Object
}

interface State {
    isCreatingNewFile?: boolean;
    isCreatingNewFolder?: boolean;
    originalFile?: GitFile;
    newFiles?: Array<NewFile>;
}

export class FileNode extends React.Component<Props, State>  {
    private isDir: boolean;
    private dir: string;
    private contextMenu: Electron.Menu;
    private style: Object;
    private childStyle: Object;
    private defaultName = "";
    constructor(props) {
        super(props);
        this.renderChild = this.renderChild.bind(this);
        this.renderCreatingNewFile = this.renderCreatingNewFile.bind(this);
        this.renderCreatingNewFolder = this.renderCreatingNewFolder.bind(this);
        this.handleFolderContextMenuClick = this.handleFolderContextMenuClick.bind(this);
        this.validInput = this.validInput.bind(this);
        this.handleNewFileClick = this.handleNewFileClick.bind(this);
        this.handleFileCreationFinish = this.handleFileCreationFinish.bind(this);
        this.handleFileCreationCancel = this.handleFileCreationCancel.bind(this);
        this.handleNewFolderClick = this.handleNewFolderClick.bind(this);
        this.handleFolderCreationFinish = this.handleFolderCreationFinish.bind(this);
        this.handleFolderCreationCancel = this.handleFolderCreationCancel.bind(this);
        this.refreshCurrentDir = this.refreshCurrentDir.bind(this);
        this.refreshParentDir = this.refreshParentDir.bind(this);
        this.handleFolderDelete = this.handleFolderDelete.bind(this);
        this.handleFileDelete = this.handleFileDelete.bind(this);
        if (path.extname(this.props.directory) === "") {
            this.dir = this.props.directory;
            this.isDir = true;
        } else {
            this.dir = path.dirname(this.props.directory);
            this.isDir = false;
        }
        this.style = this.props.style ? Object.assign({}, this.props.style, { paddingLeft: this.props.style["paddingLeft"] + 10 }) : null;
        this.childStyle = this.props.style ? Object.assign({}, this.props.style, { paddingLeft: this.props.style["paddingLeft"] + 20 }) : null;
        this.state = {
            isCreatingNewFile: false,
            originalFile: null,
            newFiles: []
        }
    }

    refreshCurrentDir() {
        (this.refs["dir"] as any).loadLazyContent();
    }

    refreshParentDir() {
        this.props.parentDir.loadLazyContent();
    }

    renderChild(): Promise<any> {
        return Util.readDir(this.props.directory).map((file: string, index) => {
            if (Util.isConfig(file.toString())) {
                return;
            }

            let directory = path.join(this.props.directory, file);
            return (<FileNode parentDir={this.refs["dir"]} style={this.style} innerDivStyle={this.props.innerDivStyle} key={directory} directory={directory} />)
        })
    }

    handleNewFileClick(file?: GitFile) {
        this.setState({ isCreatingNewFile: true, originalFile: file });
        if (this.refs['dir']) {
            (this.refs['dir'] as any).setState({ open: true });
        }
    }

    handleFileCreationFinish(fileName) {
        let filePath = path.join(this.dir, fileName);
        if (path.extname(filePath) !== ".json") {
            log.info("Object definition must be a json file.");
            return;
        }

        let isValid = false;
        if (Util.existsSync(filePath)) {
            log.info("A file or folder {0} already exists at this location.".format(fileName));
            return;
        }

        Util.open(filePath).then((fd) => {
            let jsonObj;
            if (this.state.originalFile) {
                jsonObj = require(this.state.originalFile.path);
                if (jsonObj && jsonObj.path) {
                    let objectPath: string = jsonObj.path;
                    jsonObj.path = objectPath.substr(0, objectPath.length - path.basename(objectPath).length)
                        + path.basename(fileName, ".json");
                }
            } else {
                jsonObj = require("./blankTemplate.json")
            }

            return Util.writeFile(filePath, JSON.stringify(jsonObj, null, 2))
                .then(() => {
                    if (this.state.originalFile) {
                        this.refreshParentDir();
                    } else {
                        this.refreshCurrentDir();
                    }

                    this.setState({ originalFile: null });
                }).finally(() => {

                    Util.closeSync(fd);
                })
        }).catch((e) => {
            log.error(e.toString());
            this.handleFileCreationCancel();
        }).finally(() => {
            Repo.instance().gitAdd().then(() => {
                StateManager.getStore().sideBar.inner.edit.inner.refreshChangeList();
            }).catch((e) => {
                log.error(e.toString());
            })
        })
    }

    handleFileCreationCancel() {
        this.setState({ isCreatingNewFile: false });
    }

    handleNewFolderClick() {
        this.setState({ isCreatingNewFolder: true });
        (this.refs['dir'] as any).setState({ open: true });
    }

    handleFolderCreationFinish(folderName) {
        let isValid = false;
        try {
            Util.mkDirSync(path.join(this.dir, folderName));
            isValid = true;
        } catch (e) {
            log.error(e.toString());
        }

        this.setState({ isCreatingNewFolder: false });
        if (!isValid) {
            log.error("Failed to create new folder.");
            return;
        }

        this.refreshCurrentDir();
    }

    handleFolderCreationCancel() {
        this.setState({ isCreatingNewFolder: false });
    }

    validInput(text) {
        if (text === this.defaultName) {
            return false;
        }

        let isValid = !Util.existsSync(path.join(this.dir, text));
        if (!isValid) {
            log.info("A file or folder {0} already exists at this location.".format(text));
        }

        return isValid;
    }

    handleFolderContextMenuClick() {
        if (this.contextMenu == null) {
            this.contextMenu = remote.Menu.buildFromTemplate([
                {
                    label: "New File",
                    click: () => this.handleNewFileClick()
                },
                {
                    label: "New Folder",
                    click: () => this.handleNewFolderClick()
                },
                {
                    label: "Reveal in Explorer",
                    click: () => remote.shell.showItemInFolder(this.dir)
                },
                {
                    type: "separator",
                    label: "sep1"
                },
                {
                    label: "Delete",
                    click: () => this.handleFolderDelete()
                }
            ]);
        }

        this.contextMenu.popup({});
    }

    handleFolderDelete() {
        if (!this.props.parentDir) {
            log.info("Root folder can't be deleted");
            return
        }

        Util.remove(this.dir)
            .catch((e) => {
                log.error(e.toString());
            }).finally(() => {
                this.refreshParentDir();
                StateManager.getStore().sideBar.inner.edit.inner.refreshChangeList();
            });
    }

    handleFileDelete() {
        this.refreshParentDir();
        StateManager.getStore().sideBar.inner.edit.inner.refreshChangeList();
        TreeGenerator.reloadAllTrees();
    }

    renderCreatingNewFile() {
        if (this.state.isCreatingNewFile) {
            return (
                <FileItem
                    style={this.state.originalFile ? this.style : this.childStyle}
                    hideIcon={true}
                    hidePath={true}
                    onEdit={() => { TreeGenerator.reloadAllTrees(); StateManager.getStore().sideBar.inner.edit.inner.refreshChangeList(); }}
                    file={
                        { path: "", name: "", status: "NEW" }
                    } >
                    <div>
                        <p style={{ margin: 0 }}>
                            <InlineEdit
                                editingByDefault={true}
                                value={this.defaultName}
                                onFinish={this.handleFileCreationFinish}
                                onCancel={this.handleFileCreationCancel}
                                change={(state) => { this.setState(state); }}
                                propName={"fileName"}
                                className={"inline-editable"}
                                validate={this.validInput}
                                classInvalid={"inline-invalid"} />
                        </p>
                    </div>
                </FileItem>
            )
        }
    }

    renderCreatingNewFolder() {
        if (this.state.isCreatingNewFolder) {
            return (
                <Collapse style={this.childStyle}
                    innerDivStyle={this.props.innerDivStyle}
                    title={
                        <div>
                            <p style={{ margin: 0 }}>
                                <InlineEdit
                                    editingByDefault={true}
                                    value={this.defaultName}
                                    onFinish={this.handleFolderCreationFinish}
                                    onCancel={this.handleFolderCreationCancel}
                                    change={(state) => { this.setState(state) }}
                                    propName={"fileName"}
                                    className={"inline-editable"}
                                    validate={this.validInput}
                                    classInvalid={"inline-invalid"} />
                            </p>
                        </div>
                    }
                    openByDefault={false}>
                </Collapse>
            )
        }
    }

    render() {
        if (!this.isDir) {
            let fileName = path.basename(this.props.directory);
            return (
                <div>
                    {this.renderCreatingNewFile()}
                    <FileItem
                        hideIcon={true}
                        hidePath={true}
                        enableClone={true}
                        enableEdit={true}
                        enableDelete={true}
                        onDelete={this.handleFileDelete}
                        onEdit={() => { TreeGenerator.reloadAllTrees(); StateManager.getStore().sideBar.inner.edit.inner.refreshChangeList(); }}
                        onClone={this.handleNewFileClick}
                        style={this.style}
                        key={fileName}
                        file={
                            { path: this.props.directory, name: fileName }
                        } />
                </div>)
        }

        return (
            <div>
                <Collapse ref="dir" style={this.style} onContextMenu={this.handleFolderContextMenuClick}
                    innerDivStyle={this.props.innerDivStyle} title={path.basename(this.props.directory)} lazyLoad={this.renderChild} openByDefault={false}>
                    {this.renderCreatingNewFolder()}
                    {this.renderCreatingNewFile()}
                </Collapse>
            </div>
        )
    }
}