//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../../typings/index.d.ts" />

import * as m from "Model";
import { IDataProvider } from "./DataProvider";

// Points to the location of the dataProvider components
const dataProviderLocation: string = "./";

export class DataProviderSelector {

    static getDataProvider(
        resource: m.DataProviderResource): IDataProvider {

        const dataModule = require(`${dataProviderLocation}${resource.type}`);

        if (!dataModule) {
            throw `Data provider for type ${resource.type} not found. Please try running a newer version of Orb. Restarting Orb will launch a newer version if available.`;
        }

        if (!dataModule.default && typeof dataModule.default !== "function") {
            throw `Data provider for type ${resource.type} does not export its implementation properly. Check the data provider file.`;
        }

        return new dataModule.default();
    }
}