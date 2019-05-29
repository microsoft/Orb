//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../../../typings/index.d.ts" />

import * as m from "Model";
import { ModelReader } from "../../../modelReader/modelReader";
import { IResourceProvider, IResourceHandleContext, HandleResourceResult, BaseResourceProvider } from "../ResourceProvider";
import { IResourceExternalContext } from "../../commonInterfaces";
import * as Promise from "bluebird";
import { shell, remote } from "electron";
import * as cp from "child_process";
import { ResourceProviderHelper } from "../helper";

export class PsxResourceProvider extends BaseResourceProvider implements IResourceProvider {

    getContextualizedResource(
        resource: m.Resource,
        objectContext: m.ObjectContext,
        objectDefinition: m.ParsedObjectDefinition,
        externalContext: IResourceExternalContext): Promise<string> {

        // replace parameters in the link with the object/global context
        let psResource = resource as m.PowershellResource;

        return ResourceProviderHelper.getDefaultContextualizedResouce(
            psResource.script, objectContext, objectDefinition, externalContext)
    }

    handleResource(
        contextualizedResource: string,
        resource: m.PowershellResource,
        objectDefinition: m.ParsedObjectDefinition,
        handleContext: IResourceHandleContext): HandleResourceResult {

        let objectNamespace = objectDefinition.original.namespace;

        if (resource.powershellProfile) {
            ModelReader.getResourceProfile(objectNamespace, resource.powershellProfile)
                .then((profile: m.PowershellProfile) => {
                    return this.handleResourceInternal(contextualizedResource, resource, objectNamespace, handleContext, profile)
                });
        } else {
            this.handleResourceInternal(contextualizedResource, resource, objectNamespace, handleContext, null)
        }

        return <HandleResourceResult>{
            promise: null // return a null promise since it never needs to be cancelled upstream.
        };
    }

    handleResourceInternal(
        contextualizedResource: string,
        resource: m.PowershellResource,
        objectNamespace: string,
        handleContext: IResourceHandleContext,
        profile: m.PowershellProfile) {

        // Lots of quote manipulations in this function. Cmd and PS have different semantics around quote handling, hence the complicated quote replacements.

        let command = "";
        if (profile && profile.startupScript) {
            command = profile.startupScript.replace(/"/g, "\\\"");
            if (!command.endsWith(";")) {
                command += ";"
            }
        }

        contextualizedResource = contextualizedResource.replace(/"/g, "\\\"");
        command += ("$command = '" + contextualizedResource.replace(/'/g, "''") + "';Write-Host ($command -replace \\\";\\\",\\\"`n\\\");")
        command += contextualizedResource;

        let cmd = "start powershell -NoExit -Command \".{" + command + "}\"";
        cp.exec(cmd);
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

export const ResourceProviderInstance = new PsxResourceProvider("psx");