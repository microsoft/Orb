//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />
import { shell, remote } from "electron";
import * as Promise from "bluebird";
import * as path from "path";
import * as fs from "fs";
import * as fse from "fs-extra";

const pako = require('pako');

export class Util {
    private static runningInDev: boolean;
    private static appPath: string;
    private static runningInSaw: boolean;
    private static runningInAME: boolean;
    private static userDomain: string;
    private static authCacheLocation: string;

    static getAuthCacheLocation() {
        if (!Util.authCacheLocation) {
            Util.authCacheLocation = path.join(remote.app.getPath("userData"), "TokenCache.dat");
        }

        return Util.authCacheLocation;
    }

    static clearAuthCacheSync() {
        Util.unlinkSync(Util.getAuthCacheLocation());
    }

    static openInNewInWindow(url: string, openInExternal?: boolean, shellOpen?: boolean) {
        if (openInExternal) {
            shell.openExternal(url);
        } else if (shellOpen) {
            shell.openItem(url);
        }
        else {
            // TODO: if this is a file:// path we may need to enable node integration.
            let newWindow = new remote.BrowserWindow({ webPreferences: { nodeIntegration: false } });
            newWindow.loadURL(url);
        }
    }

    static isRunningInTest(): boolean {
        if (process.env.NODE_ENV === "test") {
            return true;
        }

        return false;
    }

    static isRunningInDev(): boolean {
        if (Util.runningInDev === undefined) {
            Util.runningInDev = fs.existsSync(path.join(Util.getAppPath(), "../../../package.json"));
        }

        return Util.runningInDev;
    }

    static isInsiders(): boolean {
        return path.basename(process.execPath).toLowerCase() === "orb_insiders.exe";
    }

    static toBase64(input: string): string {
        return Buffer.from(input).toString('base64');
    }

    static getAppPath(): string {
        if (!Util.appPath) {
            Util.appPath = remote.app.getAppPath();
        }

        return Util.appPath;
    }

    static fileToUrl(str: string) {

        var pathName = path.resolve(str).replace(/\\/g, '/');

        // Windows drive letter must be prefixed with a slash
        if (pathName[0] !== '/') {
            pathName = '/' + pathName;
        }

        return encodeURI('file://' + pathName);
    };

    static getUrlPathRelativeToApp(str: string) {
        let p = path.join(Util.getAppPath(), str);
        return Util.fileToUrl(p);
    }

    static tryParseDateTime(input: string) {
        let inputUpper = input.toUpperCase().trim();
        if (!inputUpper.endsWith("Z") && !inputUpper.endsWith("GMT") && !inputUpper.endsWith("UTC")) {

            if (inputUpper.endsWith("AM") || inputUpper.endsWith("PM")) {
                input += " UTC";
            } else {
                // convert all dateTime stamps to UTC
                input += "Z";
            }
        }

        let parsed = new Date(input);
        if (isNaN(parsed.getTime())) {
            return null;
        }

        return parsed;
    }

    static existsSync(filePath: string) {
        return fs.existsSync(filePath);
    }

    static readdirSync(directory: string) {
        return fs.readdirSync(directory);
    }

    static openSync(filePath: string) {
        return fs.openSync(filePath, 'w');
    }

    static closeSync(fd) {
        return fs.closeSync(fd);
    }

    static unlinkSync(filePath: string) {
        return fs.unlinkSync(filePath);
    }

    static mkDirSync(dir: string) {
        if (!Util.existsSync(dir)) {
            try {
                fs.mkdirSync(dir)
            } catch (err) {
                if (err.code !== 'EEXIST') throw err
            }
        }
    }

    static readDir(directory: string): Promise<Array<string>> {
        return new Promise<Array<string>>((resolve, reject) => {
            fs.readdir(directory, (err, files) => {
                if (err) {
                    reject(err);
                } else {
                    files.sort((a, b) => {
                        let aIsDir = fs.statSync(path.join(directory, a)).isDirectory(),
                            bIsDir = fs.statSync(path.join(directory, b)).isDirectory();

                        if (aIsDir && !bIsDir) {
                            return -1;
                        }

                        if (!aIsDir && bIsDir) {
                            return 1;
                        }

                        return a.localeCompare(b);
                    })

                    resolve(files);
                }
            })
        })
    }

