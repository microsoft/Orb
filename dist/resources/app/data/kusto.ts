//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />

import * as rp from 'request-promise';
import * as util from 'util';
import * as Promise from 'bluebird';
import { KustoResult, KustoData } from './kustoData';
import * as m from "Model";
import { ModelReader } from "../modelReader/modelReader";
import { IAuthenticator, KustoAuthenticator } from "./auth";
import * as uuidV4 from "uuid/v4";

export interface KustoError {
    message: string,
    statusCode: number
}

declare var AuthenticationContext: any;
// Uncomment these lines to enable ADAL logging.
/*
declare var Logging: any;

Logging = {
    level: 3,
    log: function (message) {
        console.log(message);
    }
};
*/

export class Kusto {
    static executeQuery(endpoint: string, db: string, query: string, cloudType: string = "Public", needWriteAccess: boolean = false): Promise<KustoData> {
        let authenticator: IAuthenticator = KustoAuthenticator.instance();
        return authenticator.getToken(endpoint).then((token) => {
            if (!token) {
                throw <KustoError>{
                    message: "Error obtaining authentication token. Please retry.",
                    statusCode: 401
                }
            }

            var url = util.format("%s/v1/rest/query", endpoint);

            if (needWriteAccess) {
                url = util.format("%s/v1/rest/mgmt", endpoint);
            }

            var kustoQueryData = {
                db: db,
                csl: query
            };

            let requestId = uuidV4();
            console.log("requestId:", requestId);
            var headers = {
                "Authorization": "bearer " + token,
                "Content-Type": "application/json;charset=UTF-8",
                "Connection": "Keep-Alive",
                "Accept-Encoding": "gzip",
                "x-ms-client-request-id": requestId,
                "x-ms-app": "Orb"
            }

            console.log(query);
            var start = performance.now();
            return rp.post(url, <rp.RequestPromiseOptions>{ body: kustoQueryData, headers: headers, json: true, gzip: true })
                .then((o) => {
                    var end = performance.now();
                    console.log("Kusto query took " + (end - start) + " ms.");
                    return new KustoData(<KustoResult>o);
                })
                .catch((e) => {
                    if (e.statusCode) {
                        throw <KustoError>{
                            message: "Kusto Error:" + e.message,
                            statusCode: e.statusCode
                        }
                    }
                    else {
                        throw <KustoError>{
                            message: "Kusto Error:" + JSON.stringify(e),
                            statusCode: 500
                        }
                    }
                })
        });
    }

    static executeQueryFromProfile(namespaceName: string, profileName: string, query: string, cloudType: string = "Public"): Promise<KustoData> {

        return ModelReader.getResourceProfile(namespaceName, profileName)
            .then((profile: m.KustoConnectionProfile) => {
                if (!profile.clustersByCloudType[cloudType]) {
                    throw "kusto endpoint is not configured for cloudType:" + cloudType;
                }

                if (profile.dbsByCloudType && !profile.dbsByCloudType[cloudType]) {
                    throw "kusto db is not configured for cloudType:" + cloudType;
                }

                let db = profile.dbsByCloudType && profile.dbsByCloudType[cloudType] ? profile.dbsByCloudType[cloudType] : profile.db;

                return Kusto.executeQuery(profile.clustersByCloudType[cloudType], db, query, cloudType)
                    .catch((e) => {
                        let msg = e;
                        if (e.message) {
                            msg = e.message;
                            if (profile.errorHelpMap && e.statusCode) {
                                if (profile.errorHelpMap[e.statusCode.toString()]) {
                                    msg = profile.errorHelpMap[e.statusCode.toString()] + "\n" + msg;
                                }
                            }
                        }

                        throw msg;
                    });
            });
    }
}



