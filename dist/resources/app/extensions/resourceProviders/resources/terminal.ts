//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../../../typings/index.d.ts" />

import * as m from "Model";
import { ModelReader } from "../../../modelReader/modelReader";
import { IResourceProvider, BaseResourceProvider } from "../ResourceProvider";
import { IResourceExternalContext } from "../../commonInterfaces";
import { remote } from "electron";
import * as url from "url";
import { ResourceProviderHelper } from "../helper";
import { Constants } from "../../../state/state";
import { Util } from "../../../util/util";
import * as Promise from "bluebird";

export class TerminalResourceProvider extends BaseResourceProvider implements IResourceProvider {

    getContextualizedResource(
        resource: m.Resource,
        objectContext: m.ObjectContext,
        objectDefinition: m.ParsedObjectDefinition,
        externalContext: IResourceExternalContext): Promise<string> {

        // replace parameters in the link with the object/global context
        let psResource = resource as m.PowershellResource;

        return ResourceProviderHelper.getDefaultContextualizedResouce(
            psResource.script, objectContext, objectDefinition, externalContext)
            .then((script) => {
                if (psResource.powershellProfile) {
                    return ModelReader.getResourceProfile(objectDefinition.original.namespace, psResource.powershellProfile)
                        .then((profile: m.PowershellProfile) => {
                            return this.getTerminalUrl(script, profile);
                        });
                } else {
                    return this.getTerminalUrl(script, null);
                }
            })
    }

    getTerminalUrl(script: string, profile: m.PowershellProfile, params: string = ""): string {
        if (!script && !profile) {
            return Constants.terminalUrl + "?" + params;
        }

        let fullTerminalData = "";
        if (profile && profile.startupScript) {
            fullTerminalData += (profile.startupScript + "\r");
        }

        if (script) {
            fullTerminalData += (script + "\r");
        }

        let result = url.resolve(Constants.terminalUrl, "?data=" + encodeURIComponent(Util.toBase64(fullTerminalData)) + "&" + params);

        return result;
    }

    getContextMenu(
        resource: m.Resource,
        objectContext: m.ObjectContext,
        objectDefinition: m.ParsedObjectDefinition,
        externalContext: IResourceExternalContext): Electron.Menu {

        return remote.Menu.buildFromTemplate([
            {
                label: 'Copy script',
                click: () => this.getContextualizedResource(resource, objectContext, objectDefinition, externalContext).then(r => remote.clipboard.writeText(r))
            }
        ]);
    }

    createResource(resource: string): string {
        let json = this.getTemplate();
        json.script = resource;
        return JSON.stringify(json);
    }
}

export const ResourceProviderInstance = new TerminalResourceProvider("terminal");
