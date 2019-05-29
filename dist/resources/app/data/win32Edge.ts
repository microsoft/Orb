//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />

import * as electron from "electron";
import * as Promise from "bluebird";
import * as path from "path";

export class Win32Edge {

    private LaunchProcessAndAttachAsChildWindowClr;
    private SetWindowPosClr;
    private ShowWindowClr;
    private SetWindowFocusClr;
    private TerminateAllSessionsClr;

    private static _instance;

    private constructor() {
        let edge = require("electron-edge");

        const assemblyPath = path.join(electron.remote.app.getAppPath(), "win32Edge\\Orb.Win32Edge.dll");

        this.LaunchProcessAndAttachAsChildWindowClr = edge.func({
            assemblyFile: assemblyPath,
            typeName: "Orb.Win32Edge",
            methodName: "LaunchProcessAndAttachAsChildWindow"
        });

        this.SetWindowPosClr = edge.func({
            assemblyFile: assemblyPath,
            typeName: "Orb.Win32Edge",
            methodName: "SetWindowPos"
        });

        this.ShowWindowClr = edge.func({
            assemblyFile: assemblyPath,
            typeName: "Orb.Win32Edge",
            methodName: "ShowWindow"
        });

        this.SetWindowFocusClr = edge.func({
            assemblyFile: assemblyPath,
            typeName: "Orb.Win32Edge",
            methodName: "SetWindowFocus"
        });

        this.TerminateAllSessionsClr = edge.func({
            assemblyFile: assemblyPath,
            typeName: "Orb.Win32Edge",
            methodName: "TerminateAllSessions"
        });

    }

    public static instance() {
        if (!this._instance) {
            this._instance = new Win32Edge();
        }

        return this._instance;
    }
}
