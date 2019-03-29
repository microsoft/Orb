//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../../typings/index.d.ts" />

import * as m from "Model";
import * as React from "react";
import { IResourceProvider, IResourceHandleContext, ContentManagerSetUrl, HandleResourceResult } from "./ResourceProvider";
import { ResourceEditorCtrl } from "../../resourceEditor/resourceEditorCtrl";
import { IResourceExternalContext } from "../commonInterfaces";
import * as Promise from "bluebird";
import { StateManager, TabRequest, TabResourceState } from "../../state/state"
import { ResourceProviderSelector } from "../ResourceProviders/ResourceProviderSelector";
import { DataProviderSelector } from "../DataProviders/DataProviderSelector";
import * as path from "path";
import { Util } from "../../util/util";
import { KustoData } from "../../data/kustoData";
import { remote, shell } from "electron";
import { ModelReader } from "../../modelReader/modelReader";
import { TreeGenerator } from "../../Explorer/treeGenerator";
let log = require("loglevel");

export class ResourceProviderHelper {

    static openResource(
        resource: m.Resource,
        objectContext: m.ObjectContext,
        objectDefinition: m.ParsedObjectDefinition,
        triggerEvent: "ExplorerTree" | "AddressBar" | "LinkRestore" | "FileRestore" | "QuickAction" | "InlineSearch",
        event?: React.MouseEvent<any>,
        tooltip?: string,
        isRefresh = false,
        openFirstRequestInNewTab = false,
    ) {
        try {

            if (!ResourceProviderHelper.validateDateTime()) {
                return;
            }

            let resourceProvider = ResourceProviderSelector.getResourceProvider(resource);
            let tab = new TabRequest();
            let resourceState = new TabResourceState();
            resourceState.namespace = objectDefinition.original.namespace;
            resourceState.objectPath = objectDefinition.original.path;
            resourceState.objectContext = objectContext;
            resourceState.relativePath = resource.relativePath + '.' + resource.type;
            resourceState.isUnprotected = resourceProvider.isUnprotected && resourceProvider.isUnprotected();

            let objectKey = "";

            if (objectDefinition.original.key) {
                objectKey = objectContext.requiredProps[objectDefinition.original.key];
            }

            resourceState.objectId = path.join(objectDefinition.original.namespace, objectDefinition.original.path, objectKey);

            tab.resourceState = resourceState;

            // read the event object before the promise completes since the event may be modified by the the time the promise completes.
            let handleContext = ResourceProviderHelper.getResourceHandleContext(event);
            let tabManager = StateManager.getStore().tabManager.inner;
            let requestCount = 0;
            let setContentManagerUrlFunction = (url, urlContext, openInNew) => {

                // The callback function is handed to resource handlers to interact with content manager.
                // This also hooks up the "reload" functionality of the content manager tab to running openResource.
                // This re-runs and re-contextualizes queries where the reload button is clicked.
                // For example, this allows powershell scripts to be re-run when the reload button is clicked in the webview.
                tab.url = url;
                tab.title = resource.relativePath;
                tab.tooltip = tooltip;
                tab.openInNew = !isRefresh && (openInNew || (requestCount == 0 && openFirstRequestInNewTab));
                tab.context = urlContext;
                tab.refreshProvider = () => ResourceProviderHelper.openResource(resource, objectContext, objectDefinition, triggerEvent, null, tooltip, true);
                tab.icon = "./extensions/resourceProviders/img/{0}.png".format(resource.type);
                tab.key = tabManager.openTab(tab);
                tab.isForegroundTab = false;
                requestCount++;
                return tab.key;
            };

            if (typeof resourceProvider.openResource === "function") {
                // Explicit openResource callback is registered
                let openResult = resourceProvider.openResource(
                    resource,
                    objectContext,
                    objectDefinition,
                    this.getExternalContext(),
                    handleContext);

                let newPromise = openResult && openResult.promise ? openResult.promise : Promise.resolve(true);
                tab.pendingPromise = newPromise;
            } else {
                ResourceProviderHelper.getContextualizedResource(resource, objectContext, objectDefinition, resourceProvider)
                    .then((contextualizedResource) => {
                        let handleResult: HandleResourceResult;
                        if (typeof resourceProvider.handleResource === "function") {
                            handleResult = resourceProvider.handleResource(
                                contextualizedResource,
                                resource,
                                objectDefinition,
                                handleContext,
                                setContentManagerUrlFunction);
                        } else {
                            if (objectContext.requiredBaseProps
                                && objectContext.requiredBaseProps["cloudType"]
                                && (objectContext.requiredBaseProps["cloudType"] as string).toLowerCase() != "public"
                                && resource.type.toLowerCase() === "kusto") {
                                // Kusto web explorer doesn't support national clouds yet, as a workaround, force to open all the non-public kusto resources in kusto explorer.
                                handleContext.shiftKey = true;
                            }

                            handleResult = ResourceProviderHelper.defaultResourceHandler(
                                contextualizedResource,
                                handleContext,
                                setContentManagerUrlFunction);
                        }

                        let newPromise = handleResult.promise ? handleResult.promise : Promise.resolve(true);
                        tab.pendingPromise = newPromise;

                        return newPromise;
                    })
                    .catch((e) => {
                        log.error(e.toString());
                    });
            }

        } catch (e) {
            log.error(e.toString());
        }
    }

