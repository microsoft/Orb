//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />

import * as electron from "electron";
import * as Promise from "bluebird";
import * as path from "path";

export class KustoEdge {

    private InitializeClientClr;
    private DeleteDocumentPanelClr;
    private SetDocumentPanelClr;
    private TryForwardQueryToPrimaryClr;

    private static _instance;

    private constructor() {
        let edge = require("electron-edge");

        const assemblyPath = path.join(electron.remote.app.getAppPath(), "kustoEdge\\Orb.KustoEdge.dll");

        this.InitializeClientClr = edge.func({
            assemblyFile: assemblyPath,
            typeName: "Orb.KustoEdge",
            methodName: "InitializeClient"
        });

        this.DeleteDocumentPanelClr = edge.func({
            assemblyFile: assemblyPath,
            typeName: "Orb.KustoEdge",
            methodName: "DeleteDocumentPanel"
        });

        this.SetDocumentPanelClr = edge.func({
            assemblyFile: assemblyPath,
            typeName: "Orb.KustoEdge",
            methodName: "SetDocumentPanel"
        });

        this.TryForwardQueryToPrimaryClr = edge.func({
            assemblyFile: assemblyPath,
            typeName: "Orb.KustoEdge",
            methodName: "TryForwardQueryToPrimary"
        });
    }

    public static instance() {
        if (!this._instance) {
            this._instance = new KustoEdge();
            this._instance.InitializeClientClr({ processInstanceId: electron.remote.getGlobal("instanceId") }, (e, r) => { if (e) { console.log(e) } })
        }

        return this._instance;
    }
}
