//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />

import * as electron from "electron";
import * as Promise from "bluebird";
import * as path from "path";
import { Util } from "../util/util";
import { ConfigUtil } from "../config/configUtil";

export interface IAuthenticator {
    isAuthInProgress?(): boolean;
    getToken(connectionStr?: string): Promise<string>;
}

class AadNativeAuthenticator implements IAuthenticator {
    private InvokeAadAuthClr;
    protected clientId: string;
    protected redirectUri: string;
    protected apiResourceId: string;
    private authInProgress: boolean;
    private authPromise: any;

    public constructor(clientId: string, redirectUri: string, apiResourceId) {
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

    getToken(): Promise<string> {
        if (this.authInProgress && this.authPromise) {
            return this.authPromise;
        }

        this.authInProgress = true;
        this.authPromise = new Promise<string>((resolve, reject) => {
            this.InvokeAadAuthClr(<AuthRequest>{
                ClientId: this.clientId,
                ReplyUri: this.redirectUri,
                ResourceId: this.apiResourceId,
                CacheLocation: Util.getAuthCacheLocation(),
            }, (error, result: AuthResult) => {
                this.authInProgress = false;
                if (error || result.Error) {
                    reject(error ? error : result.Error);
                } else {
                    resolve(result.Parameter);
                }
            })
        })

        return this.authPromise;
    }
}

class AadAuthenticator {
    protected aadNativeAuthenticator: AadNativeAuthenticator;
    protected keyForToken: string;
    protected useNativeAuthenticator: boolean;

    public constructor(clientId: string, replyUri: string, resource: string) {
        this.aadNativeAuthenticator = new AadNativeAuthenticator(clientId, replyUri, resource);
        this.keyForToken = resource + "token";
    }

    public getToken(): Promise<string> {
        return this.aadNativeAuthenticator.getToken().then((token) => {
            return token;
        });
    }
}

export class KustoAuthenticator extends AadAuthenticator {

    private static _instance: KustoAuthenticator;

    private constructor() {
        super(ConfigUtil.Settings.kustoClientId,
            ConfigUtil.Settings.kustoClientReplyUri,
            ConfigUtil.Settings.kustoResourceId);
    }

    public static instance() {
        if (!KustoAuthenticator._instance) {
            KustoAuthenticator._instance = new KustoAuthenticator();
        }

        return KustoAuthenticator._instance;
    }
}

export class VstsAuthenticator extends AadAuthenticator {

    private static _instance: VstsAuthenticator;

    private constructor() {
        super(ConfigUtil.Settings.vstsClientId,
            ConfigUtil.Settings.vstsClientReplyUri,
            ConfigUtil.Settings.vstsResourceId);
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