    static validateDateTime(): boolean {
        let dateTimeWidget = StateManager.getStore().sideBar.inner.explorer.inner.dateTimeWidget;
        if (!dateTimeWidget.inner.isEndTimeValid || !dateTimeWidget.inner.isStartTimeValid) {
            log.error("Invalid time range specified. Please modify your time range and retry.");
            return false;
        }

        return true;
    }

    /**
     * Contextualizes a resource based on the object's context and definition.
     * @param resource
     * @param objectContext
     * @param objectDefinition
     * @param resourceProvider Optional parameter to use an existing resource provider rather than creating a new one
     */
    static getContextualizedResource(resource: m.Resource, objectContext: m.ObjectContext, objectDefinition: m.ParsedObjectDefinition, resourceProvider?: IResourceProvider): Promise<string> {
        if (!resourceProvider) {
            resourceProvider = ResourceProviderSelector.getResourceProvider(resource);
        }

        let externalContext = this.getExternalContext();

        return resourceProvider.getContextualizedResource(
            resource, objectContext, objectDefinition, externalContext);
    }

    static getExternalContext(): IResourceExternalContext {
        let state = StateManager.getStore().sideBar.inner.explorer.inner;
        let dateTimeState = state.dateTimeWidget.inner;
        let absoluteTime = dateTimeState.getAbsoluteTimeSynchronized();
        return {
            startTime: absoluteTime.startTime,
            endTime: absoluteTime.endTime,
            isRelativeMode: dateTimeState.isRelativeMode,
            timeAgoText: dateTimeState.timeAgoText
        };
    }

    static getDefaultContextualizedResouce(
        resourceString: string,
        objectContext: m.ObjectContext,
        objectDefinition: m.ParsedObjectDefinition,
        externalContext: IResourceExternalContext): Promise<string> {

        // replace parameters in the string with the object/global context
        let startTime = externalContext.startTime.toISOString();
        let endTime = externalContext.endTime.toISOString();

        let result = resourceString.replace(new RegExp("{startTime}", "gi"), startTime);
        result = result.replace(new RegExp("{endTime}", "gi"), endTime);

        return ResourceProviderHelper.replaceObjectProps(result, objectContext, objectDefinition, externalContext);
    }

