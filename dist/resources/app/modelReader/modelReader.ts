//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------
/// <reference path="../typings/index.d.ts" />

import * as Promise from "bluebird";
import * as m from "Model";
import * as path from "path";
import { ConfigUtil } from "../config/configUtil";
import { DataProviderSelector } from "../extensions/dataProviders/dataProviderSelector";
import { ResourceProviderSelector } from "../extensions/resourceProviders/ResourceProviderSelector";
import { StateManager } from "../state/state";
import { Util } from "../util/util";
let log = require("loglevel");

declare type require = any;
const glob: any = Promise.promisify(require("glob"));
const readJson: any = Promise.promisify(require("fs-extra").readJson);
if (!String.prototype.format) {
    String.prototype.format = function () {
        var args = arguments;
        return this.replace(/{(\d+)}/g, function (match, n) {
            return typeof args[n] !== "undefined" ? args[n] : match;
        });
    };
}

export class ModelReader {

    private static namespaceCache: { [key: string]: m.NamespaceConfig };
    private static namespaceCacheArray: m.NamespaceConfig[];

    // Namespace to object definition map
    private static objectDefinitionCache: { [key: string]: { [key: string]: m.ParsedObjectDefinition } } = {};

    private static resourceProfileCache: { [key: string]: { [key: string]: m.ResourceProfile } } = {};

    private static configCache: { [key: string]: m.OverridableConfig };

    public static getFilePath(namespace: string, objectPath: string): string {
        return path.join(ConfigUtil.GetSetting("modelRepoDir"), "src\\Models", namespace, "Objects", objectPath + ".json");
    }

    public static getFlightPath(namespace: string, flightPath: string): string {
        return path.join(ConfigUtil.GetSetting("modelRepoDir"), "src\\Models", namespace, "Flights", flightPath + ".json");
    }

    public static validateAndParseObjectDefinition(object: m.ObjectDefinition): Promise<any> {
        return this.readObjectDefinitions(object.namespace);
    }

    public static readConfig(): Promise<any> {
        if (this.configCache && Object.keys(this.configCache).length > 0) {
            return Promise.resolve(this.configCache);
        }

        this.configCache = {};

        return glob(path.join(ConfigUtil.GetSetting("modelRepoDir"), "src\\ProtectedModels\\*.config.json"))
            .map((path) => readJson(path))
            .each((json) => {
                this.configCache[json.name] = json;
            }).then(() => {
                return this.configCache;
            })
            .catch((e) => { throw "Error reading configuration: " + e.toString() });
    }

    // Gets Orb setting by name, returns null if setting is not found.
    public static getOrbSetting(settingName: string): Promise<any> {
        return ModelReader.getConfigByName("orb").then((config: m.OrbConfig) => {
            if (!config || !config.settings || !config.settings[settingName]) {
                return null;
            }

            let value = config.settings[settingName].value;

            if (Object.keys(value).length > 0) {
                if ("insiders" in value && "production" in value && "dev" in value && Object.keys(value).length == 3) {
                    if (Util.isInsiders()) {
                        return value.insiders;
                    } else if (Util.isRunningInDev()) {
                        return value.dev;
                    } else {
                        return value.production;
                    }
                } else {
                    throw "Invalid setting found for " + settingName;
                }
            }

            return value;
        })
    }

    public static getConfigByName(name: string): Promise<any> {
        return this.readConfig().then((config) => {
            return config[name];
        });
    }

    public static validateObjectDefinition(currentResult: { [key: string]: m.ParsedObjectDefinition }, object: m.ObjectDefinition, filePath?: string): Promise<void> {
        if (object.path in currentResult) {
            return Promise.reject("Duplicate object path found " + object.path);
        }

        if (object.additionalProps && object.additionalProps.length > 0) {
            object.additionalProps.forEach(prop => {
                if (prop.type === "constant") {
                    const constProp = prop as m.ConstantProp;

                    if (!constProp.name || !constProp.value) {
                        return Promise.reject("constant property should specify name and value for object " + object.path);
                    }
                } // TODO: Allow data providers to validate.
            })
        }

        if (filePath) {
            return this.validateObjectProtectionBeforeMerge(object, filePath).then((res) => {
                if (!res.result) {
                    throw res.errorMessage;
                }
            });
        } else {
            return Promise.resolve();
        }
    }

