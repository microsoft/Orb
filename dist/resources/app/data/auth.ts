//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />

import * as electron from "electron";
import * as Promise from "bluebird";
import * as path from "path";
import { Util } from "../util/util";

export interface IAuthenticator {
    isAuthInProgress?(): boolean;
    getToken(resourceId?: string): Promise<string>;
}

class AadNativeAuthenticator implements IAuthenticator {
    private InvokeAadAuthClr;
    protected clientId: string;
    protected redirectUri: string;
    protected apiResourceId: string;
    private authInProgress: boolean;
    private authPromise: any;

    public constructor(clientId: string, redirectUri: string, apiResourceId: string = "") {
        this.clientId = clientId;
        this.redirectUri = redirectUri;
        this.apiResourceId = apiResourceId;
        let edge = require("electron-edge");

        const assemblyPath = path.join(electron.remote.app.getAppPath(), "EdgeDependencies\\Orb.AuthEdge\\Orb.AuthEdge.dll");

        this.InvokeAadAuthClr = edge.func({
            assemblyFile: assemblyPath,
            typeName: "Orb.AuthEdge",
            methodName: "AcquireToken"
        });
    }

    getToken(resourceId: string = ""): Promise<string> {
        if (this.authInProgress && this.authPromise) {
            return this.authPromise;
        }

        this.authInProgress = true;

        this.authPromise = new Promise<string>((resolve, reject) => {
            this.InvokeAadAuthClr(<AuthRequest>{
                ClientId: this.clientId,
                ReplyUri: this.redirectUri,
                ResourceId: resourceId ? resourceId : this.apiResourceId,
                CacheLocation: Util.getAuthCacheLocation(),
            }, (error, result: AuthResult) => {
                this.authInProgress = false;
                if (error || result.Error) {
                    Util.clearAuthCacheSync();
                    reject(error ? error : result.Error);
                } else {
                    resolve(result.Parameter);
                }
            })
        })

        return this.authPromise;
    }
}

export class KustoAuthenticator extends AadNativeAuthenticator {

    private static _instance: KustoAuthenticator;

    private constructor() {
        super("db662dc1-0cfe-4e1c-a843-19a68e65be58",
            "https://microsoft/kustoclient");
    }

    public static instance() {
        if (!KustoAuthenticator._instance) {
            KustoAuthenticator._instance = new KustoAuthenticator();
        }

        return KustoAuthenticator._instance;
    }
}

export class VstsAuthenticator extends AadNativeAuthenticator {

    private static _instance: VstsAuthenticator;

    private constructor() {
        super("872cd9fa-d31f-45e0-9eab-6e460a02d1f1",
            "urn:ietf:wg:oauth:2.0:oob",
            "499b84ac-1321-427f-aa17-267ca6975798");
    }

    public static instance() {
        if (!VstsAuthenticator._instance) {
            VstsAuthenticator._instance = new VstsAuthenticator();
        }

        return VstsAuthenticator._instance;
    }
}

interface AuthRequest {
    KustoConnectionDataSource?: string,
    ClientId?: string,
    ReplyUri?: string,
    ResourceId?: string
}

interface AuthResult {
    Scheme: string;
    Parameter: string;
    Error: string;
}