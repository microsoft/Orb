//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />

import { ExplorerNodeProps, ExplorerNode } from "../state/state";
import { untracked } from "mobx";
import { remote } from "electron";
import * as m from "Model";
import * as Promise from "bluebird";
import * as path from "path";
import { ModelReader } from "../modelReader/modelReader";
import { StateManager } from "../state/state";
import { ResourceSuggestionDB, ResourceCollections } from "../db/db";
const log = require("loglevel");

export class TreeGenerator {

    public static generateTree(
        namespaceName: string,
        objectPath: string,
        requiredProps?: any,
        parentNode?: ExplorerNodeProps,
        addResourcesToSuggestion = false,
        requiredBaseProps?: any): Promise<ExplorerNodeProps> {

        // expand the resource group node only if there is no parent. i.e. expand the top most resource group by default.
        let shouldExpandResourceGroupeNode = !parentNode;
        let objectContext = { requiredProps: requiredProps, requiredBaseProps: requiredBaseProps };

        return ModelReader.getObjectDefinition(namespaceName, objectPath).then((objectDefinition) => {
            return TreeGenerator.createObjectNode(namespaceName, objectDefinition, objectContext, parentNode)
                .then((root) => {
                    if (shouldExpandResourceGroupeNode) {
                        return TreeGenerator.expandObjectNode(root, addResourcesToSuggestion ? objectContext : null)
                    }
                    else { return root; }
                })
                .then((root) => {
                    return root;
                })
        }).catch((e) => {
            log.error(e);
            throw e;
        });
    };

    public static expandObjectNode(parentNode: ExplorerNodeProps, objectContext?: m.ObjectContext): Promise<ExplorerNodeProps> {
        return new Promise<ExplorerNodeProps>((resolve) => {
            let nodeCache: { [key: string]: ExplorerNodeProps } = {}
            nodeCache[parentNode.node.path] = parentNode;
            let objectDefinition = parentNode.node.objectDefinition;
            objectDefinition.explorerResources.forEach((resource) => {
                if (parentNode.node.isRoot && objectContext) {
                    ResourceSuggestionDB.instance().putSuggestionIfNotExists({
                        url: parentNode.node.objectId + "\\" + resource.relativePath + "." + resource.type,
                        objectContext: objectContext,
                        objectPath: parentNode.node.objectPath,
                        relativePathWithExtension: resource.relativePath + "." + resource.type,
                        namespace: resource.namespace,
                    });
                }

                TreeGenerator.createResourceOrAssociationWithDirectories(
                    parentNode,
                    resource.relativePath,
                    nodeCache,
                    resource,
                    null);
            });

            objectDefinition.contextMenuResources.forEach((resource) => {
                if (parentNode.node.isRoot && objectContext) {
                    ResourceSuggestionDB.instance().putSuggestionIfNotExists({
                        url: parentNode.node.objectId + "\\" + resource.relativePath + "." + resource.type,
                        objectContext: objectContext,
                        objectPath: parentNode.node.objectPath,
                        relativePathWithExtension: resource.relativePath + "." + resource.type,
                        namespace: resource.namespace,
                    });
                }
            });

            if (objectDefinition.original.associations) {
                objectDefinition.original.associations.forEach((association) => {
                    TreeGenerator.createResourceOrAssociationWithDirectories(
                        parentNode,
                        association.relativePath,
                        nodeCache,
                        null,
                        association);
                });
            }

            // sort all children
            for (let nodePath in nodeCache) {
                let nodeToSort = nodeCache[nodePath];
                if (nodeToSort.node.childNodes && nodeToSort.node.childNodes.length > 0) {
                    let sortedChildren = nodeToSort.node.childNodes.sort(TreeGenerator.nodeSorterFunction);
                    nodeToSort.node.childNodes = sortedChildren;
                }
            }

            // Pre-load resource suggestions for inline search.

            ResourceCollections.instance().addResourcesIfNotPresents(parentNode.node.namespace, parentNode.node.objectPath);
            resolve(parentNode);
        });
    }