    public static validateObjectAssociation(object: m.ObjectDefinition): Promise<m.ParsedObjectDefinition[]> {
        let promises = [];
        if (object.associations) {
            object.associations.forEach(a => {
                promises.push(ModelReader.validateAssociation(a, object));
            });
        }

        return Promise.all(promises);
    }

    public static parseObjectDefinition(object: m.ObjectDefinition): m.ParsedObjectDefinition {

        let explorerResources: m.Resource[] = [];
        let contextMenuResources: m.Resource[] = [];
        let resourceMap: StringMap<m.Resource> = {};
        let resourceMapWithExtension: StringMap<m.Resource> = {};

        object.resources.push({
            relativePath: "Properties",
            type: "prop",
            showInContextMenu: true,
            description: "",
            namespace: ""
        });

        object.resources.forEach(r => {
            ModelReader.validateResource(r);
            if (!r.namespace) {
                r.namespace = object.namespace;
            }
            if (r.showInContextMenu) {
                contextMenuResources.push(r);
            } else {
                explorerResources.push(r);
            }

            resourceMap[r.relativePath] = r;
            let nameWithExtension = r.relativePath + "." + r.type;
            resourceMapWithExtension[nameWithExtension] = r;
        });

        let isGlobal = !object.key;

        if (!isGlobal) {

            if (!object.requiredProps || object.requiredProps.length === 0) {
                throw "Object with no requiredProps is not allowed " + object.path
            }

            if (!object.requiredProps.find((value) => value === object.key)) {
                throw "Object key " + object.key + " not found in required props for " + object.path;
            }
        }

        return <m.ParsedObjectDefinition>{
            contextMenuResources: contextMenuResources,
            explorerResources: explorerResources,
            path: object.path,
            resourceByRelativePath: resourceMap,
            resourceByRelativePathWithExtension: resourceMapWithExtension,
            original: object
        }
    }

    public static validateNamespace(config: m.NamespaceConfig) {
        if (!config) {
            throw "Empty namespace config";
        }
    }

    public static getObjectDefinitions(namespaceName: string): Promise<{ [key: string]: m.ParsedObjectDefinition }> {
        if (namespaceName in ModelReader.objectDefinitionCache) {
            return Promise.resolve(ModelReader.objectDefinitionCache[namespaceName]);
        }

        return ModelReader.readObjectDefinitions(namespaceName);
    }

    public static getObjectDefinition(namespaceName: string, objectPath: string): Promise<m.ParsedObjectDefinition> {
        return ModelReader.getObjectDefinitions(namespaceName)
            .then((defintions) => {
                if (!(objectPath in defintions)) {
                    throw "Object not found: " + objectPath;
                }

                return defintions[objectPath];
            });
    }

    public static validateModelFiles() {
        return ModelReader.readNamespaces(true).map((namespaceConfig: m.NamespaceConfig) => {
            return ModelReader.readObjectDefinitions(namespaceConfig.name, true);
        });
    }

    public static clearNamespaceCache() {
        ModelReader.namespaceCache = null;
        ModelReader.namespaceCacheArray = [];
        ModelReader.updateNameSpaceSrc();
    }

    public static updateNameSpaceSrc() {
        const searchState = StateManager.getStore().sideBar.inner.search.inner;
        searchState.setInProgress(true);
        searchState.clearNameSpaceSrc();
        ModelReader.getNameSpaces().then((namespaces) => {
            for (let namespace of namespaces) {
                searchState.addNameSpaceToSrc(namespace.name);
            }

            searchState.setInProgress(false);
        }).catch((e) => {
            log.error(e);
            searchState.setInProgress(false);
        });
    }

    public static clearObjectDefinitionCache(namespace: string = "") {
        if (!namespace) {
            ModelReader.objectDefinitionCache = {};
            return;
        }

        if (ModelReader.objectDefinitionCache[namespace]) {
            delete ModelReader.objectDefinitionCache[namespace];
        }
    }

    public static getNameSpaces(): Promise<m.NamespaceConfig[]> {
        if (ModelReader.namespaceCache) {
            return Promise.resolve(ModelReader.namespaceCacheArray);
        }

        return ModelReader.readNamespaces();
    }