    static replaceObjectProps(
        resourceString: string,
        objectContext: m.ObjectContext,
        objectDefinition: m.ParsedObjectDefinition,
        externalContext: IResourceExternalContext): Promise<string> {

        if (objectContext) {
            resourceString = ResourceProviderHelper.ReplaceRequiredProps(resourceString, objectContext)
        }

        // Required props have been replaced. Now start
        if (objectDefinition && objectDefinition.original.additionalProps && objectDefinition.original.additionalProps.length > 0) {

            // Get all the parameters left in the resource.
            let remainingProps = Util.getParameters(resourceString);
            let remainingPropNames = Object.keys(remainingProps);
            let pendingProps: StringMap<Promise<string>> = {};

            if (remainingPropNames.length > 0) {
                remainingPropNames.forEach(prop => {

                    if (!pendingProps[prop]) {
                        objectDefinition.original.additionalProps.forEach(additionalProp => {

                            if (additionalProp.type === "constant") {
                                let constProp = additionalProp as m.ConstantProp;

                                if (constProp.name === prop) {
                                    // match found
                                    // Replace any requiredProps in the additionalProp definition.
                                    let propValue = ResourceProviderHelper.ReplaceRequiredProps(constProp.value, objectContext);
                                    resourceString = resourceString.replace(new RegExp("{" + constProp.name + "}", "gi"), propValue);
                                }
                            } else {
                                let provider = DataProviderSelector.getDataProvider(additionalProp);
                                if (!provider || !provider.getAdditionalPropData) {
                                    throw "Data Provider does not support additional props. " + additionalProp.type;
                                }

                                let propNames = additionalProp.name;
                                if ((typeof propNames === "string")) {
                                    propNames = [];
                                    propNames.push(additionalProp.name as string);
                                }

                                if (propNames.indexOf(prop) > -1) {
                                    var dataPromise = provider.getAdditionalPropData(additionalProp, objectContext, objectDefinition, externalContext);
                                    propNames.forEach(propName => {

                                        if (remainingProps[propName]) {

                                            var propPromise = dataPromise.then((data) => {
                                                let keys = Object.keys(data);
                                                if (!keys || keys.length === 0) {
                                                    throw "Could not find property " + propName + ". Try adjusting your time range and retry.";
                                                }
                                                return data[propName];
                                            });

                                            pendingProps[propName] = propPromise;
                                        }
                                    });
                                }
                            }
                        });
                    }
                });

                let pendingPromiseProps = Object.keys(pendingProps);

                if (pendingPromiseProps.length > 0) {
                    let pendingPromises = pendingPromiseProps.map(k => pendingProps[k]);

                    return Promise.all(pendingPromises).then(propValues => {

                        for (let i = 0; i < pendingPromiseProps.length; i++) {
                            resourceString = resourceString.replace(new RegExp("{" + pendingPromiseProps[i] + "}", "gi"), propValues[i]);
                        }

                        return resourceString;
                    });
                } else {
                    return Promise.resolve(resourceString);
                }
            }
        }

        return Promise.resolve(resourceString);
    }

    static ReplaceRequiredProps(
        resourceString: string,
        objectContext: m.ObjectContext): string {

        for (let prop in objectContext.requiredProps) {
            resourceString = resourceString.replace(new RegExp("{" + prop + "}", "gi"), objectContext.requiredProps[prop]);
        }

        for (let prop in objectContext.requiredBaseProps) {
            resourceString = resourceString.replace(new RegExp("{" + prop + "}", "gi"), objectContext.requiredBaseProps[prop]);
        }

        return resourceString;
    }

    static defaultResourceHandler(
        contextualizedResource: string,
        handleContext: IResourceHandleContext,
        setContentManagerUrl: ContentManagerSetUrl): HandleResourceResult {

        if (handleContext.shiftKey) {
            shell.openExternal(contextualizedResource);
        } else if (handleContext.ctrlKey) {
            setContentManagerUrl(contextualizedResource, null, true)
        } else {
            setContentManagerUrl(contextualizedResource, null, false);
        }

        return {};
    }

