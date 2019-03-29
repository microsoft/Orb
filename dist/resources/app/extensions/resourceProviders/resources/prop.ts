//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../../../typings/index.d.ts" />

import * as m from "Model";
import { ModelReader } from "../../../modelReader/modelReader";
import { IResourceProvider, IResourceHandleContext, ContentManagerSetUrl, HandleResourceResult, BaseResourceProvider } from ".././ResourceProvider";
import { IResourceExternalContext } from "../../commonInterfaces";
import * as Promise from 'bluebird';
import { shell, remote } from "electron";
import * as path from "path";
import * as cp from "child_process";
import { ResourceProviderHelper } from "../helper"
import { StateManager, Constants } from "../../../state/state"
import { Util } from "../../../util/util";

export class PropResourceProvider extends BaseResourceProvider implements IResourceProvider {

    private static spinnerGifPath: string = "../assets/ring.svg";
    //private static initialMdTemplate = "# {0} \n\n" + "![](" + PropResourceProvider.spinnerGifPath + ")\n";
    private static resultMdTemplate = "# {0} \n\n Name | Value \n --------|-------- \n{1}\n\n";

    getContextualizedResource(
        resource: m.Resource,
        objectContext: m.ObjectContext,
        objectDefinition: m.ParsedObjectDefinition,
        externalContext: IResourceExternalContext): Promise<string> {

        let propMdString = "";

        for (let prop in objectContext.requiredProps) {
            propMdString += (prop + " | " + "{" + prop + "}\n")
        }

        for (let prop in objectContext.requiredBaseProps) {
            propMdString += (prop + " | " + "{" + prop + "}\n")
        }

        if (objectDefinition.original.additionalProps) {
            objectDefinition.original.additionalProps.forEach(additionalProp => {
                if (additionalProp.type !== "constant") {
                    let propNames = additionalProp.name;
                    if ((typeof propNames === "string")) {
                        propNames = [];
                        propNames.push(additionalProp.name as string);
                    }
                    propNames.forEach(prop => {
                        propMdString += (prop + " | " + "{" + prop + "}\n")
                    });
                }
            });
        }

        return ResourceProviderHelper.getDefaultContextualizedResouce(propMdString, objectContext, objectDefinition, externalContext);
    }

    handleResource(
        contextualizedResource: string,
        resource: m.Resource,
        objectDefinition: m.ParsedObjectDefinition,
        handleContext: IResourceHandleContext,
        setContentManagerUrl: ContentManagerSetUrl): HandleResourceResult {

        let newPromise;
        let objectNamespace = objectDefinition.original.namespace;

        setContentManagerUrl(
            Constants.mdUrl,
            {
                incarnation: Date.now().toString(),
                // Load an initial webpage showing the script being run.
                webviewContext: PropResourceProvider.resultMdTemplate.format(resource.relativePath, contextualizedResource)
            },
            handleContext.ctrlKey ? true : false);

        return <HandleResourceResult>{
            promise: null
        };
    }

    getContextMenu(
        resource: m.Resource,
        objectContext: m.ObjectContext,
        objectDefinition: m.ParsedObjectDefinition,
        externalContext: IResourceExternalContext): Electron.Menu {

        return remote.Menu.buildFromTemplate([

        ]);
    }

    createResource(resource: string): string {
        let json = this.getTemplate();
        return JSON.stringify(json);
    }

    isUnprotected() {
        return true;
    }
}

export const ResourceProviderInstance = new PropResourceProvider("prop");