    public static getNameSpace(name: string): Promise<m.NamespaceConfig> {
        return ModelReader.getNameSpaces().then(() => {
            if (!(name in ModelReader.namespaceCache)) {
                throw "Namespace not found: " + name;
            }

            return ModelReader.namespaceCache[name];
        })
    }

    public static getResourceProfile(namespaceName: string, profileName: string): Promise<m.ResourceProfile> {

        return ModelReader.getNameSpace(namespaceName)
            .then(() => {
                if (!(profileName in ModelReader.resourceProfileCache[namespaceName])) {
                    throw "Resource profile not found: " + profileName;
                }
                return ModelReader.resourceProfileCache[namespaceName][profileName];
            });
    }

    public static getRequiredBaseProps(namespaceName: string): Promise<m.RequiredBaseProps[]> {
        return ModelReader.getNameSpace(namespaceName).then((namespaceConfig: m.NamespaceConfig) => {
            return namespaceConfig.requiredBaseProps;
        })
    }

    private static readNamespaces(throwInnerException = false): Promise<m.NamespaceConfig[]> {
        let cache = {};
        let arr = [];
        let innerExceptions = [];

        return glob(path.join(ConfigUtil.GetSetting("modelRepoDir"), "src\\**\\namespaceConfig.json"))
            .then((filePaths) => {
                let readPromises = [];
                filePaths.forEach((filePath) => {
                    readPromises.push(
                        this.readSplitJson(filePath).catch((e) => {
                            innerExceptions.push(e);
                        })
                    );
                })

                return Promise.all(readPromises);
            })
            .then((resArray: Array<{ json: any, associatedPath: String[] }>) => {
                resArray.forEach((res) => {
                    if (!res || Util.isTemplate(res.json)) {
                        // Bypass validation for template file.
                        return;
                    }

                    ModelReader.validateNamespaces(cache, res.json);
                    cache[res.json.name] = res.json;
                    arr.push(res.json);
                    ModelReader.addResourceProfilesFromNamespaceConfig(res.json);
                })
            }).then(() => {
                if (innerExceptions.length > 0) {
                    if (throwInnerException) {
                        throw innerExceptions.join(";");
                    } else {
                        log.error(innerExceptions.join(";"));
                    }
                }

                if (arr.length === 0) {
                    throw "No namespaces found";
                }

                ModelReader.namespaceCache = cache;
                ModelReader.namespaceCacheArray = arr;

                return arr;
            })
            .catch((e) => {
                return Util.remove(ConfigUtil.GetSetting("modelRepoDir")).then(() => {
                    throw "Error reading namespace: " + e.toString();
                })
            });
    }

    private static addResourceProfilesFromNamespaceConfig(namespaceConfig: m.NamespaceConfig) {
        var cache = {}
        namespaceConfig.resourceProfiles.forEach(profile => {
            // TODO: validate resource profiles
            if (profile.name in cache) {
                throw "Duplicate resource profiles found with name " + profile.name;
            }
            cache[profile.name] = profile;
        });

        ModelReader.resourceProfileCache[namespaceConfig.name] = cache;
    }

    // TODO: Use a json schema to validate.
    private static validateNamespaces(currentResult: { [key: string]: m.NamespaceConfig }, config: m.NamespaceConfig) {

        if (!config.name) {
            throw "Empty namespace name provided."
        }

        if (config.name in currentResult) {
            throw ("Duplicate namespace name found " + config.name);
        }
    }

