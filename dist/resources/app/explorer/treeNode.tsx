//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />

import * as React from "react";
import { ExplorerNodeProps, ExplorerNode } from "../state/state";
import ListItem from "material-ui/List/ListItem";
import { observer } from "mobx-react";
import { action } from "mobx";
import FontIcon from "material-ui/FontIcon";
import { KustoIcon } from "../svgIcons/KustoIcon";
import ActionHome from "material-ui/svg-icons/action/home";
import { Kusto } from "../data/kusto";
import { KustoData } from "../data/kustoData";
import * as m from "Model";
import * as path from "path";
import { StateManager, Constants, Map, TabRequest } from "../state/state";
import { TreeGenerator } from "../Explorer/treeGenerator";
import { remote } from "electron";
import { ModelReader } from "../modelReader/modelReader";
import { ResourceProviderSelector } from "../extensions/ResourceProviders/ResourceProviderSelector";
import { ResourceProviderHelper } from "../extensions/ResourceProviders/helper";
import { IResourceProvider, HandleResourceResult } from "../extensions/ResourceProviders/ResourceProvider";
import { IDataProviderResourceExternalContext } from "../extensions/dataProviders/dataProvider";
import { DataProviderSelector } from "../extensions/dataProviders/dataProviderSelector";
import { EditorCtrl } from "../editor/editorCtrl";
import { Repo } from "../repo/repo";
import { Util } from "../util/util";
import { ConfigUtil } from "../config/configUtil";
import InlineEdit from "../inlineEdit/inlineEdit";
import { InlineSearch } from "./inlineSearch";
import { ResourceCollections } from "../db/db";
let log = require("loglevel");

@observer
export class TreeNode extends React.Component<ExplorerNodeProps, any> {

    private contextMenu: Electron.Menu;

    constructor(props) {
        super(props);

        this.handleClick = this.handleClick.bind(this);
        this.getLeftIcon = this.getLeftIcon.bind(this);
        this.handleRemoveButton = this.handleRemoveButton.bind(this);
        this.handleContextMenu = this.handleContextMenu.bind(this);
        this.handleEditComplete = this.handleEditComplete.bind(this);
        this.handleEditCancel = this.handleEditCancel.bind(this);
    }

    public componentWillMount() {
        const node = this.props.node;

        // Loads resource suggestions for associations.
        if (node.type === "object") {
            ResourceCollections.instance().addResourcesIfNotPresents(node.namespace, node.objectPath);
        }
    }