    static open(filePath: string) {
        return new Promise<any>((resolve, reject) => {
            fs.open(filePath, "w", (err, fd) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(fd);
                }
            })
        })
    }

    static remove(directory: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            fse.remove(directory, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            })
        })
    }

    static copy(src, des): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            fse.copy(src, des, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            })
        })
    }

    static writeFile(filePath, data): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            fs.writeFile(filePath, data, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            })
        })
    }

    /* Borrowed from Kusto samples
    *  https://mseng.visualstudio.com/AppInsights/AppAnalytics%20UX%20Team/_git/MASI-LogAnalyticsUX?path=%2FLogAnalyticsPortalWebRole%2FScripts%2Fdev%2Futils%2Fcompression.js&version=GBmaster&_a=contents
    */
    static compressAndEncodeBas64Uri(str: string) {

        var compressedBase64 = this.compressAndEncodeBase64(str);

        // Encode the data with URL-encoding
        return encodeURIComponent(compressedBase64);
    }

    /**
     * Compress a text and encode with base64 encoding.
     * @param {} str - uncompressed text
     * @returns {} Compressed + base64-encoded text
     */
    static compressAndEncodeBase64(str) {
        var compressed = this.compressString(str);
        // Convert from Base64
        return btoa(compressed);
    }

    /**
     * Compress a text.
     * @param {} str - uncompressed text
     * @returns {} Compressed text
     */
    static compressString(str) {
        // Compressing string to byte array
        var compressedByteArray = Util.compressStringToBytes(str);

        // Convert from compressed byte array to compressed string
        var compressed = String.fromCharCode.apply(null, compressedByteArray);

        return compressed;
    }

    static compressStringToBytes(str) {
        // Convert to a byte array
        var byteArray = this.toUTF8Array(str);

        // Compress the byte array
        var compressedByteArray = pako.gzip(byteArray);

        return compressedByteArray;
    }

    /**
     * Decompress a text that is (1) URL Encoded, (2) Base-64 encoded, and (3) ZIP compressed.
     * @param {} compressedBase64UriComponent
     * @returns {} Decompressed text
     */
    static decompressBase64UriComponent(compressedBase64UriComponent) {
        // Decode the data from the URL
        var compressedBase64 = decodeURIComponent(compressedBase64UriComponent);

        return this.decompressBase64(compressedBase64);
    }

    /**
     * Decompress a text that is (1) Base-64 encoded, and (2) ZIP compressed.
     * @param {} compressedBase64
     * @returns {} Decompressed text
     */
    static decompressBase64(compressedBase64) {
        // Convert from Base64
        var compressed = atob(compressedBase64);

        return this.decompressString(compressed);
    }

    /**
     * Decompress a text that is ZIP compressed.
     * @param {} compressed
     * @returns {} Decompressed text
     */
    static decompressString(compressed) {
        // Convert to a byte array
        var compressedByteArray = compressed.split('').map(function (e) {
            return e.charCodeAt(0);
        });

        // Decompress the byte array
        var decompressedByteArray = pako.inflate(compressedByteArray);

        // Convert from decompressed byte array to string
        var decompressed = this.fromUTF8Array(decompressedByteArray);

        return decompressed;
    }

    // Based on Unicode specification: https://en.wikipedia.org/wiki/UTF-8#Description
    static fromUTF8Array(utf8) {
        var stringBuilder = "";
        for (var i = 0; i < utf8.length; i++) {
            var charCode, firstByte, secondByte, thirdByte, fourthByte;
            // Byte starts with 0 (e.g. 0xxxxxxx) --> character is 1-byte long
            if ((utf8[i] & 0x80) === 0) {
                charCode = utf8[i];
            }
            // Byte starts with 110 --> character is 2-byte long. 2nd byte starts with 10
            else if ((utf8[i] & 0xE0) === 0xC0) {
                firstByte = utf8[i] & 0x1F;
                secondByte = utf8[++i] & 0x3F;
                charCode = (firstByte << 6) + secondByte;
            }
            // Byte starts with 1110 --> character is 3-byte long. 2nd/3rd bytes start with 10
            else if ((utf8[i] & 0xF0) === 0xE0) {
                firstByte = utf8[i] & 0x0F;
                secondByte = utf8[++i] & 0x3F;
                thirdByte = utf8[++i] & 0x3F;
                charCode = (firstByte << 12) + (secondByte << 6) + thirdByte;
            }
            // Byte starts with 11110 --> character is 4-byte long. 2nd/3rd/4th bytes start with 10
            else if ((utf8[i] & 0xF8) === 0xF0) {
                firstByte = utf8[i] & 0x07;
                secondByte = utf8[++i] & 0x3F;
                thirdByte = utf8[++i] & 0x3F;
                fourthByte = utf8[++i] & 0x3F;
                charCode = (firstByte << 18) + (secondByte << 12) + (thirdByte << 6) + fourthByte;
            }

            stringBuilder += String.fromCharCode(charCode);
        }

        return stringBuilder;
    }

    // Based on Unicode specification: https://en.wikipedia.org/wiki/UTF-8#Description
    static toUTF8Array(str) {
        var utf8 = [];
        for (var i = 0; i < str.length; i++) {
            var charcode = str.charCodeAt(i);
            if (charcode < 0x80) utf8.push(charcode);
            else if (charcode < 0x800) {
                utf8.push(0xc0 | (charcode >> 6),
                    0x80 | (charcode & 0x3f));
            }
            else if (charcode < 0xd800 || charcode >= 0xe000) {
                utf8.push(0xe0 | (charcode >> 12),
                    0x80 | ((charcode >> 6) & 0x3f),
                    0x80 | (charcode & 0x3f));
            }
            // surrogate pair
            else {
                i++;
                // UTF-16 encodes 0x10000-0x10FFFF by
                // subtracting 0x10000 and splitting the
                // 20 bits of 0x0-0xFFFFF into two halves
                charcode = 0x10000 + (((charcode & 0x3ff) << 10)
                    | (str.charCodeAt(i) & 0x3ff));
                utf8.push(0xf0 | (charcode >> 18),
                    0x80 | ((charcode >> 12) & 0x3f),
                    0x80 | ((charcode >> 6) & 0x3f),
                    0x80 | (charcode & 0x3f));
            }
        }
        return utf8;
    }

    static getUserDomain(): String {
        if (Util.userDomain === undefined) {
            Util.userDomain = process.env.USERDOMAIN;
        }

        return Util.userDomain;
    }

    // Return 1 if a > b
    // Return -1 if a < b
    // Return 0 if a == b
    // Borrowed from http://stackoverflow.com/questions/6832596/how-to-compare-software-version-number-using-js-only-number
    static compareVersions(a, b) {
        if (a === b) {
            return 0;
        }

        var a_components = a.split(".");
        var b_components = b.split(".");

        var len = Math.min(a_components.length, b_components.length);

        // loop while the components are equal
        for (var i = 0; i < len; i++) {
            // A bigger than B
            if (parseInt(a_components[i]) > parseInt(b_components[i])) {
                return 1;
            }

            // B bigger than A
            if (parseInt(a_components[i]) < parseInt(b_components[i])) {
                return -1;
            }
        }

        // If one's a prefix of the other, the longer one is greater.
        if (a_components.length > b_components.length) {
            return 1;
        }

        if (a_components.length < b_components.length) {
            return -1;
        }

        // Otherwise they are the same.
        return 0;
    }

    static isTemplate(json) {
        const blankObj = require("../edit/blankTemplate.json");
        return json.namespace === blankObj.namespace;
    }

    static isConfig(filePath: string) {
        return filePath.indexOf(".config.json") !== -1;
    }

    static getParameters(str): StringMap<boolean> {
        var results: StringMap<boolean> = {};
        var re = /{([a-zA-Z0-9]+)}/g;
        var text;

        while (text = re.exec(str)) {
            results[text[1]] = true;
        }

        return results;
    }

    /* Injects a font family into the header of the current HTML document. Setting
    the important argument to true adds the CSS important tag for the attribute. */
    static injectFontFamily(targets: string[], fontFamily: string, important?: boolean): void {
        this.injectAttribute(targets, "font-family", fontFamily, important);
    }

    /* Injects a font size into the header of the current HTML document. Setting
    the important argument to true adds the CSS important tag for the attribute. */
    static injectFontSize(targets: string[], fontSize: string, important?: boolean): void {
        this.injectAttribute(targets, "font-size", fontSize, important);
    }

    /** Injects a specified attribute to specified targets in a style element in the header of an HTML file. */
    private static injectAttribute(targets: string[], attributeName: string, value: string, important?: boolean): void {
        let styleElement: HTMLStyleElement = document.getElementById("style-injector") as HTMLStyleElement;

        if (!styleElement) {
            styleElement = document.createElement("style");
            styleElement.type = "text/css";
            styleElement.id = "style-injector";
            document.getElementsByTagName("head")[0].appendChild(styleElement);
        }

        styleElement.innerHTML += `${targets.join(",")} {${attributeName}: ${value} ${important ? "!important" : ""}}`;
    }
}