    private static readObjectDefinitions(namespaceName: string, throwInnerException = false): Promise<{ [key: string]: m.ParsedObjectDefinition }> {
        return ModelReader.getNameSpace(namespaceName).then((namespaceConfig) => {
            let result = {};
            let parentPath = path.join(ConfigUtil.GetSetting("modelRepoDir"), "src\\**", namespaceName, "Objects\\**");
            let innerExceptions = [];

            // Searches for root objects underneath src\**\Objects\**\*.json
            // Root files can be defined in any folder under src.
            // Extension files (denoted with a subextension like stuff.ext.json), can be defined under any folder.
            return glob(path.join(parentPath, "!(*.*).json"))
                .map((path) => {
                    return {
                        filePath: path, jsonPromise: this.readSplitJson(path).catch((e) => {
                            innerExceptions.push(e);
                        })
                    }
                })
                .each((file) => {
                    return file.jsonPromise.then((res) => {
                        if (Util.isConfig(file.filePath)) {
                            console.log("Config:" + file.filePath);
                        }

                        if (!res || Util.isTemplate(res.json) || Util.isConfig(file.filePath)) {
                            // Bypass validation for template file.
                            return;
                        }

                        return ModelReader.validateObjectDefinition(result, res.json).then(() => {
                            let parsed = ModelReader.parseObjectDefinition(res.json);
                            parsed.filePaths = [file.filePath].concat(res.associatedPath);
                            parsed.fileName = path.basename(file.filePath);
                            result[res.json.path] = parsed;
                        }).catch((exception) => {
                            innerExceptions.push(exception);
                        });
                    })
                })
                .then(() => {
                    if (innerExceptions.length > 0) {
                        if (throwInnerException) {
                            throw innerExceptions.join(";");
                        } else {
                            log.error(innerExceptions.join(";"));
                        }
                    }

                    if (!ModelReader.objectDefinitionCache[namespaceConfig.name]) {
                        ModelReader.objectDefinitionCache[namespaceConfig.name] = result;
                    }

                    let promises = [];
                    Object.keys(result).forEach((namespace) => {
                        promises.push(ModelReader.validateObjectAssociation(result[namespace]));
                    })

                    return Promise.all(promises).then(() => {
                        ModelReader.objectDefinitionCache[namespaceConfig.name] = result;
                        return result;
                    })
                });
        }).catch((e) => {
            ModelReader.objectDefinitionCache = {};
            throw "Error reading object definitions: " + e.toString();
        });
    }

    private static validateResource(resource: m.Resource) {
        // TODO;
    }

    private static validateAssociation(association: m.Association, objectDefinition: m.ObjectDefinition): Promise<m.ParsedObjectDefinition> {
        // TODO;
        if (!association.associatedObjectPath) {
            throw "Object path cannot be empty for association"
        }

        var namespaceName = association.associatedObjectNamespace ? association.associatedObjectNamespace : objectDefinition.namespace;

        if (association.type !== "kusto") {
            throw "Only kusto associations are supported at this time."
        }

        if (!association.relativePath) {
            throw "No relative path specific for association for object " + objectDefinition.path;
        }

        return ModelReader.getObjectDefinition(namespaceName, association.associatedObjectPath);
    }

    /**
     * Reads a JSON object split across multiple files in the Orb repository.
     * The base filePath argument must be located in the src/Models folder.
     */
    private static readSplitJson(jsonPath: string): Promise<{ json: any, associatedPath: String[] }> {
        return readJson(jsonPath).then((baseObject) => {
            return this.validateObjectProtectionBeforeMerge(baseObject, jsonPath).then((res) => {
                if (!res.result) {
                    throw res.errorMessage;
                }
            }).then(() => {
                return this.getAssociatedPaths(jsonPath).then((paths) => {
                    let associatedObjectPromises: Promise<any>[] = [];
                    paths.forEach((filePath) => {
                        associatedObjectPromises.push(readJson(filePath).then((associatedObject) => {
                            return this.validateObjectProtectionBeforeMerge(associatedObject, filePath).then((res) => {
                                if (!res.result) {
                                    throw res.errorMessage;
                                }

                                return associatedObject;
                            });
                        }));
                    });

                    return Promise.all(associatedObjectPromises).then((associatedObjects) => {
                        associatedObjects.forEach((associatedObject, i) => {
                            let associatedPath = paths[i];
                            try {
                                this.mergeJsonObjects(baseObject, associatedObject);
                            } catch (e) {
                                throw `Unable to load object due to ${e}, please modify ${associatedPath}.`;
                            }
                        });

                        return {
                            json: baseObject,
                            associatedPath: paths && paths.length > 0 ? paths : []
                        };
                    });
                });
            })
        });
    }

