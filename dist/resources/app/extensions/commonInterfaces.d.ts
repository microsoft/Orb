//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />

/*
 * Interface that describes the external context handed to the resource/data providers.
 */
export interface IResourceExternalContext {
    startTime: Date;
    endTime: Date;
    isRelativeMode: boolean;
    timeAgoText: string;
}

export interface ExtensionPoints {
    type: "navBar" | "resourceProvider";
    extName?: string;
}

export interface Manifest {
    //Required
    name: string;
    extensionPoints: ExtensionPoints[];
    extensionId: string;
    // Recommended
    contact?: string[];
    description?: string;
    // Not Required
}

export interface PackageManifest extends Manifest {
    icon: string;
}

export interface RepoManifest extends Manifest {
    enableAutoUpdate: boolean;
    payloadPath: string;
    version?: string;
}

export interface ExtensionPersistedState {
    isEnabled: boolean;
}

export interface ExtensionPointNavBar {
    getIcon(): string;
    handleClick?(): void;
    handleContextClick?(): void;
}

export interface ExtensionState extends ExtensionPersistedState, RepoManifest, PackageManifest {
    isInstalled: boolean;
    isLatestVersion: boolean;
    folder: string;
    navBar: ExtensionPointNavBar;
    resource: any;
}

export interface IExtensionDataProvider {
}

