//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />


import { FileFormatState, PersistedState, PersistedTime, StateManager, TabState } from "../state/state";
import { ResourceProviderSelector } from "../extensions/resourceProviders/ResourceProviderSelector";
import { ipcRenderer, remote, clipboard } from "electron";
import * as Promise from "bluebird";
import { Util } from "../util/util";
import * as m from "Model";
let log = require("loglevel");

/**
 * Properties clustered together based on their values.
 */
class ClusteredProperties {
    [value: string]: string[];
}

/**
 * Maps property values to their replacement values
 */
class ReplacementMap {
    [prop: string]: string;
}

/**
 * Maps which properties need to be changed, the current value of the property, and
 * the replacement value.
 */
class ReplacementProperties {
    [value: string]: ReplacementMap;
}

/**
 * Handles link generation and link parsing
 */
export class LinkManager {
    static generateResource(): Promise<string> {
        const resource: m.Resource = {
            type: "link",
            namespace: "",
            description: "",
            relativePath: "",
            showInContextMenu: false,
        };

        const tabManagerState = StateManager.getStore().tabManager.inner;
        const tabState = tabManagerState.tabs[tabManagerState.selectedTabKey] as TabState;
        const webview = tabState.webview;
        const url: string = webview.getURL();

        // Todo: gets these information from resource provider.
        if (url.indexOf("jarvis-west.dc.ad.msft.net") != -1) {
            resource.type = "dgrep";
            if (url.indexOf("dashboard") != -1) {
                resource.type = "jarvis";
            }
        } else if (url.indexOf("web.kusto.windows.net") == -1 && url.startsWith("https://") || url.startsWith("http://")) {
            resource.type = "link";
        } else {
            log.info("Cannot create new resource from this tab. Only dgrep, jarvis and link types are supported for now. Try using Ctrl + N to create a new resource from your clipboard instead.");
            return Promise.resolve("");
        }

        const resourceProvider = ResourceProviderSelector.getResourceProvider(resource);
        return resourceProvider.generateResource(webview);
    }

    /**
     * Applies state data from a link to the Store
     * @param linkData Data passed into the Orb link
     */
    static applyLinkFormatStateToStore(linkData: string) {

        // Parsing the link data
        let linkState: FileFormatState = this.parseLinkString(linkData);

        // Apply the final link data to the store after parsing the decompressed state
        StateManager.applyFileFormatStateToStore(linkState, false, true);
    }

    /**
     * Decodes, decompresses, and inserts parameters defined in an Orb link
     * @param linkData Data passed into the Orb link
     */
    static parseLinkString(linkData: string): FileFormatState {
        if (linkData.endsWith("/")) {
            linkData = linkData.substr(0, linkData.length - 1);
        }

        let stateJSON: string;

        // Handling regular Orb links
        // Removing any URI enocding
        linkData = decodeURIComponent(linkData);

        // Getting URL parameters
        let urlResult = this.getURLParams(linkData);

        let params = urlResult.parameters;

        // Clearing the parameters values from the link data
        linkData = urlResult.cleanURL;

        // Decompressing linkData
        stateJSON = Util.decompressBase64UriComponent(linkData);

        if (params["overrides"]) {
            // Generating the map of override values from the link data
            let overrideMap: ReplacementMap = this.getOverrideMap(params["overrides"]);

            // Subbing overridden values into decompressedState
            stateJSON = this.override(stateJSON, overrideMap)
        }

        return JSON.parse(stateJSON);
    }

    /**
     * Saves the current state to a parameterized link.
     */
    static saveStateToLink() {
        // Getting the current state as a PersistedState object
        let currentState: PersistedState = StateManager.serializeStore(true);
        delete currentState.instance;

        // Getting necessary data for generating the link
        let linkData = this.generateLinkData(currentState);

        // Copying a link with the substituted state and seralized override map to the clipboard
        this.generateLink(linkData.state, linkData.overrideString);
    }

    /**
     * Creates a parameterized state as well as a string for overriding the
     * parameters in the state
     */
    static generateLinkData(currentState: PersistedState): { state: PersistedState, overrideString: string } {

        // Creating a deep copy of the currentState
        currentState = JSON.parse(JSON.stringify(currentState));

        // Clustering the required properties in the current state by value
        let clusteredPropsResult = this.clusterProperties(currentState);
        let clusteredProps = clusteredPropsResult.clusteredProps;
        let conflictingProps = clusteredPropsResult.conflicts;

        // Generating unique IDs for each clustered value
        let replacementValues = this.generateValueIDs(clusteredProps, conflictingProps);

        // Replacing the values for properties that have been clustered
        this.substituteOverrides(currentState, replacementValues);

        // Serializing the override map to a JSON string
        let overrideString = this.generateOverrideString(replacementValues);

        return { state: currentState, overrideString: overrideString };
    }

