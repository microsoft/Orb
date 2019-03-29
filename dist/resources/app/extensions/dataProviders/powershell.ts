//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../../typings/index.d.ts" />

import * as m from 'Model';
import { ModelReader } from "../../modelReader/modelReader"
import { IDataProvider } from "./dataProvider";
import { PowerShellExecutor, PSResult } from '../../data/ps';
import * as Promise from 'bluebird';
import { ResourceProviderHelper } from "../resourceProviders/helper";
import { IDataProviderResourceExternalContext } from "./dataProvider";

const log = require("loglevel");

export default class PowershellDataProvider implements IDataProvider {

    /**
     * Gets the search results for a query using a Powershell script
     * @param searchKey Key to be searched
     * @param dataResource  Powershell data provider resource
     * @param objectDefinition
     * @param externalContext
     * @param limit Limit on number of entries
     * @param objectContext
     */
    getObjectSearchData(
        searchKey: string,
        dataResource: m.DataProviderResource,
        objectDefinition: m.ParsedObjectDefinition,
        externalContext: IDataProviderResourceExternalContext,
        limit: number,
        objectContext?: m.ObjectContext): Promise<any[]> {

        let psConstructor: m.PowershellConstructor = dataResource as m.PowershellConstructor;
        let requiredProps = {};

        if (!searchKey) {
            // If no search key defined, set the key to wildcard.
            requiredProps[objectDefinition.original.key] = "*";
        } else {
            // Otherwise, use defined search key
            requiredProps[objectDefinition.original.key] = searchKey;
        }

        // create an objectContext to allow reusing the contextualize function.
        if (objectContext != null) {
            objectContext.requiredProps = Object.assign({}, objectContext.requiredProps, requiredProps);
        } else {
            objectContext = {
                requiredProps: requiredProps
            }
        }

        // Parsing powershell query output using JSON. Will return any[]
        return this.getContextualizedResult(psConstructor, objectContext, objectDefinition, externalContext, limit, true);
    }

    /**
     * Runs Powershell script to get Powershell associated objects (returns an array of objects that contain
     * required properties and required base properties)
     * @param dataResource Powershell data provider resource
     * @param objectContext 
     * @param objectDefinition 
     * @param externalContext 
     * @param limit Limit on number of entries
     */
    getAssociationData(
        dataResource: m.DataProviderResource,
        objectContext: m.ObjectContext,
        objectDefinition: m.ParsedObjectDefinition,
        externalContext: IDataProviderResourceExternalContext,
        limit: number): Promise<any[]> {

        let psConstructor: m.PowershellConstructor = dataResource as m.PowershellConstructor;
        return this.getContextualizedResult(psConstructor, objectContext, objectDefinition, externalContext, limit, true);
    }

    /**
     * Runs Powershell script to get additional property data for an object
     * @param dataResource Powershell data provider resource
     * @param objectContext 
     * @param objectDefinition 
     * @param externalContext
     */
    getAdditionalPropData(
        dataResource: m.DataProviderResource,
        objectContext: m.ObjectContext,
        objectDefinition: m.ParsedObjectDefinition,
        externalContext: IDataProviderResourceExternalContext): Promise<any> {

        let powershellQuery = dataResource as m.PowershellProp;
        return this.getContextualizedResult(powershellQuery, objectContext, objectDefinition, externalContext, 1);
    }

    /**
     * Contextualizes a Powershell script and gets the result
     * @param powershellQuery Script to be contextualized and run
     * @param objectContext 
     * @param objectDefinition 
     * @param externalContext 
     * @param limit Limit on number of entries
     * @param outputAsArray Flag that enforces the output being an array
     */
    private getContextualizedResult(
        powershellQuery: m.PowershellQuery,
        objectContext: m.ObjectContext,
        objectDefinition: m.ParsedObjectDefinition,
        externalContext: IDataProviderResourceExternalContext,
        limit: number,
        outputAsArray?: boolean): Promise<any[] | any> {

        return this.getContextualizedQuery(powershellQuery, objectContext, objectDefinition, externalContext, limit).then((query) => {
            let namespace: string = objectDefinition.original.namespace;

            console.log("Running PowerShell Script: " + query);

            if (powershellQuery.powershellProfile) {
                return ModelReader.getResourceProfile(namespace, powershellQuery.powershellProfile).then((psProfile: m.PowershellProfile) => {
                    return PowerShellExecutor.invokeScriptAsString(query, namespace, psProfile).then((result) => {
                        return this.onResult(result, outputAsArray);
                    });
                });
            } else {
                return PowerShellExecutor.invokeScriptAsString(query, namespace).then((result) => {
                    return this.onResult(result, outputAsArray);
                });
            }
        });
    }

    /**
     * Performs specified parsing logic, if any, on the PowerShell output
     * @param result 
     * @param outputAsArray 
     */
    private onResult(result: PSResult, outputAsArray?: boolean): any {

        // Alerting PowerShell errors
        if (result.Errors) {
            result.Errors.forEach((error) => {
                log.error(error);
            });
        }

        let returnVal: any | any[] = result.Output;

        if (returnVal) {
            // Only parsing existing return values
            returnVal = JSON.parse(returnVal);

            // ConvertTo-JSON absorbs single element arrays, so if the expected output
            // is an array, ensure that an array is returned.
            if (outputAsArray) {
                if (!(returnVal instanceof Array)) {
                    returnVal = [returnVal];
                }
            }
        } else {
            // If no value is returned by the script, output either an empty array or an empty object
            returnVal = outputAsArray ? [] : {};
        }

        return returnVal;
    }

    /**
     * Contextualizes an object model-defined Powershell script 
     * @param powershellQuery Script to be contextualized
     * @param objectContext 
     * @param objectDefinition 
     * @param externalContext 
     * @param limit Limit on number of entries
     */
    private getContextualizedQuery(
        powershellQuery: m.PowershellQuery,
        objectContext: m.ObjectContext,
        objectDefinition: m.ParsedObjectDefinition,
        externalContext: IDataProviderResourceExternalContext,
        limit: number): Promise<string> {

        // Converting output objects to JSON if specified
        let script: string = `${powershellQuery.script} | ConvertTo-Json`;

        // Replacing limit variable
        script = script.replace(/{Limit}/gi, limit.toString());

        return ResourceProviderHelper.replaceObjectProps(script, objectContext, objectDefinition, externalContext);
    }
}