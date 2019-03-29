//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />

import * as electron from "electron";
import * as Promise from "bluebird";
import * as path from "path";
import { ModelReader } from "../modelReader/modelReader";
import { Util } from "../util/util";

declare const AuthenticationContext: any;

export interface IAuthenticator {
    isAuthInProgress?(): boolean;
    getToken(connectionStr?: string): Promise<string>;
}

class AadWebAuthenticator implements IAuthenticator {
    private authWindow: Electron.BrowserWindow;
    private authInProgress: boolean;
    private authPromise: any;
    private tokenRefresher: any;
    private countOfContinuousFailure: number;
    protected clientId: string;
    protected redirectUri: string;
    protected apiResourceId: string;

    private beginPeriodicTokenRefresh() {
        if (!this.tokenRefresher) {
            this.tokenRefresher = setInterval(() => {
                console.log("Refresh token in background");
                this.getToken().then((token) => {
                    if (token) {
                        console.log("Token refreshed");
                    }
                }).catch((e) => {
                    console.log(e);
                });
            }, 15 * 60 * 1000);
        }
    }

    public constructor(clientId: string, redirectUri: string, apiResourceId) {
        this.clientId = clientId;
        this.redirectUri = redirectUri;
        this.apiResourceId = apiResourceId;
    }

    login(authContext): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            let succeed = false;
            authContext.config.displayCall = function (url) {
                authContext.config.displayCall = null;
                console.log("creating auth window");

                this.authWindow = new electron.remote.BrowserWindow({ width: 800, height: 600, webPreferences: { nodeIntegration: false }, show: false });
                this.authWindow.webContents.on("did-get-redirect-request", (event, oldUrl, newUrl) => {
                    console.log("auth redirect request", newUrl);

                    if (newUrl.search("#") != -1) {
                        let hash = newUrl.substring(newUrl.search("#") + 1);
                        succeed = true;
                        authContext.handleWindowCallback(hash);
                        resolve();
                        if (this.authWindow) {
                            console.log("destroy authWindow");
                            this.authWindow.destroy();
                        }
                    }
                });

                this.authWindow.loadURL(url);
                this.authWindow.on("closed", () => {
                    if (!succeed) {
                        reject("Login has been cancelled");
                    }
                })

                this.authWindow.once('ready-to-show', () => {

                    setTimeout(() => {
                        // delay showing the window till 5 seconds after.
                        // 99% of the cases the window will be destroyed before the need to show it, since the token will auto refresh without credentials.
                        if (this.authWindow && !this.authWindow.isDestroyed()) {
                            console.log("showing auth window");
                            this.authWindow.show();
                        }
                    }, 5 * 1000);
                });
            };

            authContext.login();
        })
    }

    getParameterByName(name, url) {
        name = name.replace(/[\[\]]/g, "\\$&");
        let regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
            results = regex.exec(url);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, " "));
    }

    acquireToken(apiResourceId, authContext): Promise<string> {
        console.log("acquire token");
        return new Promise<string>((resolve, reject) => {
            authContext.acquireToken(this.apiResourceId, (description, token, error) => {
                if (token) {
                    console.log("token acquired for" + apiResourceId);
                    resolve(token);
                } else {
                    reject(description);
                }
            })
        }).catch((e) => {
            console.log("acquire token failed ({0}): ".format(++this.countOfContinuousFailure), e);
            if (e == "User login is required") {
                return this.login(authContext).then(() => {
                    console.log("login token acquired");
                    return this.acquireToken(apiResourceId, authContext);
                })
            } else if (e == "Token renewal operation failed due to timeout") {
                let iframe = document.getElementById("adalRenewFrame" + apiResourceId);
                let url = "";
                if (iframe && (iframe as any).contentWindow && (iframe as any).contentWindow.location) {
                    url = (iframe as any).contentWindow.location.href;
                }

                if (url.indexOf("#") != -1) {
                    url = "?" + url.substring(url.search("#") + 1);
                    console.log("token acquired for " + apiResourceId);
                    return this.getParameterByName("access_token", url);
                } else {
                    console.log("token not found in reply uri, retry acquire token");
                    authContext._loginInProgress = false;
                    if (this.countOfContinuousFailure > 4) {
                        throw e;
                    }

                    return this.login(authContext).then(() => {
                        return this.acquireToken(apiResourceId, authContext);
                    });
                }
            } else {
                throw e;
            };
        })
    }

    isAuthInProgress(): boolean {
        return this.authInProgress;
    }

    getToken(): Promise<string> {
        if (this.authInProgress && this.authPromise) {
            return this.authPromise;
        }

        const config = {
            tenant: "microsoft.onmicrosoft.com",
            clientId: this.clientId,
            redirectUri: this.redirectUri,
            cacheLocation: "localStorage",
            displayCall: null,
            popup: true
        };

        let authContext = new AuthenticationContext(config);
        this.authInProgress = true;
        this.countOfContinuousFailure = 0;
        this.authPromise = this.acquireToken(this.apiResourceId, authContext).finally(() => {
            authContext._loginInProgress = false;
            this.countOfContinuousFailure = 0;
            this.authInProgress = false;
            this.beginPeriodicTokenRefresh();
        });

        return this.authPromise;
    }
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
    protected aadWebAuthenticator: AadWebAuthenticator;
    protected aadNativeAuthenticator: AadNativeAuthenticator;
    protected keyForToken: string;
    protected useNativeAuthenticator: boolean;

    public constructor(webClientId: string, nativeClientId: string, webReplyUri: string, nativeReplyUri: string, apiResourceId: string, useNativeAuthenticator: boolean) {
        this.aadWebAuthenticator = new AadWebAuthenticator(webClientId, webReplyUri, apiResourceId);
        this.aadNativeAuthenticator = new AadNativeAuthenticator(nativeClientId, nativeReplyUri, apiResourceId);
        this.keyForToken = apiResourceId + "token";
        this.useNativeAuthenticator = useNativeAuthenticator;
    }

    public getToken(): Promise<string> {
        if (this.useNativeAuthenticator) {
            return this.aadNativeAuthenticator.getToken().then((token) => {
                // localStorage.setItem(this.keyForToken, token);
                return token;
            });
        }

        return this.aadWebAuthenticator.getToken();
    }
}

export class KustoAuthenticator extends AadAuthenticator {
    private static _instance: KustoAuthenticator;

    private constructor() {
        super("1f2d711d-efbc-460c-bcda-c53e423e0644",
            "d4e81265-45c6-44ea-9468-5d8698aa9044",
            "https://jarvis-west-int.cloudapp.net/user-api/v1/config/security/AADAuthCompleted",
            "http://orbnative",
            "1f2d711d-efbc-460c-bcda-c53e423e0644", true);
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
        super("1f2d711d-efbc-460c-bcda-c53e423e0644",
            "d4e81265-45c6-44ea-9468-5d8698aa9044",
            "https://jarvis-west-int.cloudapp.net/user-api/v1/config/security/AADAuthCompleted",
            "http://orbnative",
            "499b84ac-1321-427f-aa17-267ca6975798", true);
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