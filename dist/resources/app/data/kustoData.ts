//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />

export class KustoData {
    public readonly rawTableData: KustoTable;
    private columnToIndexMap = {};
    private json: any[];

    constructor(private innerResult: KustoResult) {
        if (innerResult.Tables && innerResult.Tables[0]) {
            // Pick the first table as the only relevant one for now.
            this.rawTableData = innerResult.Tables[0];
            if (this.rawTableData.Columns) {
                this.rawTableData.Columns.forEach((c, i) => this.columnToIndexMap[c.ColumnName] = i);
            }
        }
    }

    /** @description Get the Kusto Result as an array of Json objects.
     */
    public asJson(): any[] {
        if (!this.json) {
            this.json = this.convertToJson();
        }

        return this.json;
    }

    private convertToJson(): any[] {
        // var start = performance.now();
        var result = [];
        if (this.rawTableData.Rows && this.rawTableData.Columns) {
            this.rawTableData.Rows.forEach((columnValues, i) => {
                if ((columnValues as any).Exceptions) {
                    throw (columnValues as any).Exceptions[0];
                }

                var rowObject = {};
                result[i] = rowObject;
                columnValues.forEach((c, k) => rowObject[this.rawTableData.Columns[k].ColumnName] = c);
            });
        }

        // var end = performance.now();
        // console.log("convertToJson took " + (end - start) + " ms.");

        return result;
    }

    public rowCount(): number {
        if (this.rawTableData.Rows) {
            return this.rawTableData.Rows.length;
        }
        return 0;
    }
}

export interface KustoResult {
    Tables: KustoTable[]
}

export interface KustoTable {
    TableName: string,
    Columns: KustoColumn[],
    Rows: any[][]
}

export interface KustoColumn {
    ColumnName: string;
    DataType: string;
    ColumnType: string;
}