    /*
    * Expand group nodes ([0..99],[100..199], etc.)
    */
    public static expandGroupNode(parentNode: ExplorerNodeProps, groupLimit: number): Promise<void> {

        return ModelReader.getObjectDefinition(parentNode.node.namespace,
            parentNode.node.objectPath).then((objectDefinition) => {
                // This is a association group object.
                const groupStartIndex = parentNode.node.groupIndexNumber * groupLimit;
                let groupEndIndex = ((parentNode.node.groupIndexNumber + 1) * groupLimit) - 1;
                if (groupEndIndex > parentNode.node.dataToGroupInto.length - 1) {
                    groupEndIndex = parentNode.node.dataToGroupInto.length - 1;
                }

                let promises = [];
                for (let i = groupStartIndex; i <= groupEndIndex; i++) {
                    let requiredProps = parentNode.node.dataToGroupInto[i];
                    promises.push(TreeGenerator.createObjectNode(parentNode.node.namespace, objectDefinition, { requiredProps: requiredProps, requiredBaseProps: parentNode.node.objectContext.requiredBaseProps }, parentNode)
                        .catch((e) => { console.log("Error completing tree under group. "); console.log(e); }));
                }

                Promise.all(promises).then(() => { });
            }).catch((e) => {
                log.error(e);
                throw e;
            });
    }

    public static generateAssociationGroupingNode(
        namespaceName: string,
        objectPath: string,
        parentNode: ExplorerNodeProps,
        dataToGroupInto: any[],
        groupIndexNumber: number,
        groupLimit: number): Promise<ExplorerNodeProps> {

        return new Promise<ExplorerNodeProps>((resolve, reject) => {
            let groupStartIndex = groupIndexNumber * groupLimit;
            if (groupStartIndex > dataToGroupInto.length - 1) {
                // This is not possible, so return without creating a node;
                resolve(null);
                return;
            }
            let groupEndIndex = ((groupIndexNumber + 1) * groupLimit) - 1;
            if (groupEndIndex > dataToGroupInto.length - 1) {
                groupEndIndex = dataToGroupInto.length - 1;
            }

            let name = "[" + groupStartIndex + ".." + groupEndIndex + "]";
            let groupPath = path.join(parentNode.node.path, name);

            let node = new ExplorerNode();
            node.name = name;
            node.displayName = node.name;
            node.path = groupPath;
            node.isAssociationGroupNode = true;
            node.dataToGroupInto = dataToGroupInto;
            node.groupIndexNumber = groupIndexNumber;
            node.namespace = namespaceName;
            node.childNodes = [];
            node.type = "directory";
            node.depthLevel = parentNode.node.depthLevel + 1;
            node.objectPath = objectPath;
            node.objectContext = parentNode.node.objectContext;

            let result = new ExplorerNodeProps();
            result.node = node;

            parentNode.node.childNodes.push(result);
            resolve(result)
        });
    }

    public static addResourcesToContextMenu(
        menu: Electron.Menu,
        resources: m.Resource[],
        openHandler: (r: m.Resource) => void,
        getSublabel: (r: m.Resource) => string) {

        // the resource relative path can contain many directories.
        // for example: Foo\bar\a.link.
        // in this case Sub menus must be created such that the menu flow looks like Foo->Bar->a
        // use the cache to keep track of submenus along the path to the leaf menu items.
        // this process is very similar to the treeGenerator expanding an object node.
        if (resources && resources.length > 0) {
            let subMenuCache = {};

            resources.forEach((r) => {
                let basePath = "\\";
                let pathSplits = r.relativePath.split("\\");
                let parentMenu = menu;
                for (let i = 0; i < pathSplits.length; i++) {
                    if (i == (pathSplits.length - 1)) {
                        //leaf menu item.
                        let sublabel: string = null;
                        if (getSublabel) {
                            sublabel = getSublabel(r);
                        }

                        parentMenu.append(
                            new remote.MenuItem(
                                {
                                    label: pathSplits[i],
                                    click: () => openHandler(r),
                                    sublabel: sublabel
                                }))
                    } else {

                        // this is a subMenu (directory)
                        let subMenuPath = path.join(basePath, pathSplits[i]);
                        let newParentMenu;

                        if (subMenuPath in subMenuCache) {
                            newParentMenu = subMenuCache[subMenuPath]
                        } else {
                            newParentMenu = new remote.Menu();
                            subMenuCache[subMenuPath] = newParentMenu;
                            parentMenu.append(
                                new remote.MenuItem(
                                    {
                                        label: pathSplits[i],
                                        submenu: newParentMenu
                                    }))
                        }

                        parentMenu = newParentMenu;
                        basePath = subMenuPath;
                    }
                }
            })

            menu.append(
                new remote.MenuItem(
                    {
                        type: 'separator',
                        label: 'sep1'
                    }
                )
            );
        }
    }

