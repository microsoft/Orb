//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../../typings/index.d.ts" />

import * as m from "Model";
import { IDataProvider } from "./dataProvider";
import { Kusto } from '../../data/kusto';
import * as Promise from 'bluebird';
import { ResourceProviderHelper } from "../resourceProviders/helper";
import { IDataProviderResourceExternalContext } from "./dataProvider";

export default class KustoDataProvider implements IDataProvider {

    getObjectSearchData(
        searchKey: string,
        dataResource: m.DataProviderResource,
        objectDefinition: m.ParsedObjectDefinition,
        externalContext: IDataProviderResourceExternalContext,
        limit: number,
        objectContext?: m.ObjectContext): Promise<any[]> {

        let requiredProps = {};

        let constructor = dataResource as m.KustoConstructor;
        let searchQuery = constructor.wildcardQuery;
        if (!searchKey) {
            requiredProps[objectDefinition.original.key] = ".*";
        } else if (searchKey.indexOf("*") === -1) {
            requiredProps[objectDefinition.original.key] = searchKey;
            searchQuery = constructor.query;
        } else {
            requiredProps[objectDefinition.original.key] = "(?i)" + searchKey.split("*").join(".*");
        }

        // create a dummy objectContext to allow reusing the contextualize function.
        if (objectContext != null) {
            objectContext.requiredProps = Object.assign({}, objectContext.requiredProps, requiredProps);
        } else {
            objectContext = {
                requiredProps: requiredProps
            }
        }

        let kustoQuery = Object.assign({}, constructor, { query: searchQuery });

        return this.getContextualizedData(kustoQuery, objectContext, objectDefinition, externalContext, limit);
    }

    getAssociationData(
        dataResource: m.DataProviderResource,
        objectContext: m.ObjectContext,
        objectDefinition: m.ParsedObjectDefinition,
        externalContext: IDataProviderResourceExternalContext,
        limit: number): Promise<any[]> {

        let kustoQuery = dataResource as m.KustoConstructor;
        return this.getContextualizedData(kustoQuery, objectContext, objectDefinition, externalContext, limit);
    }

    getAdditionalPropData(
        dataResource: m.DataProviderResource,
        objectContext: m.ObjectContext,
        objectDefinition: m.ParsedObjectDefinition,
        externalContext: IDataProviderResourceExternalContext): Promise<any> {

        let kustoQuery = dataResource as m.KustoProp;
        return this.getContextualizedData(kustoQuery, objectContext, objectDefinition, externalContext, 1).then(result => {
            if (result && result.length > 0) {
                // for props, always return just the first row.
                return result[0];
            }
            return {};
        });
    }

    isUnprotected() {
        return true;
    }

    private getContextualizedData(
        kustoQuery: m.KustoQuery,
        objectContext: m.ObjectContext,
        objectDefinition: m.ParsedObjectDefinition,
        externalContext: IDataProviderResourceExternalContext,
        limit: number): Promise<any[]> {
        return this.getContextualizedQuery(kustoQuery, objectContext, objectDefinition, externalContext, limit).then(query => {
            if (!query) {
                throw "search query can not be empty";
            }

            let cloudType = objectContext.requiredBaseProps && objectContext.requiredBaseProps["cloudType"] ? objectContext.requiredBaseProps["cloudType"] : "Public";

            return Kusto.executeQueryFromProfile(objectDefinition.original.namespace, kustoQuery.connectionProfile, query, cloudType).then(data => {
                if (data.rowCount() > 0) {
                    return data.asJson();
                }

                return [];
            });
        });

    }

    private getContextualizedQuery(
        kustoQuery: m.KustoQuery,
        objectContext: m.ObjectContext,
        objectDefinition: m.ParsedObjectDefinition,
        externalContext: IDataProviderResourceExternalContext,
        limit: number): Promise<string> {

        let startTimeReplace: string;
        let endTimeReplace: string;

        let timeRange;
        if (externalContext.isRelativeMode) {
            let minimumResolutionInMinutes = kustoQuery.minimumResolutionInMinutes;
            let timeAgoText = minimumResolutionInMinutes
                && minimumResolutionInMinutes > ResourceProviderHelper.convertTimeAgoToMinutes(externalContext.timeAgoText)
                ? minimumResolutionInMinutes + "m" : externalContext.timeAgoText;
            timeRange = "PreciseTimeStamp >= ago({0})".format(timeAgoText);

            endTimeReplace = "now()";
            startTimeReplace = `ago(${timeAgoText})`;

        } else {
            const MS_PER_MINUTE = 60000;
            let minTimeInterval = (kustoQuery.minimumResolutionInMinutes || 0) * MS_PER_MINUTE;
            let startTime = externalContext.startTime;
            let endTime = externalContext.endTime;
            if (endTime.getTime() - startTime.getTime() < minTimeInterval) {
                startTime = new Date(endTime.getTime() - minTimeInterval);
            }

            timeRange = "PreciseTimeStamp > datetime(\"{0}\") and PreciseTimeStamp < datetime(\"{1}\")"
                .format(startTime.toISOString(), endTime.toISOString());

            startTimeReplace = `datetime(${startTime.toISOString()})`;
            endTimeReplace = `datetime(${endTime.toISOString()})`;
        }

        let query = kustoQuery.query.replace(new RegExp("{TimeRange}", "gi"), timeRange);

        // Replacing startTime and endTime in query
        query = query.replace(/{startTime}/gi, startTimeReplace);
        query = query.replace(/{endTime}/gi, endTimeReplace);

        return ResourceProviderHelper.replaceObjectProps(query, objectContext, objectDefinition, externalContext).then(newQuery => {
            if (limit > 0) {
                return (newQuery + " | limit " + (limit).toString())
            }
            return newQuery;
        });
    }
}