    /**
     * Gets associated file paths for an Orb model file located in src/Models in the repository
     * @param jsonPath
     */
    private static getAssociatedPaths(jsonPath: string): Promise<string[]> {
        let fileExt = path.extname(jsonPath);

        let unixModelRepoDir: string = ConfigUtil.GetSetting("modelRepoDir").replace(/\\/g, "/");

        // Search path after the source folder
        // Ex: Models/stuff.json
        let intermediateSearchPath = jsonPath.replace(unixModelRepoDir + "/src/", "");

        // Search path with original location with wildcarded validation directory
        // Ex: D:/AppData/Roaming/OrbModels/src/**/stuff.json
        intermediateSearchPath = unixModelRepoDir + "/src/**/" + intermediateSearchPath.split("/").slice(1).join("/");

        // Replacing the above search path's file extension to follow the split model convention
        // Ex: D:/AppData/Roaming/OrbModels/src/**/stuff.*.json
        let searchPath = intermediateSearchPath.replace(`${fileExt}`, `.*${fileExt}`);

        // Returning all matches for the search path
        return glob(searchPath);
    }

    /**
     * Returns the subextension for a specified filepath.
     *
     * For example, "test.json" will return null, as there isn't a subextension
     * "test.config.json" will return "config".
     * "test.foo.bar.json" will return "foo.bar"
     *
     * @param filePath
     */
    private static getSubextension(filePath: string): string {
        let fileExt = path.extname(filePath);
        let fileName = path.basename(filePath, fileExt);
        let fileNameSplit = fileName.split(".", 2);

        if (fileNameSplit.length < 3) {
            return null;
        } else {
            return fileNameSplit[1];
        }
    }

    /**
     * Returns the validation directory for the file path.
     * A validation directory is the section of the models repository
     * a file is pulled from. For example, files under "src/Models/*"
     * have a validation directory of "Models". Conversely, files under "src/ProtectedModels/*"
     * in the models repository has a validation directory of "ProtectedModels".
     * @param filePath
     */
    private static getValidationDirectory(filePath: string): string {
        let unixFilePath = filePath.replace(/\\/g, "/");
        let unixModelRepoDir = ConfigUtil.GetSetting("modelRepoDir").replace(/\\/g, "/");

        let relativePath = unixFilePath.replace(unixModelRepoDir, "");

        let relativePathSplit = relativePath.split("/");

        if (relativePathSplit.length < 3) {
            return null;
        } else {
            return relativePathSplit[2];
        }
    }

    public static isProtected(filePath) {
        const directory = ModelReader.getValidationDirectory(filePath);
        return directory && directory.toLocaleUpperCase() === "PROTECTEDMODELS";
    }

    /**
     * Validates object protection before merge.
     * @param object the object to be validated.
     * @param filePath the file path where the object read from.
     */
    public static validateObjectProtectionBeforeMerge(
        object: m.ObjectDefinition, filePath: string): Promise<{ result: boolean, errorMessage: string }> {
        if (ModelReader.isProtected(filePath)) {
            return Promise.resolve({
                result: true,
                errorMessage: ""
            });
        }

