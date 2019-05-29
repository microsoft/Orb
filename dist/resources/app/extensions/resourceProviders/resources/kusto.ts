//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../../../typings/index.d.ts" />

import * as m from "Model";
import { ModelReader } from "../../../modelReader/modelReader";
import { IResourceProvider, IResourceHandleContext, HandleResourceResult, BaseResourceProvider } from ".././ResourceProvider";
import { IResourceExternalContext } from "../../commonInterfaces";
import * as Promise from 'bluebird';
import { shell, remote } from "electron";
import { ResourceProviderHelper } from "../helper";
import { Util } from "../../../util/util";
import { TabState } from "../../../state/state";

export class KustoResourceProvider extends BaseResourceProvider implements IResourceProvider {

    getContextualizedResource(
        resource: m.Resource,
        objectContext: m.ObjectContext,
        objectDefintion: m.ParsedObjectDefinition,
        externalContext: IResourceExternalContext): Promise<string> {

        let kResource = resource as m.KustoResource;
        let kQuery = kResource as m.KustoQuery;

        let startTime = externalContext.startTime.toISOString();
        let endTime = externalContext.endTime.toISOString();
        let isRelativeMode = externalContext.isRelativeMode;
        let timeRange: string, startTimeReplace: string, endTimeReplace: string;
        if (externalContext.isRelativeMode) {
            timeRange = "PreciseTimeStamp >= ago({0})".format(externalContext.timeAgoText);
            startTimeReplace = `ago(${externalContext.timeAgoText})`;
            endTimeReplace = "now()";
        } else {
            timeRange = "PreciseTimeStamp > datetime(\"{0}\") and PreciseTimeStamp < datetime(\"{1}\")".format(startTime, endTime);
            startTimeReplace = `datetime(${startTime})`;
            endTimeReplace = `datetime(${endTime})`;
        }

        let query = kQuery.query.replace(new RegExp("{TimeRange}", "gi"), timeRange);

        // Replacing startTime and endTime in query
        query = query.replace(/{startTime}/gi, startTimeReplace);
        query = query.replace(/{endTime}/gi, endTimeReplace);

        return ResourceProviderHelper.replaceObjectProps(query, objectContext, objectDefintion, externalContext).then(replacedQuery => {

            return ModelReader.getResourceProfile(objectDefintion.original.namespace, kResource.connectionProfile)
                .then((profile: m.KustoConnectionProfile) => {

                    let cloudType: string = objectContext.requiredBaseProps &&
                        objectContext.requiredBaseProps["cloudType"] ?
                        objectContext.requiredBaseProps["cloudType"] :
                        "Public";

                    if (profile.clustersByCloudType && !profile.clustersByCloudType[cloudType]) {
                        throw "Kusto db not found for given cloudType = {0}".format(cloudType);
                    }

                    let db: string = profile.dbsByCloudType && profile.dbsByCloudType[cloudType] ?
                        profile.dbsByCloudType[cloudType] :
                        profile.db;

                    let isPublicCloud = cloudType.toLowerCase() === "public";

                    var url = (profile.clustersByCloudType[cloudType] ? profile.clustersByCloudType[cloudType] : profile.clustersByCloudType["Public"]) + "/" + db + "?";

                    if (isPublicCloud) {
                        // Kusto web explorer doesn't support national clouds yet, as a workaround, force to open all the non public kusto resources in kusto explorer.
                        url = url + "sidebar=0&web=1&";
                    }

                    url = url + (isPublicCloud ? "q=" : "query=") + Util.compressAndEncodeBas64Uri(replacedQuery);
                    url = url.replace(/"/g, '%22');
                    return url;
                });
        });
    }

    isUnprotected() {
        return true;
    }

    getContextMenu(
        resource: m.Resource,
        objectContext: m.ObjectContext,
        objectDefinition: m.ParsedObjectDefinition,
        externalContext: IResourceExternalContext): Electron.Menu {

        return remote.Menu.buildFromTemplate([
            {
                label: 'Open in default browser',
                sublabel: 'Shift+Click',
                click: () => this.getContextualizedResource(resource, objectContext, objectDefinition, externalContext).then(r => shell.openExternal(r)),
            },
            {
                label: 'Open in Kusto explorer',
                click: () => {
                    this.getContextualizedResource(resource, objectContext, objectDefinition, externalContext)
                        .then(r => {
                            let link = r.replace("web=1&q=", "query=");
                            shell.openExternal(link);
                        })
                },
            },
            {
                type: 'separator',
                label: 'sep1'
            },
            {
                label: 'Copy link',
                click: () => this.getContextualizedResource(resource, objectContext, objectDefinition, externalContext).then(r => remote.clipboard.writeText(r)),
            },
        ]);
    }

    createResource(resource: string): string {
        let json = this.getTemplate();
        json.query = resource;
        return JSON.stringify(json);
    }
}

export const ResourceProviderInstance = new KustoResourceProvider("kusto");