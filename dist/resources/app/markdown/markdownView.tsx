//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />

import * as React from "react";
import * as ReactDOM from "react-dom";
import { ipcRenderer, remote } from "electron";
import * as Promise from "bluebird";
import * as path from "path";
import * as _url from "url";

import { MarkdownExtensionParser } from "./../extensions/markdown/markdownExtensionRegistry";

const marked: any = require('marked');
const readFile: any = Promise.promisify(require("fs").readFile);
const appPath = remote.app.getAppPath();
const viewPath = path.join(appPath, "markdown/markdownView.html");

class MarkdownViewState {
    filePath?: string;
    contentAsHtml?: string;
    contentIncarnation?: string;
    containsExtensions?: boolean;
}

/*
 * Displays markdown
 */
class MarkdownView extends React.Component<any, MarkdownViewState> {

    constructor() {

        super();

        // Disable syntax highlighting for now.
        // This is for performance reasons for now.
        // Also the syntax highlighting seemed to randomly kick in for <pre> blocks not marked as code.
        // marked.setOptions({
        //     highlight: function (code) {
        //         return require('highlight.js').highlightAuto(code).value;
        //     }
        // });

        this.state = {
            contentAsHtml: "",
            contentIncarnation: Date.now().toString(),
            filePath: this.getMdFilePathFromWindowUrl()
        }

        ipcRenderer.on("context-received", (event, arg) => {
            this.handleReceivedEvent(arg);
        });
    }

    // Allows setting arbitrary content without having markdown files.
    // Used in extensions such as psmd.
    handleReceivedEvent(content: string) {
        let renderer = new marked.Renderer();
        let originalRenderer = new marked.Renderer();

        // Used to detect whether or not an extension may be in the HTML
        let couldContainExtension: boolean = false;

        renderer.html = (html: string) => {
            // Updating whether or not an extension has been detected
            couldContainExtension = couldContainExtension || MarkdownExtensionParser.couldContainExtensionNode(html);
            return originalRenderer.html(html);
        };

        renderer.link = (href, title, text) => {
            // Preventing non-explicitly defined links from being rendered
            if (href === text && title == null) {
                return href;
            } else {
                return originalRenderer.link(href, title, text);
            }
        }

        marked(content, { renderer: renderer }, (error, content) => {
            if (error) { this.handleError(error) }
            else {
                this.setContent(content, Date.now().toString(), couldContainExtension);
            }
        });
    }

    getMdFilePathFromWindowUrl(): string {
        if (window.location.search) {
            // eg. ?md=myPath.md
            let query = window.location.search.toLowerCase();
            //myPath.md
            query = query.slice(4);

            //console.log(query);
            return query;
        } else {
            return "";
        }
    }

    componentWillMount() {
        this.readFileAndUpdateContent(this.state.filePath);
    }

    readFileAndUpdateContent(filePath: string) {
        if (!filePath) { return };

        filePath = path.join(appPath, filePath);
        // console.log("reading file " + filePath);
        // read the file
        readFile(filePath, "utf8")
            .then((content) => {
                let renderer = new marked.Renderer();
                let originalRenderer = new marked.Renderer();

                // Used to detect whether or not an extension may be in the HTML
                let couldContainExtension: boolean = false;

                renderer.html = (html: string) => {
                    // Updating whether or not an extension has been detected
                    couldContainExtension = couldContainExtension || MarkdownExtensionParser.couldContainExtensionNode(html);
                    return originalRenderer.html(html);
                };

                renderer.link = (href, title, text) => {

                    // intercept any relative markdown links in the parser and convert them to a link based on markdownView.html.
                    // this gives the illusion that linking to .md files directly opens them.
                    let parsed = _url.parse(href);
                    if (!parsed.protocol && parsed.pathname && parsed.pathname.toLowerCase().endsWith(".md")) {

                        // markdownView.html requires a path relative to the app folder.
                        // The next few lines convert a path relative to the current md file to a relative path with the base folder as the appPath.
                        let dirName = path.dirname(filePath);
                        let appRelativePath = path.relative(appPath, dirName);
                        appRelativePath = path.join(appRelativePath, parsed.pathname);

                        href = viewPath + "?md=" + appRelativePath;
                        //console.log(href);
                    }

                    // Preventing non-explicitly defined links from being rendered
                    if (href === text && title == null) {
                        return href;
                    } else {
                        return originalRenderer.link(href, title, text);
                    }
                }

                marked(content, { renderer: renderer }, (error, content) => {
                    if (error) { this.handleError(error) }
                    else {
                        this.setContent(content, filePath, couldContainExtension);
                    }
                });
            }).
            catch((error) => {
                this.handleError(error);
            })
    }

    setContent(html: string, incarnation: string, containsExtensions?: boolean) {
        this.setState({ contentAsHtml: html, contentIncarnation: incarnation, containsExtensions: containsExtensions });
    }

    handleError(error: any) {
        let content = "Something went wrong. " + error.toString();;
        let incarnation = Date.now().toString();
        this.setState({ contentAsHtml: content, contentIncarnation: incarnation });
    }

    shouldComponentUpdate(nextProps, nextState) {
        if (nextState.contentIncarnation !== this.state.contentIncarnation) {
            // use the content incarnation to see if rendering is required.
            // this is a much faster comparison than comparing the full body.
            return true;
        }
        return false;
    }

    getHtmlContent(): JSX.Element {
        let htmlContentString: string = this.state.contentAsHtml;

        // If the HTML may contain extensions, parse the HTML to React.
        if (this.state.containsExtensions) {
            console.log("Converting Markdown HTML and adding extensions.");

            // Importing HTML to React parsing
            const HtmlToReact = require("html-to-react")
            const HtmlToReactParser = HtmlToReact.Parser;
            var parser = new HtmlToReactParser();

            // Instructions for the HTML to React parser to substitute in Extension tags
            let processingInstructions = [
                {
                    replaceChildren: true,
                    shouldProcessNode: (node) => {
                        return MarkdownExtensionParser.isValidExtensionNode(node);
                    },
                    processNode: (node, children, index) => {
                        return MarkdownExtensionParser.getElementFromNode(node, children);
                    }
                },
                {
                    shouldProcessNode: (node) => {
                        return true;
                    },
                    processNode: new HtmlToReact.ProcessNodeDefinitions(React).processDefaultNode
                }
            ];

            // Assuming all nodes passed to the parser are valid
            let isValidNode = (node) => { return true };

            // Parsing the HTML content string as React Elements and substituting registered Extensions
            let extensionSubstitution: JSX.Element = parser.parseWithInstructions(htmlContentString, isValidNode, processingInstructions);

            return extensionSubstitution ? <div>{extensionSubstitution}</div> : null;

        } else {
            // If no extensions are detected, just output the HTML string
            return <div dangerouslySetInnerHTML={{ __html: htmlContentString }} />;
        }
    }

    render() {
        return (this.getHtmlContent());
    }
}

const App = () => (
    <MarkdownView></MarkdownView>
);


ReactDOM.render(
    <App />,
    document.getElementById('react-app')
);