        return ModelReader.getOrbSetting("enableProtectedResourceValidation").then((enableProtectedResourceValidation) => {
            if (!enableProtectedResourceValidation) {
                return {
                    result: true,
                    errorMessage: ""
                }
            } else {
                let errorMessage = [];
                let resourceProfiles = ((object as any) as m.NamespaceConfig).resourceProfiles;
                if (resourceProfiles) {
                    let unprotectedResourceProfile = [];
                    for (let i = 0; i < resourceProfiles.length; i++) {
                        if (resourceProfiles[i].type === "powershell") {
                            errorMessage.push("The resource profile: {0} for namespace: {1} needs to be moved to a protected model".format(resourceProfiles[i].name, (object as any).name));
                            continue;
                        }

                        unprotectedResourceProfile.push(resourceProfiles[i]);
                    }

                    ((object as any) as m.NamespaceConfig).resourceProfiles = unprotectedResourceProfile;
                    return {
                        result: errorMessage.length == 0,
                        errorMessage: errorMessage.join(".")
                    };
                }

                // javaScript object has a default constructor which is a function.
                if (typeof object.constructor != "function") {
                    let dataProvider = null;
                    try {
                        dataProvider = DataProviderSelector.getDataProvider(object.constructor);

                        if (!dataProvider || !dataProvider.isUnprotected || !dataProvider.isUnprotected()) {
                            errorMessage.push("The constructor for object: {0} needs to be moved to a protected model".format(object.path));
                        }
                    } catch (e) {
                        errorMessage.push(e);
                    }
                }

                if (object.additionalProps) {
                    let unprotectedAdditionalProps = [];
                    for (let i = 0; i < object.additionalProps.length; i++) {
                        let resource = object.additionalProps[i];
                        if (resource.type == "constant") {
                            errorMessage.push("The additional prop: {0} for object: {1} needs to be moved to a protected model".format(resource.name.toString(), object.path));
                            continue;
                        }

                        let dataProvider = null;
                        try {
                            dataProvider = DataProviderSelector.getDataProvider(resource);
                            if (!dataProvider || !dataProvider.isUnprotected || !dataProvider.isUnprotected()) {
                                errorMessage.push("The additional prop: {0} for object: {1} needs to be moved to a protected model".format(resource.name.toString(), object.path));
                                continue;
                            }
                        } catch (e) {
                            errorMessage.push(e);
                        }

                        unprotectedAdditionalProps.push(resource);
                    }

                    object.additionalProps = unprotectedAdditionalProps;
                }

                if (object.resources) {
                    let unprotectedResources = [];
                    for (let i = 0; i < object.resources.length; i++) {
                        let resource = object.resources[i];
                        let resourceProvider = null;
                        try {
                            resourceProvider = ResourceProviderSelector.getResourceProvider(resource);
                            if (!resourceProvider || !resourceProvider.isUnprotected || !resourceProvider.isUnprotected()) {
                                errorMessage.push("The resource: {0} for object: {1} needs to be moved to a protected model".format(resource.relativePath, object.path));
                                continue;
                            }
                        } catch (e) {
                            errorMessage.push(e);
                        }

                        unprotectedResources.push(resource);
                    }

                    object.resources = unprotectedResources;
                }

                return {
                    result: errorMessage.length == 0,
                    errorMessage: errorMessage.join(".")
                };
            }
        });
    }

    public static validateResourceProtection(resource: m.Resource, filePath: string) {
        let resourceProvider = ResourceProviderSelector.getResourceProvider(resource);
        if ((!resourceProvider || !resourceProvider.isUnprotected || !resourceProvider.isUnprotected()) && !ModelReader.isProtected(filePath)) {
            throw "The resource: {0} needs to be moved to a protected model".format(resource.relativePath);
        }
    }

    /**
     * Destructively merges a JSON object into another
     * @param a Object to receive the merge
     * @param b Object to be merged
     */
    public static mergeJsonObjects(a: any, b: any) {
        for (let prop in b) {
            if (a[prop] && typeof a[prop] == typeof b[prop]) {

                // Ignoring conflicts on properties that conflict with
                // base JavaScript objects, such as constructor
                if (typeof a[prop] === "function") {
                    a[prop] = b[prop];
                } else if (Array.isArray(a[prop]) && Array.isArray(b[prop])) {
                    ModelReader.checkForDuplicates(a[prop], b[prop]);
                    // Concatenating arrays
                    a[prop] = a[prop].concat(b[prop]);
                } else if (typeof b[prop] === "object") {
                    // Recursively merging objects
                    this.mergeJsonObjects(a[prop], b[prop]);
                } else {
                    // Throwing on other conflicts
                    throw `Conflicting resource encountered on property: ${prop}`;
                }
            } else {
                // If the property doesn't exist in object a, simply replace it
                a[prop] = b[prop];
            }
        }
    }

    public static checkForDuplicates(arrayA, arrayB) {
        arrayA.forEach((a) => {
            arrayB.forEach((b) => {
                if (a.name && b.name && a.name.toString().trim() == b.name.toString().trim()) {
                    throw "Duplicated additional props found: " + a.name.toString();
                } else if (a.type && b.type && a.relativePath && b.relativePath && (a.relativePath.trim() + "." + a.type.trim()) == (b.relativePath.trim() + "." + b.type.trim())) {
                    throw "Duplicated resource or association found: " + a.relativePath.trim() + "." + a.type.trim();
                } else if (a == b) {
                    throw "Duplicated requiredProps found: " + a;
                }
            })
        })
    }
}