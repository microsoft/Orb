//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../../typings/index.d.ts" />
import * as m from "Model";
import * as Promise from 'bluebird';
import { TabState } from "../../state/state";
import { IResourceExternalContext } from "../commonInterfaces";

/*
 * Interface that describes the conditions associated with opening a resource.
 */
export interface IResourceHandleContext {
    shiftKey?: boolean;
    ctrlKey?: boolean;
}

/*
 * Interface that describes the context sent to a content manager webpage.
 */
export interface ContentManagerContext {
    incarnation: string;
    webviewContext: any;
}

export interface HandleResourceResult {
    promise?: Promise<any>;
}

export interface OpenResourceResult {
    promise?: Promise<any>;
}

/*
 * Callback function handed to providers to interact with the content manager.
 */
export type ContentManagerSetUrl = (url: string, context: ContentManagerContext, openInNew: boolean) => string;

export interface IResourceProvider {

    /*
     * Given a resource and context, convert a generic resource template to a specific value.
     * Used for the Copy Resource contextual action or in the default resource handler if an override is not specified.
     */
    getContextualizedResource(
        resource: m.Resource,
        objectContext: m.ObjectContext,
        objectDefintion: m.ParsedObjectDefinition,
        externalContext: IResourceExternalContext): Promise<string>;

    /*
     * Optional function for overriding the default resource handling behavior.
     */
    handleResource?(
        contextualizedResource: string,
        resource: m.Resource,
        objectDefintion: m.ParsedObjectDefinition,
        handleContext: IResourceHandleContext,
        contentManagerSetUrl: ContentManagerSetUrl): HandleResourceResult;

    /*
     * Optional function for overriding the default resource handling behavior. Successor to handle Resource. Handle resource should not be used any more.
     */
    openResource?(
        resource: m.Resource,
        objectContext: m.ObjectContext,
        objectDefintion: m.ParsedObjectDefinition,
        externalContext: IResourceExternalContext,
        handleContext: IResourceHandleContext): OpenResourceResult;

    getContextMenu?(
        resource: m.Resource,
        objectContext: m.ObjectContext,
        objectDefinition: m.ParsedObjectDefinition,
        externalContext: IResourceExternalContext): Electron.Menu;

    /**
     * @returns the json string of default resource template.
     * Resource editor use this method to provide the default value for the resource.
     */
    getTemplate(): string;

    /**
     * Optional function, Orb uses this method to generate resource if you are on a web page.
     * @param webview
     * @returns the resource json string.
     */
    generateResource?(
        webview: any,
    ): Promise<string>;

    /**
     * Orb uses this method to generate resource from clipboard.
     * @param resource the script/link/query used in this resource.
     * @returns the resource json string.
     */
    createResource(
        resource: string,
    ): string;

    isUnprotected?(): boolean;
}

export class BaseResourceProvider {
    resourceName;
    constructor(resourceName) {
        this.resourceName = resourceName;
    }

    getTemplate() {
        return require(`./resources/${this.resourceName}.json`);
    }
}