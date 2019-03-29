//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../../../typings/index.d.ts" />

import * as m from "Model";
import { IResourceProvider, BaseResourceProvider } from "../ResourceProvider";
import { IResourceExternalContext } from "../../commonInterfaces";
import * as Promise from 'bluebird';
import { ResourceProviderHelper } from "../helper";

export class LinkResourceProvider extends BaseResourceProvider implements IResourceProvider {

    getContextualizedResource(
        resource: m.Resource,
        objectContext: m.ObjectContext,
        objectDefintion: m.ParsedObjectDefinition,
        externalContext: IResourceExternalContext): Promise<string> {

        // replace parameters in the link with the object/global context
        var linkResource = resource as m.LinkResource;
        return ResourceProviderHelper.getDefaultContextualizedResouce(
            linkResource.link, objectContext, objectDefintion, externalContext)
            .then((result) => result.replace(/"/g, '%22'));
    }

    generateResource(webview): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            if (webview) {
                return resolve(this.createResource(webview.getURL()));
            }

            return resolve(null);
        })
    }

    createResource(resource: string): string {
        let json = this.getTemplate();
        json.link = resource;
        return JSON.stringify(json);
    }

    isUnprotected() {
        return true;
    }
}

export const ResourceProviderInstance = new LinkResourceProvider("link");