    /**
     * Gets the display name for an object node in the explorer menu
     * @param objectContext Context of the object to be displayed
     * @param objectDefinition Definition of the object to be displayed
     * @param parentNode Parent node (if any) of the object to be displayed
     */
    private static getObjectNodeDisplayName(objectContext: m.ObjectContext, objectDefinition: m.ParsedObjectDefinition, parentNode?: ExplorerNodeProps): string {
        let objectPath = objectDefinition.original.path;
        let rootName;
        let objectKey = "";

        // If a display name is defined, perform subsitutions and return display name
        if (objectDefinition.original.displayName) {

            // Pulling the raw display name from the object's model
            rootName = objectDefinition.original.displayName;

            // Substituting requiredProperties defined in the display name
            for (let requiredProp in objectContext.requiredProps) {
                let propRegex = new RegExp(`{${requiredProp}}`, "gi");
                rootName = rootName.replace(propRegex, objectContext.requiredProps[requiredProp]);
            }

            // Substituting requiredBaseProperties defined in the display name
            for (let requiredBaseProp in objectContext.requiredBaseProps) {
                let propRegex = new RegExp(`{${requiredBaseProp}}`, "gi");
                rootName = rootName.replace(propRegex, objectContext.requiredBaseProps[requiredBaseProp]);
            }
        } else {

            // Otherwise, use previous display name generation logic
            if (!objectDefinition.original.key) {
                rootName = objectPath;
            } else {
                if (!(objectDefinition.original.key in objectContext.requiredProps)) {
                    throw "Object key " + objectDefinition.original.key + " not found for object " + objectDefinition.original.path;
                }

                objectKey = objectContext.requiredProps[objectDefinition.original.key];

                if (!objectKey) {
                    throw "Object Id not provided for non-root node";
                }
                if (parentNode) {
                    rootName = objectKey;
                } else {
                    rootName = path.join(objectPath, objectKey);
                }
            }
        }

        return rootName;
    }

    private static createObjectNode(
        namespaceName: string,
        objectDefinition: m.ParsedObjectDefinition,
        objectContext?: m.ObjectContext,
        parentNode?: ExplorerNodeProps): Promise<ExplorerNodeProps> {

        return new Promise<ExplorerNodeProps>(resolve => {
            let objectPath = objectDefinition.original.path;
            let rootName;
            let objectKey = "";
            if (!objectDefinition.original.key) {
                rootName = objectPath;
            } else {
                if (!(objectDefinition.original.key in objectContext.requiredProps)) {
                    throw "Object key " + objectDefinition.original.key + " not found for object " + objectDefinition.original.path;
                }

                objectKey = objectContext.requiredProps[objectDefinition.original.key];

                if (!objectKey) {
                    throw "Object Id not provided for non-root node";
                }
                if (parentNode) {
                    rootName = objectKey;
                } else {
                    rootName = path.join(objectPath, objectKey);
                }
            }

            let rootPath;
            if (parentNode) {
                rootPath = path.join(parentNode.node.path, rootName);
            } else {
                rootPath = path.join(namespaceName, rootName);
            }

            let node = new ExplorerNode();
            node.objectId = path.join(namespaceName, objectPath, objectKey);
            node.name = this.getObjectNodeDisplayName(objectContext, objectDefinition);
            node.displayName = node.name;
            node.path = rootPath;
            node.childNodes = [];
            node.type = "object";
            node.relativePath = "";

            if (!parentNode) {
                node.setChildrenObservables(true, false);
            }
            node.depthLevel = parentNode ? parentNode.node.depthLevel + 1 : 0;
            node.namespace = namespaceName;
            node.objectPath = objectPath;
            node.objectContext = objectContext;
            node.objectDefinition = objectDefinition;
            node.isObjectNode = true;

            let root = new ExplorerNodeProps();
            root.node = node;

            if (parentNode) {
                parentNode.node.childNodes.push(root);
            } else {
                root.node.isRoot = true;
            }

            resolve(root);
        });
    }

