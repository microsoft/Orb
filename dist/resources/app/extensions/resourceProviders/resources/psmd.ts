/*------------------------------------------------------------
   Copyright (c) Microsoft Corporation.  All rights reserved.
------------------------------------------------------------*/

/// <reference path="../../../typings/index.d.ts" />

import * as m from "Model";
import { ModelReader } from "../../../modelReader/modelReader";
import { IResourceProvider, IResourceHandleContext, ContentManagerSetUrl, HandleResourceResult, BaseResourceProvider } from "../ResourceProvider";
import { IResourceExternalContext } from "../../commonInterfaces";
import * as Promise from "bluebird";
import { shell, remote } from "electron";
import * as path from "path";
import * as cp from "child_process";
import { ResourceProviderHelper } from "../helper";
import { PowerShellExecutor, PSResult } from "../../../data/ps";
import { StateManager, Constants } from "../../../state/state";
import { Util } from "../../../util/util";

export class PsmdResourceProvider extends BaseResourceProvider implements IResourceProvider {

    private static spinnerGifPath: string = "../assets/ring.svg";
    /* tslint:disable:max-line-length */
    private static initialMdTemplate = "# {0} \n\n Running Script:\n\n```powershell \n{1}``` \n\n<a href=../terminal/terminal.html?data={2} target=\"_blank\">Run in Terminal</a>\n\n" + "![](" + PsmdResourceProvider.spinnerGifPath + ")\n";
    private static resultMdTemplate = "# {0} \n\n {1} \n\n --- \n\n{2}```powershell \n{3}``` \n\n Script Executed ({4} ms):\n\n<a href=../terminal/terminal.html?data={5} target=\"_blank\">Run in Terminal</a>\n\n";
    /* tslint:enable:max-line-length */

    getContextualizedResource(
        resource: m.Resource,
        objectContext: m.ObjectContext,
        objectDefinition: m.ParsedObjectDefinition,
        externalContext: IResourceExternalContext): Promise<string> {

        // replace parameters in the link with the object/global context
        let psResource: m.PowershellResource = resource as m.PowershellResource;

        return ResourceProviderHelper.getDefaultContextualizedResouce(
            psResource.script, objectContext, objectDefinition, externalContext);
    }

    handleResource(
        contextualizedResource: string,
        resource: m.PsmdResource,
        objectDefinition: m.ParsedObjectDefinition,
        handleContext: IResourceHandleContext,
        setContentManagerUrl: ContentManagerSetUrl): HandleResourceResult {

        let newPromise: Promise<any>;
        let objectNamespace: string = objectDefinition.original.namespace;

        if (resource.powershellProfile) {
            newPromise = ModelReader.getResourceProfile(objectNamespace, resource.powershellProfile)
                .then((profile: m.PowershellProfile) => {
                    return this.handleResourceInternal(
                        contextualizedResource, resource, objectNamespace, handleContext, profile, setContentManagerUrl);
                });
        } else {
            newPromise = this.handleResourceInternal(
                contextualizedResource, resource, objectNamespace, handleContext, null, setContentManagerUrl);
        }

        return <HandleResourceResult>{
            promise: newPromise
        };
    }

