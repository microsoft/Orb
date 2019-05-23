//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />

declare module "Model" {

    export interface OverridableConfig {
        owner?: string;
        name: string;
    }

    export interface OrbConfig extends OverridableConfig {
        settings: {
            [name: string]: {
                "owner": string,
                "value": any
            }
        }
    }

    export interface NotificationConfig extends OverridableConfig {
        endTimeUtc: string,
        owner: string;
        on: boolean;
        showIntervalInMinutes: number;
        autoHideDurationInSeconds: number;
        message: string;
        userDomain: string;
        action: {
            label: string
            url: string
        }
    }

    export interface NamespaceConfig {
        name: string
        objectRoot: string
        requiredBaseProps: Array<RequiredBaseProps>
        resourceProfiles: ResourceProfile[]
    }

    export interface RequiredBaseProps {
        name: string
        type: string
        value: any
        label?: string
    }

    namespace ResourceProfileTypes {
        export type Kusto = "kusto"
        export type Dgrep = "dgrep"
        export type Powershell = "powershell"
    }

    export interface ResourceProfile {
        name: string,
        type: ResourceProfileTypes.Dgrep | ResourceProfileTypes.Kusto | ResourceProfileTypes.Powershell
    }

    export interface KustoConnectionProfile extends ResourceProfile {
        db: string,
        clustersByCloudType: { [key: string]: string }
        dbsByCloudType: { [key: string]: string }
        errorHelpMap: { [key: string]: string }
    }

    export interface PowershellProfile extends ResourceProfile {
        startupScript: string,
    }

    export interface DgrepConnectionProfile extends ResourceProfile {
        endpointsByCloudType: { [key: string]: string }
    }

    export interface KustoQuery {
        connectionProfile: string;
        query: string;
        minimumResolutionInMinutes?: number;
    }

    export interface PowershellConstructor extends PowershellQuery, DataProviderResource {
    }

    export interface PowershellQuery {
        powershellProfile: string;
        script: string;
    }

    export interface PowershellProp extends AdditionalProp, PowershellQuery {
    }

    export interface DataProviderResource {
        type: string;
        isUnprotected?: boolean;
    }

    export interface AdditionalProp extends DataProviderResource {
        name: string | string[];
    }

    export interface KustoConstructor extends DataProviderResource, KustoQuery {
        wildcardQuery: string;
    }

    export interface ConstantProp extends AdditionalProp {
        value: any
    }

    export interface KustoProp extends AdditionalProp, KustoQuery {
    }

    export interface Resource {
        namespace: string;
        type: string;
        relativePath: string;
        description: string;
        showInContextMenu: boolean;
        showInQuickActionMenu?: boolean;
        isUnprotected?: boolean;
    }

    export interface AllocationDetailsResource extends Resource {
        allocationContext: string;
    }

    export interface KustoResource extends Resource, KustoQuery { }

    export interface DGrepResource extends Resource {
        link: string;
        connectionProfile: string;
    }

    export interface PowershellResource extends Resource {
        powershellProfile: string;
        launchParameters?: string;
        script: string;
        style: {};
    }

    export interface PsmdOptions {
        outputFormat: "auto" | "rawMarkdown" | "objectExplorer";
        formatOptions?: PsmdFormatOptions;
    }

    export interface PsmdFormatOptions { }

    export interface PsmdObjectExplorerFormatOptions extends PsmdFormatOptions {
        displayDepth?: number;
        parseDepth?: number;
    }

    export interface PsmdResource extends PowershellResource {
        options?: PsmdOptions
    }

    export interface LinkResource extends Resource {
        link: string;
    }

    export interface AcisResource extends Resource {
        link: string;
    }

    export interface JarvisResource extends LinkResource {
    }

    export interface Association extends DataProviderResource {
        relativePath: string;
        associatedObjectPath: string;
        associatedObjectNamespace?: string;
    }

    export interface ObjectDefinition {
        namespace: string;
        path: string;
        requiredProps: string[];
        key: string;
        props: string[];
        constructor: DataProviderResource;
        additionalProps?: AdditionalProp[];
        resources: Resource[];
        associations: Association[];
        searchHint?: string;
        displayName?: string;
        disablePathlessSearch?: boolean;
        hideFromSearch?: boolean;
    }

    export interface ParsedObjectDefinition {
        explorerResources: Resource[];
        contextMenuResources: Resource[];
        resourceByRelativePath: StringMap<Resource>;
        resourceByRelativePathWithExtension: StringMap<Resource>;
        original: ObjectDefinition;
        fileName?: string;
        filePaths?: string[];
    }

    export interface ObjectContext {
        requiredProps: any;
        requiredBaseProps?: any;
    }
}