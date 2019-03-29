//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../../typings/index.d.ts" />
import * as m from "Model"
import * as React from "react";
import * as ReactDOM from "react-dom";
import JSONTree from "react-json-tree";

import { MarkdownExtension } from "./markdownExtension";

class ObjectExplorerProps {
    depth: number;
}

const defaultDepth: number = 5;

/**
 * Displays JSON data in an interactive tree format
 */
export class ObjectExplorer extends MarkdownExtension<ObjectExplorerProps, any> {

    private jsonData: {};

    private theme: {} = {
        // Theme from http://chriskempson.github.io/base16/
        "base00": "#404040",
        "base01": "#383830",
        "base02": "#49483e",
        "base03": "#75715e",
        "base04": "#a59f85",
        "base05": "#f8f8f2",
        "base06": "#f5f4f1",
        "base07": "#f9f8f5",
        "base08": "#f92672",
        "base09": "#fd971f",
        "base0A": "#f4bf75",
        "base0B": "#a6e22e",
        "base0C": "#a1efe4",
        "base0D": "#66d9ef",
        "base0E": "#ae81ff",
        "base0F": "#cc6633"
    }

    constructor(props) {
        super(props);
    }

    /**
     * When the component is about to mount, save the JSON data defined in the first child
     */
    componentWillMount() {
        if (this.props.children && this.props.children[0] && typeof this.props.children[0] === "string") {

            let jsonString = this.props.children[0];

            try {
                this.jsonData = JSON.parse(this.prepareForSecondParsing(jsonString));
            } catch (e) {
                console.log("Attempted to convert to JSON:", this.prepareForSecondParsing(jsonString));
                console.log(e);
            }
        }
    }

    /**
     * Prepares an already-parsed string for a second parsing (due to escape character issues)
     * @param str 
     */
    private prepareForSecondParsing(str: string): string {

        // Removing newlines and tabs
        let noTabsandNewlines = str.replace(/\n/g, "").replace(/\t/g, "");

        // Escaping characters
        let stringified = JSON.stringify(noTabsandNewlines);

        // Removing quotes added by JSON stringification
        stringified = stringified.substr(1, stringified.length - 2);

        // Unescaping quotes
        stringified = stringified.replace(/\\"/g, '"');

        // Fixing double-escaped characters
        stringified = stringified.replace(/\\\\"/g, '\\"');

        return stringified;
    }

    /**
     * Creates an object explorer view from a partiular node and its children
     * @param node 
     * @param children 
     */
    static fromNode(node: any, children: any[]) {
        let depth = node.attribs["depth"] ? parseInt(node.attribs["depth"]) : defaultDepth;
        return <ObjectExplorer children={children} depth={depth}></ObjectExplorer>;
    }

    /**
     * Renders the Object Explorer view
     */
    render() {
        let shouldExpandNode = (keyName, data, level): boolean => {
            return level <= ((this.props.depth != null) ? this.props.depth : defaultDepth);
        }

        let inner = <h2 style={{ color: "red" }}>No data passed to Object Explorer. Please check your Markdown and try again.</h2>;

        if (this.jsonData) {
            inner = <JSONTree
                data={this.jsonData}
                theme={this.theme}
                invertTheme={false}
                shouldExpandNode={shouldExpandNode}
            />
        }

        return (
            <div>
                {inner}
            </div>);
    }
}

// Required for registering with the Markdown Extension parser
export const MarkdownExtensionImplementation = ObjectExplorer;