    handleResourceInternal(
        contextualizedResource: string,
        resource: m.PsmdResource,
        objectNamespace: string,
        handleContext: IResourceHandleContext,
        profile: m.PowershellProfile,
        setContentManagerUrl: ContentManagerSetUrl): Promise<any> {

        let fullTerminalData: string = "";
        if (profile && profile.startupScript) {
            fullTerminalData += (profile.startupScript + "\r");
        }

        fullTerminalData += (contextualizedResource + "\r");
        fullTerminalData = encodeURI(Util.toBase64(fullTerminalData));

        // this resource handler takes the powershell script result and loads the Orb markdown url.
        // the orb markdown page has a javascript event handler that listens for events to populate the markdown page.
        let tabKey: string = setContentManagerUrl(
            Constants.mdUrl,
            {
                incarnation: Date.now().toString(),
                // load an initial webpage showing the script being run.
                webviewContext: PsmdResourceProvider.initialMdTemplate.format(
                    resource.relativePath, contextualizedResource, fullTerminalData)
            },
            handleContext.ctrlKey ? true : false);

        let isObjectExplorer: boolean = resource.options && resource.options.outputFormat === "objectExplorer";

        if (isObjectExplorer) {
            let formatOptions: m.PsmdObjectExplorerFormatOptions = resource.options.formatOptions;
            let parseDepth: number = (formatOptions) ? formatOptions.parseDepth : null;

            let depthString: string = (parseDepth != null) ? `-Depth ${parseDepth}` : "";

            contextualizedResource += ` | ConvertTo-JSON ${depthString}`;
        }

        return PowerShellExecutor.invokeScriptAsString(
            contextualizedResource,
            objectNamespace,
            profile,
            tabKey)
            .then((result) => {
                let outputSection: string;
                if (isObjectExplorer) {
                    // parse output to object explorer tag
                    let displayDepth: number;
                    if (resource.options.formatOptions) {
                        displayDepth =
                            (resource.options.formatOptions as m.PsmdObjectExplorerFormatOptions).displayDepth;
                    }

                    // Escaping asterisks to prevent markdown reading them as italics
                    result.Output = result.Output.replace(/\*/g, "\\*");

                    // Fixing PowerShell's non-standard DateTime format
                    const dateRegex = /\\\/Date(.*)\\\//g;
                    const dateOutput: string = result.Output.replace(dateRegex, (match: string, millis: string) => {
                        // Converting millis string to numerical value
                        const millisVal: number = +millis.substr(1, millis.length - 2);
                        return (new Date(millisVal)).toUTCString();
                    });

                    outputSection = `<objectExplorer${displayDepth != null ? ` depth="${displayDepth}"` : ""}>
                        ${dateOutput}</objectExplorer>`;
                } else if (resource.options && resource.options.outputFormat === "rawMarkdown") {
                    // inject the raw markdown output
                    outputSection = result.Output;
                } else {
                    // format the output as markdown automatically.
                    // for now, just encapsulate the output in a <pre> tag.
                    outputSection = "<pre>" + result.Output + "</pre>";
                }

                let errorSection: string = "";

                if (result.Warnings && result.Warnings.length > 0) {
                    errorSection += "\n\n## Warnings\n\n";
                    result.Warnings.forEach(w => {
                        errorSection += ("<pre style=\"color:#d9e444\">" + w + "</pre>\n\n");
                    });
                }

                if (result.Errors && result.Errors.length > 0) {
                    errorSection += "\n\n## Errors\n\n";
                    result.Errors.forEach(e => {
                        errorSection += ("<pre style=\"color:#ff7878\">" + e + "</pre>\n\n");
                    });
                }

                let md: string = PsmdResourceProvider.resultMdTemplate.format(
                    resource.relativePath, outputSection, errorSection, contextualizedResource, result.ExecutionTimeMs.toFixed(2), fullTerminalData);

                setContentManagerUrl(
                    Constants.mdUrl,
                    {
                        incarnation: Date.now().toString(),
                        webviewContext: md
                    },
                    false);
            });
    }

    getContextMenu(
        resource: m.Resource,
        objectContext: m.ObjectContext,
        objectDefinition: m.ParsedObjectDefinition,
        externalContext: IResourceExternalContext): Electron.Menu {

        return remote.Menu.buildFromTemplate([
            {
                label: "Copy script",
                click: () => this.getContextualizedResource(
                    resource, objectContext, objectDefinition, externalContext).then(r => remote.clipboard.writeText(r))
            }
        ]);
    }

    createResource(resource: string): string {
        let json = this.getTemplate();
        json.script = resource;
        return JSON.stringify(json);
    }
}

export const ResourceProviderInstance: PsmdResourceProvider = new PsmdResourceProvider("psmd");