    public renderNode() {
        const innerDivStyle = this.props.node.isRoot ? {
            fontFamily: "Roboto, sans-serif",
            fontSize: "13.5px",
            paddingTop: "10px",
            paddingLeft: "24px",
            paddingBottom: "10px",
            backgroundColor: "rgb(64, 64, 64)",
        } : { marginLeft: 20 * (this.props.node.depthLevel + 1), fontSize: "13.5px", padding: 4 };

        if (this.props.node.isInEdit) {
            return (
                <InlineEdit
                    editingByDefault={true}
                    value={this.props.node.displayName}
                    onFinish={this.handleEditComplete}
                    onCancel={this.handleEditCancel}
                    change={(state) => { this.setState(state); }}
                    propName={"fileName"}
                    className={"inline-editable"}
                    style={{
                        paddingRight: 25,
                        paddingLeft: 20 * (1 + this.props.node.depthLevel) + 4,
                        width: "inherit",
                        right: "10px",
                        whiteSpace: "nowrap",
                        zIndex: 2,
                        height: 24,
                        paddingTop: 4,
                        paddingBottom: 4,
                        alignItems: "center",
                        display: "flex",
                    }}
                    validate={(text) => {
                        return text !== "";
                    }}
                    classInvalid={"inline-invalid"} />
            );
        }

        return (
            <ListItem
                onClick={this.handleClick}
                onContextMenu={this.handleContextMenu}
                leftIcon={this.getLeftIcon()}
                primaryText={
                    <div style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        zIndex: 1,
                    }}>
                        {this.props.node.name !== this.props.node.displayName ?
                            this.props.node.displayName : this.props.node.name}
                    </div>
                }
                innerDivStyle={innerDivStyle}
            >
            </ListItem>
        );
    }

    public render() {
        let childNodes = <div></div>;
        if (this.hasVisibleChildren()) {
            childNodes =
                <div>
                    {
                        this.props.node.childNodes.map((v, i) => {
                            return <TreeNode key={v.node.path} node={v.node}></TreeNode>;
                        })
                    }
                </div>;
        }

        const exploreState = StateManager.getStore().sideBar.inner.explorer.inner;
        const closeButton = this.props.node.isRoot ?
            (<span
                title={"Remove Object"} className={"explorerCloseButton"}
                onClick={this.handleRemoveButton}>
                <FontIcon
                    className="fa fa-times"
                    style={{ fontSize: 15 }}
                    aria-hidden="true"
                />
            </span>) : null;

        let directory = this.props.node.relativePath;
        if (this.props.node.type === "directory") {
            directory = directory + "\\";
        }

        return (
            <div>
                <div className={this.props.node.isRoot ? "explorerRoot" : "explorerNode"}
                    style={this.props.node.isRoot ?
                        {
                            height: "36px",
                            position: "relative",
                            background: "rgb(64, 64, 64)",
                            display: "flex",
                            alignItems: "center",
                            width: "100%",
                        } : {
                            position: "relative",
                            display: "flex",
                            alignItems: "center",
                            width: "100%",
                        }}
                    title={(this.props.node.resource) ? this.props.node.resource.description : null}>
                    <InlineSearch
                        onVisibleChange={(isVisible: boolean) => {
                            exploreState.setInlineSearchVisible(isVisible);
                        }}
                        disable={this.props.node.type === "resource" ||
                            this.props.node.type === "association" ||
                            this.props.node.isAssociationGroupNode}
                        displayName={this.props.node.name + "\\"}
                        directory={directory}
                        namespace={this.props.node.namespace}
                        objectContext={this.props.node.objectContext}
                        objectPath={this.props.node.objectPath}
                        depth={this.props.node.depthLevel}
                        closeButton={
                            closeButton
                        }>
                        {this.renderNode()}
                    </InlineSearch>
                </div>
                {childNodes}
            </div >
        );
    }

    handleEditComplete(text) {
        this.props.node.displayName = text;
        this.props.node.setInEdit(false);
    }

    handleEditCancel() {
        this.props.node.setInEdit(false);
    }

    handleRemoveButton() {
        StateManager.getStore().sideBar.inner.explorer.inner.removeObjectTree(this.props.node.path);
    }

    hasChildren(): boolean {
        return this.props.node.childNodes && this.props.node.childNodes.length > 0;
    }

    hasVisibleChildren(): boolean {
        return this.props.node.childrenVisible && this.hasChildren();
    }

    handleClick(event: React.MouseEvent<any>) {
        if (this.props.node.type === "directory" || this.props.node.type === "object") {
            this.handleDirectoryClick();
        } else if (this.props.node.type === "association") {
            this.handleAssociationClick();
        } else if (this.props.node.type === "resource") {
            this.handleResourceClick(event);
        }
    }

    handleDirectoryClick() {
        if (!this.props.node.childrenVisible &&
            !this.props.node.childrenComputingInProgress &&
            this.props.node.childNodes.length == 0) {

            if (this.props.node.isAssociationGroupNode) {
                // this is a group node that should be expanded.
                this.props.node.setChildrenComputingInProgress(true);
                TreeGenerator.expandGroupNode(this.props, StateManager.getStore().sideBar.inner.explorer.inner.associationGroupLimit)
                    .then(() => this.props.node.setChildrenObservables(true, false));

            } else if (this.props.node.isObjectNode) {
                this.props.node.setChildrenComputingInProgress(true);
                TreeGenerator.expandObjectNode(this.props, this.props.node.objectContext)
                    .then(() => this.props.node.setChildrenObservables(true, false));
            }
        }
        else {
            this.props.node.toggleChildrenVisible();
        }
    }

    handleAssociationClick() {
        if (!this.props.node.childrenVisible && !this.props.node.childrenComputingInProgress) {
            this.beginDataQueryAndBuildAssociation();
        } else if (this.props.node.childrenComputingInProgress) {
            // cancel the request.
            this.props.node.setChildrenObservables(false, false);
        } else {
            this.props.node.toggleChildrenVisible();
            // Empty out child nodes for now.
            // TODO: perhaps add some caching layer.
            this.props.node.childNodes = [];
        }
    }

    handleResourceClick(event: React.MouseEvent<any>) {
        this.openResource(this.props.node.resource, event, ConfigUtil.GetSetting("alwaysOpenInNewTab"));
    }

    openResource(resource: m.Resource, event?: React.MouseEvent<any>, openFirstRequestInNewTab = false) {
        return ResourceProviderHelper.openResource(resource, this.props.node.objectContext, this.props.node.objectDefinition, "ExplorerTree", event, this.props.node.path, false, openFirstRequestInNewTab);
    }

    // TODO: Create association provider just like resource provider.
    // This interface will be required once we have multiple association providers.
    beginDataQueryAndBuildAssociation() {
        if (!ResourceProviderHelper.validateDateTime()) {
            return;
        }

        this.props.node.setChildrenComputingInProgress(true);
        let profileNamespaceName = this.props.node.namespace;
        let state = StateManager.getStore().sideBar.inner.explorer.inner;
        let absoluteTime = state.dateTimeWidget.inner.getAbsoluteTimeSynchronized();
        let timeAgoText = state.dateTimeWidget.inner.timeAgoText;
        let isRelativeMode = state.dateTimeWidget.inner.isRelativeMode;

        let externalContext: IDataProviderResourceExternalContext = {
            startTime: absoluteTime.startTime,
            endTime: absoluteTime.endTime,
            timeAgoText: timeAgoText,
            isRelativeMode: isRelativeMode
        };

        let provider = DataProviderSelector.getDataProvider(this.props.node.association);
        if (!provider || !provider.getAssociationData) {
            throw "DataProvider does not support getting association data."
        }

        provider.getAssociationData(this.props.node.association, this.props.node.objectContext, this.props.node.objectDefinition, externalContext, state.associationLimit + 1)
            .then((data) => {
                if (data.length > 0 && this.props.node.childrenComputingInProgress) {
                    var state = StateManager.getStore().sideBar.inner.explorer.inner;
                    if (data.length > state.associationLimit) {
                        // TODO: Display warning or create sub groups when limit is hit.
                        log.info("Association limit hit. Not all values will be shown as a result.");
                    }

                    this.buildAssociationTreeFromData(data);

                } else {
                    // 0 results found.
                    this.props.node.setChildrenComputingInProgress(false);
                }
            })
            .catch((e) => { log.error(e); })
            .finally(() => this.props.node.setChildrenComputingInProgress(false));
    }

    buildAssociationTreeFromData(data: any[]) {
        var namespaceName =
            this.props.node.association.associatedObjectNamespace ? this.props.node.association.associatedObjectNamespace : this.props.node.namespace;

        var requiredBaseProps = undefined;
        if (namespaceName === this.props.node.namespace) {
            requiredBaseProps = this.props.node.objectContext.requiredBaseProps;
        }

        var state = StateManager.getStore().sideBar.inner.explorer.inner;
        var groupLimit = state.associationGroupLimit;

        if (data.length > groupLimit) {
            // Create multiple group object like [0..99],[100..199], etc based on the limits defined.
            this.buildGroupedAssociationTreeFromData(namespaceName, data);
        } else {
            Promise.all(data.map((row, i) => {
                return TreeGenerator.generateTree(namespaceName, this.props.node.association.associatedObjectPath, row, this.props, false, requiredBaseProps)
                    .catch((e) => {
                        log.error("Error populating tree for association result {0}:{1}".format(row.toString(), e.toString()));
                    });
            }
            )).then(() => {
                this.props.node.setChildrenObservables(true, false);
            });
        }
    }

    buildGroupedAssociationTreeFromData(namespaceName: string, data: any[]) {
        var state = StateManager.getStore().sideBar.inner.explorer.inner;
        var groupLimit = state.associationGroupLimit;
        var totalLimit = state.associationLimit;

        var groupCount;
        if (data.length >= totalLimit) {
            // remove the last entry that is used to detect crossing of limit.
            groupCount = totalLimit / groupLimit;
        } else {
            groupCount = Math.floor((data.length / groupLimit) + 1);
        }

        var promises = [];
        for (var i = 0; i < groupCount; i++) {
            promises.push(
                TreeGenerator.generateAssociationGroupingNode(namespaceName, this.props.node.association.associatedObjectPath, this.props, data, i, groupLimit));
        }

        Promise.all(promises).then(() => {
            this.props.node.setChildrenObservables(true, false);
        });
    }

    getLeftIcon(): React.ReactElement<any> {
        let result = null;
        if (this.props.node.isRoot) {
            const iconStyle = {
                fontSize: "14px",
                color: "rgb(218,216,216)",
                lineHeight: "16px",
                textAlign: "center",
                width: "16px",
                margin: "5px",
                top: "4px",
            };

            if (this.hasVisibleChildren()) {
                result = (
                    <FontIcon
                        className="fa fa-caret-down"
                        style={iconStyle}
                    />
                );
            } else {
                result = (
                    <FontIcon
                        className="fa fa-caret-right"
                        style={iconStyle}
                    />
                );
            }

            return result;
        }

        if (this.props.node.childrenComputingInProgress) {
            const spinnerStyle = {
                margin: "2px",
                fontSize: "14px",
                left: "-16px",
                color: this.props.node.type === "directory"
                    || this.props.node.type === "object" ? "rgb(218,216,216)" : "#96a6f8",
                top: "1px",
                lineHeight: "16px",
                height: "",
                width: "16px",
                textAlign: "center",
            };

            result = (
                <FontIcon
                    className="fa fa-circle-o-notch fa-spin fa-3x fa-fw"
                    style={spinnerStyle}
                />
            );
            return result;
        }

        if (this.props.node.type === "directory" || this.props.node.type === "object") {
            const iconStyle = {
                margin: "2px",
                fontSize: "14px",
                left: "-16px",
                color: "rgb(218,216,216)",
                top: "1px",
                lineHeight: "16px",
                height: "",
                width: "16px",
                textAlign: "center",
            };

            if (this.hasVisibleChildren()) {
                result = (
                    <FontIcon
                        className="fa fa-caret-down"
                        style={iconStyle}
                    />
                );
            }
            else {
                result = (
                    <FontIcon
                        className="fa fa-caret-right"
                        style={iconStyle}
                    />
                );
            }
        } else if (this.props.node.type === "association") {
            const iconStyle = {
                margin: "2px",
                fontSize: "14px",
                left: "-16px",
                color: "#96a6f8",
                top: "1px",
                lineHeight: "16px",
                height: "",
                width: "16px",
                textAlign: "center"
            }

            if (this.hasVisibleChildren()) {
                result = (
                    <FontIcon
                        className="fa fa-caret-down"
                        style={iconStyle}
                    />
                );
            } else {
                result = (
                    <FontIcon
                        className="fa fa-caret-right"
                        style={iconStyle}
                    />
                );
            }
        }

        return result;
    }

    // Handle right-click
    handleContextMenu(event: React.MouseEvent<any>) {
        event.preventDefault();

        if (this.props.node.type === "resource") {
            if (!this.props.node.contextMenuCreated || !this.contextMenu) {
                this.contextMenu = ResourceProviderHelper.createResourceContextMenu(
                    this.props.node.resource,
                    this.props.node.objectDefinition,
                    this.props.node.objectContext);
                this.props.node.contextMenuCreated = true;
            }

            this.contextMenu.popup({});
            // Don't cache the context menu since the resource handlers can customize these at any point.
            this.contextMenu = null;

        } else if (this.props.node.type === "object") {
            if (!this.props.node.contextMenuCreated || !this.contextMenu) {
                this.createObjectNodeContextMenu();
                if (this.props.node.isRoot) {
                    this.contextMenu.append(new remote.MenuItem(
                        {
                            label: "Rename",
                            click: () => {
                                this.props.node.setInEdit(true);
                            },
                        }));
                }
                this.props.node.contextMenuCreated = true;
            }

            this.contextMenu.popup({});
        } else if (this.props.node.type === "directory" && this.props.node.isResourceGroupDirectoryNode) {
            if (!this.props.node.contextMenuCreated || !this.contextMenu) {
                this.createResourceGroupDirectoryContextMenu();
                this.props.node.contextMenuCreated = true;
            }

            this.contextMenu.popup({});
        }
    }

    addContextMenuToObjectNode() {
        const currNamespace = this.props.node.namespace;
        const currPath = this.props.node.objectPath;
        const sideBarState = StateManager.getStore().sideBar.inner;

        let subMenu = new remote.Menu();
        this.props.node.objectDefinition.filePaths.forEach((filePath) => {
            let url = Constants.editorUrl.format("", "", filePath, "", "", "");

            EditorCtrl.instance().appendEditorOption(subMenu, url, filePath, path.basename(filePath), null, () => {
                sideBarState.edit.inner.refreshChangeList();
                TreeGenerator.reloadAllTrees();
            })

        });

        this.contextMenu.append(
            new remote.MenuItem(
                {
                    label: "Edit",
                    submenu: subMenu
                })
        );

        if (!this.props.node.isRoot) {
            this.contextMenu.append(new remote.MenuItem(
                {
                    label: "Pin to Explorer",
                    click: () => {
                        let explorerState = sideBarState.explorer.inner;
                        TreeGenerator.generateTree(currNamespace, currPath, this.props.node.objectContext.requiredProps, null, true, this.props.node.objectContext.requiredBaseProps)
                            .then((root) => {
                                let position = this.getPosition();
                                explorerState.addObjectTree(root, position);
                            }).catch((e) => {
                                log.error(e);
                            });
                    },
                }));
        } else {
            this.contextMenu.append(new remote.MenuItem(
                {
                    label: "Remove All Objects",
                    click: () => {
                        let explorerState = sideBarState.explorer.inner;
                        explorerState.removeAll();
                    }
                }));

            this.contextMenu.append(new remote.MenuItem(
                {
                    label: "Remove Other Objects",
                    click: () => {
                        let explorerState = sideBarState.explorer.inner;
                        explorerState.trees.slice().forEach((tree) => {
                            if (tree.root.node.path != this.props.node.path) {
                                explorerState.removeObjectTree(tree.root.node.path);
                            }
                        })
                    }
                }));
        }
    }

    createResourceGroupDirectoryContextMenu() {
        this.contextMenu = remote.Menu.buildFromTemplate([
            {
                label: 'Open all',
                click: () => TreeNode.openAllResourcesUnderResourceGroup(this.props.node),
            }]);
    }

    createObjectNodeContextMenu() {
        this.contextMenu = remote.Menu.buildFromTemplate([]);
        TreeGenerator.addResourcesToContextMenu(
            this.contextMenu,
            this.props.node.objectDefinition.contextMenuResources,
            (r) => this.openResource(r, null, true),
            null);

        if (this.props.node.type === "object") {
            this.addContextMenuToObjectNode();
        }
    }

    getPosition() {
        let explorerState = StateManager.getStore().sideBar.inner.explorer.inner;
        let res = 0;
        explorerState.trees.forEach((tree, index) => {
            if (this.props.node.path.startsWith(tree.root.node.path)) {
                res = index;
            }
        })

        return res;
    }

    static openAllResourcesUnderResourceGroup(node: ExplorerNode) {
        if (node.childNodes) {
            node.childNodes.forEach(n => {
                if (n.node.type === "resource") {
                    ResourceProviderHelper.openResource(n.node.resource, n.node.objectContext, n.node.objectDefinition, "ExplorerTree", null, n.node.path, false, true);
                } else if (n.node.type === "directory" && n.node.isResourceGroupDirectoryNode) {
                    TreeNode.openAllResourcesUnderResourceGroup(n.node);
                }
            });
        }
    }
}