//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../../typings/index.d.ts" />

import * as React from "react";

/**
 * Abstract class that Markdown Extensions should extend in order to
 * properly register with the Markdown Parser
 */
export abstract class MarkdownExtension<P, S> extends React.Component<P, S> {

    /**
     * Creates an instance of the MarkdownExtension from an HTML node
     * Static function that must be implemented in MarkdownExtension implementations.
     * @param node HTML node whose attributes can be accessed via attribs["class"].
     * @param children The children of the node
     */
    static fromNode(node: any, children: any[]): JSX.Element {
        throw "fromNode() must be implemented for Markdown Extensions";
    }
}