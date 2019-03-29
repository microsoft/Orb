//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />

import * as rp from 'request-promise';
import * as util from 'util';
import { KustoResult, KustoData } from './kustoData';
import * as m from "Model";

export class AppInsights {
    static executeQuery(query: string): Promise<KustoData> {
        let url = "https://api.applicationinsights.io/beta/apps/a2d680f9-e35d-474f-8130-9acc5e424481/query?api_key=l5ld0lyb854w3pzi3fuye1puj23urkks7om4tb28";
        // TODO: switch to AAD based auth.
        let kustoQueryData = {
            query: query,
        };

        console.log(query);
        let headers = {
            "Content-Type": "application/json;charset=UTF-8",
            "Connection": "Keep-Alive"
        };

        let start = performance.now();
        return rp.post(url, <rp.RequestPromiseOptions>{ body: kustoQueryData, headers: headers, json: true, gzip: true })
            .then((o) => {
                let end = performance.now();
                console.log("AppInsights query took " + (end - start) + " ms.");
                return new KustoData(<KustoResult>o);
            });
    }
}