    private static createResourceOrAssociationWithDirectories(
        root: ExplorerNodeProps,
        relativePath: string,
        nodeCache: { [key: string]: ExplorerNodeProps },
        resource: any,
        association: any) {

        let pathSplits = relativePath.split("\\");
        let basePath = root.node.path;
        let parentNode = root;

        for (let i = 0; i < pathSplits.length; i++) {
            if (i == (pathSplits.length - 1)) {
                // leaf resource, association
                let node = new ExplorerNode();
                node.name = resource ? pathSplits[i] + "." + resource.type : pathSplits[i];
                node.displayName = node.name;
                node.path = path.join(basePath, node.name);
                node.childNodes = [];
                node.type = resource ? "resource" : "association";
                node.depthLevel = parentNode.node.depthLevel + 1;
                node.resource = resource;
                node.association = association;
                node.namespace = root.node.namespace;
                node.objectPath = root.node.objectPath;
                node.objectContext = root.node.objectContext;
                node.objectDefinition = root.node.objectDefinition;
                node.objectId = root.node.objectId;
                node.relativePath = path.join(parentNode.node.relativePath, node.name);
                let leaf = new ExplorerNodeProps();
                leaf.node = node;

                parentNode.node.childNodes.push(leaf);
            } else {

                // directory
                let dirPath = path.join(basePath, pathSplits[i]);
                parentNode = TreeGenerator.getOrCreateDirectoryNode(root, basePath, dirPath, pathSplits[i], nodeCache);
                basePath = dirPath;
            }
        }
    }

    private static getOrCreateDirectoryNode(
        root: ExplorerNodeProps,
        basePath: string,
        fullPath: string,
        name: string,
        nodeCache: { [key: string]: ExplorerNodeProps }) {
        if (fullPath in nodeCache) {
            let dirNode = nodeCache[fullPath];
            if (dirNode.node.type !== "directory") {
                throw "Same path specified for resource and directory. Path: " + dirNode.node.path + " Type: " + dirNode.node.type;
            }

            return dirNode;
        }
        let parentNode = nodeCache[basePath];
        if (!parentNode) {
            throw "Could not find parent node in Cache. Something went wrong in Tree Generation.";
        }

        let node = new ExplorerNode();
        node.name = name;
        node.displayName = name;
        node.path = fullPath;
        node.childNodes = [];
        node.type = "directory";
        node.depthLevel = parentNode.node.depthLevel + 1;
        node.namespace = root.node.namespace;
        node.objectPath = root.node.objectPath;
        node.objectContext = root.node.objectContext;
        node.objectDefinition = root.node.objectDefinition;
        node.objectId = root.node.objectId;
        node.isResourceGroupDirectoryNode = true;
        node.relativePath = path.join(parentNode.node.relativePath, node.name);

        let dirNode = new ExplorerNodeProps();
        dirNode.node = node;

        parentNode.node.childNodes.push(dirNode);
        nodeCache[fullPath] = dirNode;
        return dirNode;
    }

    /*
    * Sort as follows: Directories first, then associations, then leafs.
    * Sort by alphabetical order within the same type.
    */
    private static nodeSorterFunction(a: ExplorerNodeProps, b: ExplorerNodeProps): number {
        let sortByType = TreeGenerator.nodeTypeComparer(a, b);
        if (sortByType === 0) {
            return TreeGenerator.nodeNameComparer(a, b);
        }
        return sortByType;
    }

    private static nodeTypeComparer(a: ExplorerNodeProps, b: ExplorerNodeProps): number {
        if (a.node.type === b.node.type) {
            return 0;
        }
        if (b.node.type === "resource") {
            return -1;
        }
        if (b.node.type === "directory" || b.node.type === "object") {
            return 1;
        }
        if (b.node.type === "association") {
            if (a.node.type === "directory" || a.node.type === "object") {
                return -1;
            } else {
                return 1;
            }
        }

    }

    private static nodeNameComparer(a: ExplorerNodeProps, b: ExplorerNodeProps): number {
        let nameA = a.node.name.toUpperCase();
        let nameB = b.node.name.toUpperCase();
        if (nameA < nameB) {
            return -1;
        }

        if (nameA > nameB) {
            return 1;
        }

        // names must be equal
        return 0;
    }

    public static reloadAllTrees() {
        const promises = [];
        promises.push(ResourceSuggestionDB.instance().destroy());
        promises.push(ResourceCollections.instance().destroy());

        Promise.all(promises).then(() => {
            ModelReader.clearObjectDefinitionCache();
            ModelReader.clearNamespaceCache();
            let explorerState = StateManager.getStore().sideBar.inner.explorer.inner;
            explorerState.trees.forEach(tree => {
                let rootNode = tree.root.node;
                TreeGenerator.generateTree(
                    rootNode.namespace, rootNode.objectPath, rootNode.objectContext.requiredProps, null, true, rootNode.objectContext.requiredBaseProps)
                    .then((root) => {
                        root.node.setChildrenObservables(rootNode.childrenVisible, false);
                        tree.setRoot(root);
                    });
            });
        });
    }
}