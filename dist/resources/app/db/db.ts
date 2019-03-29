//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />

let PouchDB = require("pouchdb-browser");
import * as uuidV4 from "uuid/v4";
PouchDB.plugin(require('pouchdb-find'));
import * as m from "Model";
import { ModelReader } from "../modelReader/modelReader";
import * as Promise from "bluebird";

interface IBaseModel {
    _id?: string;
    _rev?: string;
}

export interface ISuggestion extends IBaseModel {
    url: string;
    objectContext?: m.ObjectContext;
    objectPath?: string;
    relativePathWithExtension?: string;
    namespace?: string;
}

export interface IResource extends IBaseModel {
    relativePathWithExtension: string;
}

interface IDBResponse {
    ok: boolean;
    id: string;
    rev: string;
}

abstract class DB<T> {

    protected db;

    public constructor(dbName: string) {
        this.db = new PouchDB(dbName, {
            adapter: "websql",
        });
    }

    public destroy(): Promise<IDBResponse> {
        return this.db.destroy().then((res) => {
            this.db = null;
            return res;
        });
    }

    public put(object: T): Promise<IDBResponse> {
        const newObject = Object.assign({}, object, { _id: uuidV4() });
        return this.db.put(newObject);
    }

    public get(id: string): Promise<T> {
        return this.db.get(id);
    }

    public delete(doc): Promise<IDBResponse> {
        return this.db.remove(doc);
    }

    public find(query) {
        return this.db.find(query);
    }
}

class ResourceDB extends DB<IResource> {

    constructor(name: string) {
        super(name);
    }

    public findResource(text: string): Promise<IResource[]> {
        text = text.replace(new RegExp("\\\\", "g"), "\\\\");
        text = text.split("*").join(".*");
        text = "^" + text;
        let regex = new RegExp(text, 'i');

        let query = {
            selector: {
                relativePathWithExtension: { $regex: regex }
            },
        };

        return this.find(query).then((res) => {
            return res.docs;
        });
    }

    public putResourceIfNotExists(resource: IResource) {
        let query = {
            selector: {
                relativePathWithExtension: resource.relativePathWithExtension,
            },
            limit: 1
        }

        this.find(query).then((res) => {
            return res.docs;
        }).then((res: IResource[]) => {
            if (res.length === 0) {
                this.put(resource);
            }
        })
    }
}

class SuggestionDB extends DB<ISuggestion> {
    public getSuggestionByURL(url: string): Promise<ISuggestion> {
        let query = {
            selector: {
                url: url,
            },
            limit: 1
        }

        return this.find(query).then((res) => {
            if (res.docs.length > 0) {
                return res.docs[0] as ISuggestion;
            } else {
                return null;
            }
        })
    }

    public putSuggestionIfNotExists(suggestion: ISuggestion): void {
        let query = {
            selector: {
                url: suggestion.url,
            },
            limit: 1
        }

        this.find(query).then((res) => {
            return res.docs;
        }).then((res: ISuggestion[]) => {
            if (res.length === 0) {
                this.put(suggestion);
            }
        })
    }

    public removeSuggestionsByPath(path: string): Promise<any> {
        let query = {
            selector: {
                path: path
            }
        }

        return this.find(query).then((res) => {
            if (res.docs && res.docs.length > 0) {
                let promises = [];
                res.docs.forEach((suggestion) => {
                    promises.push(this.delete(suggestion));
                })

                return Promise.all(promises);
            }
        })
    }

    public findAddressbarAutoSuggestions(text: string, limit = 7): Promise<ISuggestion[]> {
        text = text.replace(new RegExp("\\\\", "g"), "\\\\");
        text = text.split("*").join(".*");
        let regex = new RegExp(text, 'i');

        let query = {
            selector: {
                url: { $regex: regex }
            },
            limit: limit
        };

        return this.find(query).then((res) => {
            return res.docs;
        });
    }
}

export class LinkSuggestionDB extends SuggestionDB {

    private static _instance: LinkSuggestionDB;

    constructor() {
        super("LinkSuggestionDB");
    }

    public static instance(): LinkSuggestionDB {
        if (this._instance == null || this._instance.db == null) {
            this._instance = new LinkSuggestionDB();
        }

        return this._instance;
    }
}

export class ResourceSuggestionDB extends SuggestionDB {

    private static _instance: ResourceSuggestionDB;

    constructor() {
        super("ResourceSuggestionDB" + uuidV4());
    }

    public static instance(): ResourceSuggestionDB {
        if (this._instance == null || this._instance.db == null) {
            this._instance = new ResourceSuggestionDB();
        }

        return this._instance;
    }

    public findAddressbarAutoSuggestions(text: string, limit = 7): Promise<ISuggestion[]> {
        return Promise.resolve([]);
    }
}

export class ResourceCollections {
    private static _instance: ResourceCollections;
    private resourceDBByFullPath: { [key: string]: ResourceDB };

    constructor() {
        this.resourceDBByFullPath = {};
    }

    public static instance(): ResourceCollections {
        if (this._instance == null) {
            this._instance = new ResourceCollections();
        }

        return this._instance;
    }

    public addResourcesIfNotPresents(namespace: string, objectPath: string) {
        const fullPath = namespace + "\\" + objectPath;

        if (!this.resourceDBByFullPath[fullPath]) {
            this.resourceDBByFullPath[fullPath] = new ResourceDB(fullPath);
            ModelReader.getObjectDefinitions(namespace).then((objectDefinitionMap) => {
                const db = this.resourceDBByFullPath[fullPath];
                Object.keys(objectDefinitionMap[objectPath].resourceByRelativePathWithExtension).forEach(relativePathWithExtension => {
                    db.putResourceIfNotExists({
                        relativePathWithExtension: relativePathWithExtension
                    });
                });
            })
        }
    }

    public destroy(): Promise<any> {
        const promises = [];
        Object.keys(this.resourceDBByFullPath).forEach((fullPath) => {
            promises.push(this.resourceDBByFullPath[fullPath].destroy().then(() => {
                delete this.resourceDBByFullPath[fullPath];
            }));
        })

        return Promise.all(promises);
    }

    public findResource(namespace: string, path: string, text: string): Promise<IResource[]> {
        const db = this.resourceDBByFullPath[namespace + "\\" + path];
        if (!db) {
            return Promise.resolve([]);
        } else {
            return db.findResource(text);
        }
    }
}