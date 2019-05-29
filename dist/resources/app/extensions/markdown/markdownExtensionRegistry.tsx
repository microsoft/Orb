//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../../typings/index.d.ts" />

import * as React from "react";

/**
 * Place Markdown Extension modules here. The key should be the extension name in lowercase.
 */
const markdownExtensionModules = {
    objectexplorer: require("./objectExplorer")
}

/**
 * Provides the Markdown Parser with methods to check for extensions and properly subsitute
 * them into the React version of the markdown document
 */
export class MarkdownExtensionParser {

    /**
     * Checks to see if an HTML node is a valid and registered Markdown Extension
     * @param node 
     */
    static isValidExtensionNode(node: any): boolean {
        return markdownExtensionModules[node.name] != null;
    }

    /**
     * Best effort method for detecting whether or not a string containing
     * an HTML definition contains an extension node.
     * @param htmlString 
     */
    static couldContainExtensionNode(htmlString: string): boolean {

        // Check all module names
        for (let moduleName in markdownExtensionModules) {
            // Looking for opening tags for the module name
            let openingTag = `<${moduleName}`;

            // If opening tag detected, return the result
            if (htmlString.toLowerCase().indexOf(openingTag) >= 0) {
                return true;
            }
        }

        // If no tags detected, return that result
        return false;
    }

    /**
     * Creates an instance of a React Extension from an HTML node and its children
     * @param node 
     * @param children 
     */
    static getElementFromNode(node: any, children: any[]): JSX.Element {
        return this.isValidExtensionNode(node) ?
            markdownExtensionModules[node.name].MarkdownExtensionImplementation.fromNode(node, children) : <div>Invalid extension node.</div>;
    }
}