    static getResourceHandleContext(event?: React.MouseEvent<any>): IResourceHandleContext {
        if (event) {
            return { shiftKey: event.shiftKey, ctrlKey: event.ctrlKey }
        }

        return { shiftKey: false, ctrlKey: false };
    }

    static convertTimeAgoToMinutes(timeAgoText: string) {
        let minPerUnit: number = 0;
        let unit: string = timeAgoText && timeAgoText.length > 1 ? timeAgoText.substring(0, timeAgoText.length - 1) : "0";

        if (timeAgoText.endsWith("d")) {
            minPerUnit = 1440;
        } else if (timeAgoText.endsWith("h")) {
            minPerUnit = 60;
        } else if (timeAgoText.endsWith("m")) {
            minPerUnit = 1;
        }

        return parseInt(unit) * minPerUnit;
    }

    static createResourceContextMenu(resource: m.Resource, objectDefinition: m.ParsedObjectDefinition, objectContext: m.ObjectContext): Electron.Menu {
        const externalContext = ResourceProviderHelper.getExternalContext();
        const resourceProvider = ResourceProviderSelector.getResourceProvider(resource);
        let contextMenu = null;
        if (resourceProvider.getContextMenu === undefined) {
            // Default menu for all resources
            contextMenu = remote.Menu.buildFromTemplate([
                {
                    label: 'Open in default browser',
                    sublabel: 'Shift+Click',
                    click: () => ResourceProviderHelper.openExternally(resource, objectContext, objectDefinition),
                },
                {
                    type: 'separator',
                    label: 'sep1'
                },
                {
                    label: 'Copy link',
                    click: () => ResourceProviderHelper.copyUrl(resource, objectContext, objectDefinition),
                }
            ]);
        } else {
            const externalContext = ResourceProviderHelper.getExternalContext();
            contextMenu = resourceProvider.getContextMenu(
                resource, objectContext, objectDefinition, externalContext);
        }

        contextMenu.append(new remote.MenuItem(
            {
                type: 'separator',
                label: 'sep1'
            }
        ));

        contextMenu.append(new remote.MenuItem(
            {
                label: "Edit",
                click: () => {
                    ResourceEditorCtrl.openResourceEditor(
                        false,
                        false,
                        {
                            resource: JSON.stringify(resource),
                            namespace: objectDefinition.original.namespace,
                            path: objectDefinition.original.path,
                        }
                        ,
                        () => {
                            StateManager.getStore().sideBar.inner.edit.inner.refreshChangeList();
                            TreeGenerator.reloadAllTrees();
                        });
                }
            }))

        let clone = Object.assign({}, resource, { relativePath: resource.relativePath + " - Copy" });

        contextMenu.append(new remote.MenuItem(
            {
                label: "Clone",
                click: () => {
                    ResourceEditorCtrl.openResourceEditor(
                        false,
                        true,
                        {
                            resource: JSON.stringify(clone),
                            namespace: objectDefinition.original.namespace,
                            path: objectDefinition.original.path,
                        }
                        ,
                        () => {
                            StateManager.getStore().sideBar.inner.edit.inner.refreshChangeList();
                            TreeGenerator.reloadAllTrees();
                        });
                }
            }))

        return contextMenu;
    }

    private static copyUrl(resource: m.Resource, objectContext: m.ObjectContext, objectDefinition: m.ParsedObjectDefinition) {
        ResourceProviderHelper.getContextualizedResource(resource, objectContext, objectDefinition)
            .then((url) => {
                remote.clipboard.writeText(url);
            });
    }

    private static openExternally(resource: m.Resource, objectContext: m.ObjectContext, objectDefinition: m.ParsedObjectDefinition) {
        ResourceProviderHelper.getContextualizedResource(resource, objectContext, objectDefinition)
            .then((url) => {
                shell.openExternal(url);
            });
    }
}