    /**
     * Parses an override map from a given Orb link. Returns Orb link without URL parameters.
     * @param linkData Data passed into the Orb link
     */
    private static getOverrideMap(overrideString: string): ReplacementMap {
        return JSON.parse(overrideString.replace(/\'/g, '"'));
    }

    /**
     * Extracts URL parameters from an Orb link returns the URL without parameters
     * @param linkData Orb link data
     */
    private static getURLParams(linkData: string): { parameters: { [param: string]: string }, cleanURL: string } {
        let paramSplit = linkData.split("?");
        let params = {};

        // Separating URL from parameters
        if (paramSplit.length > 1) {
            // Separating parameters from each other
            let fullParams = paramSplit[1].split("&");

            fullParams.forEach((param) => {

                // Separating parameter name from value
                let paramPair = param.split("=");
                if (paramPair.length == 2) {
                    params[paramPair[0]] = paramPair[1];
                }
            });
        }

        return { parameters: params, cleanURL: paramSplit[0] };
    }

    /**
     * Replaces specified values with their replacement values
     * @param state JSON string representation of the state object
     * @param overrides ReplacementMap
     */
    private static override(state: string, overrides: ReplacementMap): string {

        // Iterating through the replacement values in the replacement map
        for (let valToReplace in overrides) {
            let regex = new RegExp(`{${valToReplace}}`, "g");

            // Performing a simple regex match for the value and replacing all instances
            // of the value
            state = state.replace(regex, overrides[valToReplace]);
        }

        return state;
    }

    /**
     * Generates an Orb link from a PersistedState object and a string representing the override values
     * and copies the link to the clipboard.
     * @param currentState State to be persisted in the link
     * @param overrideString JSON string representation of the overrides map
     */
    private static generateLink(currentState: PersistedState, overrideString: string) {
        // Encoding the stringified state object
        let encodedUrl = Util.compressAndEncodeBas64Uri(JSON.stringify(currentState, null, 4));

        // Generating clipboard links
        const openInNewUrl = `orbx://new/${encodedUrl}?overrides=${overrideString}`;
        const openInDefaultUrl = `orbx://default/${encodedUrl}?overrides=${overrideString}`;
        const installOrbUrl = "https://aka.ms/orb";
        const template = '[<a href="{0}">{1}</a>]';

        // Writing links to clipboard
        clipboard.write({
            text: openInNewUrl,
            html: template.format(openInNewUrl, "Run in New Orb Instance") + template.format(openInDefaultUrl, "Run in Default Orb Instance") + template.format(installOrbUrl, "Install Orb")
        });

        log.info("URL copied to clipboard");
    }

    /**
     * Groups required properties for objects based on their values. Creates a list of
     * properties that are shared across multiple objects with different values.
     * @param state State object whose properties are to be clustered
     */
    private static clusterProperties(state: PersistedState): { clusteredProps: ClusteredProperties, conflicts: string[] } {
        let clusteredProperties: ClusteredProperties = {};
        let conflictingProps: string[] = [];
        let processedProps: ReplacementMap[] = [];

        // Iterating through each tree in the persisted explorer state
        state.explorerTrees.forEach(tree => {
            let requiredBaseProps = tree.requiredBaseProps;
            let requiredProps = tree.requiredProps;

            // Adding all requiredBaseProperties to clusteredProps
            for (let prop in requiredBaseProps) {
                let value: string = requiredBaseProps[prop];
                this.insertProperty(clusteredProperties, conflictingProps, processedProps, value, prop);
            }

            // Adding all requiredProperties to clusteredProps
            for (let prop in requiredProps) {
                let value: string = requiredProps[prop];
                this.insertProperty(clusteredProperties, conflictingProps, processedProps, value, prop);
            }
        });

        // If time is in absolute mode, add overrides for time
        let explorerTime: PersistedTime = state.explorerTime;
        if (explorerTime.type == "absolute") {
            this.insertProperty(clusteredProperties, conflictingProps, processedProps, explorerTime.startTime, "startTime");
            this.insertProperty(clusteredProperties, conflictingProps, processedProps, explorerTime.endTime, "endTime");
        }

        return { clusteredProps: clusteredProperties, conflicts: conflictingProps };
    }

    /**
     * Helper method for clustering properties. Inserts a value and its corresponding property into
     * a specified clusteredProperties list. Keeps track of which properties have been processed
     * in order to ensure that conflicting properties are noted.
     * @param clusteredProperties ClusteredProperties object to which the value and prop are to be added
     * @param conflictingProperties List of properties that have value conflicts
     * @param processedProperties List of Replacement Maps. Each entry maps a value to its corresponding property.
     * @param value
     * @param prop
     */
    private static insertProperty(clusteredProperties: ClusteredProperties, conflictingProperties: string[],
        processedProperties: ReplacementMap[], value: string, prop: string) {

        if (!clusteredProperties[value]) {
            // If there isn't an array for the clustered property, make one and put the prop in it
            clusteredProperties[value] = [prop];
        } else {
            // Otherwise, just push the property to the array
            clusteredProperties[value].push(prop);
        }

        // Seeing if this property has been processed for a different value
        if (processedProperties.find((processed, index, array) => { return processed[prop] && processed[prop] != value })) {

            // If this property was already processed for a different value, go ahead and add it to
            // the conflict list.
            if (conflictingProperties.indexOf(prop) < 0) {
                conflictingProperties.push(prop);
            }
        } else {

            // Otherwise, the property has not been seen before for a different value, so
            // push it to processed props.
            let newProp: ReplacementMap = {};
            newProp[prop] = value;
            processedProperties.push(newProp);
        }
    }

    /**
     * Generates unique IDs for each value discovered when clustering properties
     * @param clusteredProps
     */
    private static generateValueIDs(clusteredProps: ClusteredProperties, conflictingProperties: string[]): ReplacementProperties {
        let valueIDs: ReplacementProperties = {};

        let propIdCounters: { [property: string]: number } = {};

        // Iterating for each value in the clustered props
        for (let value in clusteredProps) {

            let props: string[] = clusteredProps[value];
            let replacementMap: ReplacementMap = {};
            let propIdConflicts: { [property: string]: boolean } = {};


            // Iterating through each property for which this value exists
            props.forEach((prop) => {

                // Instantiating propIdCounters if necessary
                if (!propIdCounters[prop]) {
                    propIdCounters[prop] = 0;
                }

                let newId: string = prop;

                // If a property has a conflict, append the propId to the conflicting
                // property
                if (conflictingProperties.indexOf(prop) > -1) {
                    newId = prop + propIdCounters[prop];
                    propIdConflicts[prop] = true;
                }

                // Setting the map from the property to the new replacement ID
                replacementMap[prop] = newId;
            });

            valueIDs[value] = replacementMap;

            // Incrementing IDs for each property that encountered a conflict
            for (let prop in propIdConflicts) {
                if (propIdConflicts[prop]) {
                    propIdCounters[prop] += 1;
                }
            }
        }

        return valueIDs;
    }

    /**
     * Replaces each property's value with its specified override ID
     * @param state PersistedState whose properties are to be replaced
     * @param replacementProps Maps values to properties to replacement IDs
     */
    private static substituteOverrides(state: PersistedState, replacementProps: ReplacementProperties) {
        state.explorerTrees.forEach((tree) => {
            let requiredBaseProps = tree.requiredBaseProps;
            let requiredProps = tree.requiredProps;

            // Override all required properties for objects
            for (let prop in requiredBaseProps) {
                this.overrideProperty(requiredBaseProps, prop, replacementProps);
            }

            for (let prop in requiredProps) {
                this.overrideProperty(requiredProps, prop, replacementProps);
            }
        });

        let explorerTime: PersistedTime = state.explorerTime;

        // Overriding time if explorer is in absolute mode
        if (explorerTime.type == "absolute") {
            this.overrideProperty(explorerTime, "startTime", replacementProps);
            this.overrideProperty(explorerTime, "endTime", replacementProps);
        }
    }

    /**
     * Overrides a specified property's value according to the map of properties to replacement IDs
     * @param object Object whose properties are to be overridden
     * @param property Property to be overridden
     * @param replacementProps Maps values to properties to replacement IDs
     */
    private static overrideProperty(object: any, property: string, replacementProps: ReplacementProperties) {
        let curVal: string = object[property];
        let propMap = replacementProps[curVal];

        // Ensuring the property map exists
        if (propMap) {
            let replacementValue = propMap[property];

            // Ensuring the replacement value exists
            if (replacementValue) {
                object[property] = `{${replacementValue}}`;
            }
        }
    }

    /**
     * Stringifies the replacement properties into a clean JSON format
     * @param replacementProps
     */
    private static generateOverrideString(replacementProps: ReplacementProperties): string {
        let replacementMap: ReplacementMap = {};

        // Forming one replacement map for all replace values
        for (let value in replacementProps) {

            // Map that maps properties to replacement values
            let map: ReplacementMap = replacementProps[value];

            for (let prop in map) {
                // Mapping the replacement value to the actual value
                replacementMap[map[prop]] = value;
            }
        }

        return JSON.stringify(replacementMap).replace(/\"/g, "'");
    }
}