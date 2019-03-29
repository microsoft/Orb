//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />

import * as React from "react";
import { Repo, GitFile } from "../repo/repo";
import { ListItem } from "material-ui/List";
import { EditorCtrl } from "../editor/editorCtrl";
import { Constants } from "../state/state";
import { Util } from "../util/util";
import { remote, shell } from "electron";
const log = require("loglevel");

interface Props {
    file: GitFile,
    style?: Object,
    enableEdit?: boolean,
    enableDelete?: boolean,
    enableClone?: boolean,
    onClone?: (originalFile: GitFile) => any,
    onDelete?: () => any,
    onEdit?: () => any,
    hidePath?: boolean,
    hideIcon?: boolean,
    showDiff?: boolean
}

export class FileItem extends React.Component<Props, any> {
    private contextMenu: Electron.Menu;
    constructor(props) {
        super(props);
        this.openEditor = this.openEditor.bind(this);
        this.handleContextMenu = this.handleContextMenu.bind(this);
    }

    openEditor() {
        EditorCtrl.instance().openEditor({
            title: this.props.file.name,
            url: Constants.editorUrl.format("", "", this.props.file.path, "", "", this.props.showDiff && this.props.file.status !== "NEW" ? true : ""),
            onSavedChangesCallback: this.props.onEdit
        });
    }

    handleContextMenu() {
        if (this.contextMenu == null) {
            this.contextMenu = remote.Menu.buildFromTemplate([]);
            if (this.props.enableClone && this.props.onClone) {
                this.contextMenu.append(
                    new remote.MenuItem(
                        {
                            label: "Clone",
                            click: () => {
                                this.props.onClone(this.props.file);
                            }
                        }
                    ));
            }

            if (this.props.enableEdit) {
                EditorCtrl.instance().appendEditorOption(
                    this.contextMenu,
                    Constants.editorUrl.format("", "", this.props.file.path, "", "", this.props.showDiff && this.props.file.status !== "NEW" ? true : ""),
                    this.props.file.name,
                    this.props.showDiff && this.props.file.status !== "NEW" ? "Compare" : "Edit",
                    null,
                    this.props.onEdit);
            }

            this.contextMenu.append(
                new remote.MenuItem(
                    {
                        label: "Reveal in Explorer",
                        click: () => remote.shell.showItemInFolder(this.props.file.path)
                    }
                ));

            if (this.props.enableDelete) {
                this.contextMenu.append(
                    new remote.MenuItem(
                        {
                            type: 'separator',
                            label: 'sep1'
                        }
                    )
                )
                this.contextMenu.append(
                    new remote.MenuItem(
                        {
                            label: "Delete",
                            click: () => {
                                try {
                                    Util.unlinkSync(this.props.file.path);
                                } catch (e) {
                                    log.error("Deletion failed. Error: {0}".format(e.toString()));
                                } finally {
                                    if (this.props.onDelete) {
                                        this.props.onDelete();
                                    }
                                }
                            }
                        }
                    ));
            }
        }

        this.contextMenu.popup({});
    }

    renderLeftIcon(file: GitFile) {
        if (this.props.hideIcon) {
            return null;
        }

        let context = {
            title: "",
            backgroundColor: "",
            symbol: "",
        }

        switch (file.status) {
            case "MODIFIED":
                context = {
                    title: "Modified",
                    backgroundColor: "#1b80b2",
                    symbol: "M"
                }
                break;
            case "NEW":
                context = {
                    title: "New",
                    backgroundColor: "#3c8746",
                    symbol: "N"
                }
                break;
            case "CONFLICTED":
                context = {
                    title: "Conflicted",
                    backgroundColor: "rgb(109, 109, 109)",
                    symbol: "C"
                }
                break;
            case "DELETED":
                context = {
                    title: "Deleted",
                    backgroundColor: "#f44336",
                    symbol: "D"
                }
                break;
            default:
                context = {
                    title: "File",
                    backgroundColor: "rgb(109, 109, 109)",
                    symbol: "F"
                }
        }

        if (file.isProtected) {
            context.title += " (Protected file needs code review)";
            context.backgroundColor = "#b6d83a"
        }

        return (
            <span style={{
                fontFamily: "Roboto, sans-serif",
                fontSize: "70%",
                color: "#fff",
                textAlign: "center",
                borderRadius: ".5em",
                verticalAlign: "bottom",
                backgroundColor: context.backgroundColor,
                marginTop: 10,
                marginBottom: 10,
                left: 5,
                height: 15,
                width: 15
            }} title={context.title}>{context.symbol}</span>
        )
    }

    render() {
        return (
            <ListItem
                style={this.props.style}
                key={this.props.file.path}
                leftIcon={this.renderLeftIcon(this.props.file)}
                onContextMenu={this.handleContextMenu}
                onClick={this.openEditor}
                primaryText={
                    this.props.children ?
                        this.props.children :
                        (<div>
                            <p style={{
                                margin: 0,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap"
                            }}>{this.props.file.name}
                                <span style={
                                    {
                                        opacity: .7,
                                        fontSize: ".9em",
                                        marginLeft: ".8em",
                                        color: "#ccc"
                                    }
                                }>{!this.props.hidePath ? this.props.file.path : null}</span>
                            </p>
                        </div>)
                }
                innerDivStyle={
                    {
                        fontFamily: "Roboto, sans-serif",
                        fontSize: 13.5,
                        paddingTop: 10,
                        paddingLeft: this.props.hideIcon ? 15 : 40,
                        paddingBottom: 10,
                    }
                }
            />)
    }
}