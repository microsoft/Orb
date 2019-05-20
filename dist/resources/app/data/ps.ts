//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />

import * as m from "Model";
import { remote, shell } from 'electron';
import * as Promise from 'bluebird';
import * as path from 'path';
import * as os from 'os';
import { DialogManager } from '../dialog/DialogManager';
import { Util } from '../util/util';

let log = require('loglevel');

export interface PSResult {
    Output: any;
    Errors: string[];
    Warnings: string[];
    ExecutionTimeMs: number;
}

interface PSRequest {
    RequestId: string;
    RunspaceKey: string;
    Script: string;
}

interface CreateRunspaceRequest {
    RunspaceKey: string;
    StartupScript: string;
    PromptHandler: any;
}

interface PromptOutput {
    Results: PromptOutputEntry[]
}

interface PromptOutputEntry {
    Value: string,
    Name: string,
}

interface PromptInput {
    Message: string,
    Caption: string,
    FieldDescriptions: FieldDescription[]
}

class PSHostHandler {

    static Prompt(data: PromptInput, callback) {
        DialogManager.showFieldDialog("PowerShell Prompt", data.Caption, data.Message, data.FieldDescriptions)
            .then(result => {
                var results = data.FieldDescriptions.map((f, i) => {
                    return <PromptOutputEntry>
                        {
                            Name: f.Name,
                            Value: result.fieldValues[f.Name] == undefined ? "" : result.fieldValues[f.Name]
                        }
                });
                callback(null, {
                    Results: results
                }
                );
            });
    }
}

class PowershellProfileNames {
    static readonly slbShell = "SlbShell"
}

export class PowerShellExecutor {

    private static invokeScriptAsStringClr;
    private static cancelInvokeClr;
    private static createRunspacePoolClr;
    private static requestId = 0;
    private static runspaceCreationPromises: { [key: string]: Promise<void> } = {};

    private static checkOsReleaseSupported(): boolean {

        if (Util.compareVersions(os.release(), "10.0.14393") < 0) {
            alert("Your SAW OS version is not supported due to known PowerShell bugs. Orb may crash on loading PowerShell.\nTo Fix the issue, please re-image your SAW to the latest OS.\nTo do this, reboot your SAW and press F11 during boot. Choose the SAW recovery option to re-image your machine.");
            return false;
        }

        return true;
    }

    static initialize() {
        try {
            PowerShellExecutor.checkOsReleaseSupported();
            console.log("Loading CLR using electron edge");
            let edge = require('electron-edge');
            const assemblyPath = path.join(remote.app.getAppPath(), "EdgeDependencies\\Orb.PsEdge\\Orb.PsEdge.dll");

            PowerShellExecutor.createRunspacePoolClr = edge.func({
                assemblyFile: assemblyPath,
                typeName: 'Orb.PSEdge',
                methodName: 'CreateRunspacePool'
            });

            PowerShellExecutor.invokeScriptAsStringClr = edge.func({
                assemblyFile: assemblyPath,
                typeName: 'Orb.PSEdge',
                methodName: 'InvokeScriptAsString'
            });

            PowerShellExecutor.cancelInvokeClr = edge.func({
                assemblyFile: assemblyPath,
                typeName: 'Orb.PSEdge',
                methodName: 'CancelInvoke'
            });

        }
        catch (e) {
            log.error(e + "Visual Studio C++ Redistributables are required. Click Ok to open your default browser and install the required module.");
            shell.openExternal("https://www.microsoft.com/en-us/download/details.aspx?id=48145");
        }
    }

    private static cancelInvoke(requestId: string) {
        console.log("cancelling PS request " + requestId);
        PowerShellExecutor.cancelInvokeClr(requestId, (error, result) => {
            if (error) {
                console.log("Error cancelling request. " + error.toString())
            } else {
                console.log("Cancellation result " + result.toString())
            }
        })
    }

    private static createRunspacePool(runspaceKey: string, startupScript: string): Promise<void> {
        if (!(runspaceKey in PowerShellExecutor.runspaceCreationPromises)) {

            console.log("Creating runspace pool for " + runspaceKey);

            var runspacePromise = new Promise<void>((resolve, reject) => {

                PowerShellExecutor.createRunspacePoolClr(<CreateRunspaceRequest>{
                    RunspaceKey: runspaceKey,
                    StartupScript: startupScript,
                    PromptHandler: PSHostHandler.Prompt
                }, (error, result) => {
                    if (error) {
                        console.log("Error initializing powershell runspace pool. " + error.toString());
                        delete PowerShellExecutor.runspaceCreationPromises[runspaceKey];
                        reject(error);
                    } else {
                        console.log("Created runspace pool for " + runspaceKey);
                        resolve();
                    }
                })
            })

            PowerShellExecutor.runspaceCreationPromises[runspaceKey] = runspacePromise;
            return runspacePromise;
        } else {
            return PowerShellExecutor.runspaceCreationPromises[runspaceKey];
        }
    }

    static invokeScriptAsString(script: string, namespaceName: string, profile?: m.PowershellProfile, lastRequestTabKey?: string): Promise<PSResult> {

        if (!PowerShellExecutor.invokeScriptAsStringClr) {
            PowerShellExecutor.initialize();
        }

        var start = performance.now();

        return new Promise<PSResult>((resolve, reject, onCancel) => {
            let runspaceKey: string;

            runspaceKey = (profile ? namespaceName + profile.name : namespaceName) + (lastRequestTabKey ? lastRequestTabKey : "");

            console.log("RunspaceKey", runspaceKey);
            let requestId = (PowerShellExecutor.requestId++).toString();
            let startupScript = profile ? profile.startupScript : "";

            onCancel(() => PowerShellExecutor.cancelInvoke(requestId));

            PowerShellExecutor.createRunspacePool(runspaceKey, startupScript).then(() => {
                PowerShellExecutor.invokeScriptAsStringClr(
                    {
                        Script: script,
                        RunspaceKey: runspaceKey,
                        RequestId: requestId,
                    }, (error, result) => {
                        let end = performance.now();
                        let executionTimeMs = end - start;
                        //console.log("PowerShell script took " + executionTimeMs + " ms.");

                        if (error) {
                            let errString = error.toString();
                            console.log("PowerShell script returned error " + errString);
                            resolve(<PSResult>{
                                Errors: [errString],
                                Output: "",
                                Warnings: [],
                                ExecutionTimeMs: executionTimeMs
                            })
                        } else {
                            result.ExecutionTimeMs = executionTimeMs;
                            resolve(result);
                        }
                    });
            });
        });
    }

}
