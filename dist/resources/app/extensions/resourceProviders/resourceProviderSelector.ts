//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../../typings/index.d.ts" />

import * as m from "Model";
import { IResourceProvider } from "./ResourceProvider";
import { Util } from "../../util/util";
import { Constants } from "../../state/state";
import * as path from "path";
import { ExtensionState } from "../commonInterfaces";
import * as Promise from "bluebird";

const fs = require("fs");
let log = require("loglevel");

export class ResourceProviderSelector {
    static getResourceProvider(
        resource: m.Resource): IResourceProvider {
        let resourceModule = null;

        try {
            resourceModule = require(`./resources/${resource.type}`);
        } catch {
            throw `Resource provider for type ${resource.type} not found.`;
        }

        if (!resourceModule.ResourceProviderInstance) {
            throw `Resource provider for type ${resource.type} does not export its implementation properly. Check the resource provider file.`
        }

        return resourceModule.ResourceProviderInstance;
    }

    /**
     * @returns A list of resource types, this is being used by resource editor for available resources.
     * only types with json template will be returned.
     */
    static getResourceTypes(): Promise<string[]> {
        const directory = path.join(Util.getAppPath(), "extensions/resourceProviders/resources");

        return Util.readDir(directory).then((files) => {
            let resourceTypes = [];
            files.forEach((file) => {
                if (path.extname(file.toLocaleLowerCase()) == ".json") {
                    resourceTypes.push(path.basename(file, path.extname(file)));
                }
            })

            return resourceTypes;
        });
    }
}