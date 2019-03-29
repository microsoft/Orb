//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../../typings/index.d.ts" />
import * as m from "Model";
import * as Promise from 'bluebird';
import { IResourceExternalContext } from "../commonInterfaces";

export interface IDataProviderResourceExternalContext extends IResourceExternalContext {

}

export interface IDataProvider {

    /**
     * Called when search is performed on objects using the data provider. Needs to have ability to accept
     * all search keys, including null and empty. Should return an array of requiredProps to create object
     * definitions.
     */
    getObjectSearchData(
        searchKey: string,
        dataResource: m.DataProviderResource,
        objectDefinition: m.ParsedObjectDefinition,
        externalContext: IDataProviderResourceExternalContext,
        limit: number,
        objectContext?: m.ObjectContext): Promise<any[]>;

    /**
     * Called when associated objects are queried in the explorer view using the data provider. Should return
     * an array of requiredProps to create the object definition.
     */
    getAssociationData(
        dataResource: m.DataProviderResource,
        objectContext: m.ObjectContext,
        objectDefinition: m.ParsedObjectDefinition,
        externalContext: IDataProviderResourceExternalContext,
        limit: number): Promise<any[]>;

    /**
     * Called when an object has additionalPropData defined using the data provider. Should return an object that contains
     * keys and all of the values defined by the DataProviderResource
     */
    getAdditionalPropData(
        dataResource: m.DataProviderResource,
        objectContext: m.ObjectContext,
        objectDefinition: m.ParsedObjectDefinition,
        externalContext: IDataProviderResourceExternalContext): Promise<any>;

    isUnprotected?(): boolean;
}