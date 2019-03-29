//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />

import * as React from "react";
import * as ReactDOM from "react-dom";
import { ipcRenderer } from "electron";
import { TerminalConfigManager } from "../config/terminalConfig";

var pty = require("node-pty");

const Terminal = require("xterm");
Terminal.loadAddon("fit");
//Terminal.loadAddon("search");

class TerminalProps {

};

class TerminalContainer extends React.Component<TerminalProps, any> {
    private xterm: any;
    private terminalContainer;
    private ptyProcess;
    private searchInProgress: boolean;

    private getParams(query) {
        if (!query) {
            return {};
        }

        return (/^[?#]/.test(query) ? query.slice(1) : query)
            .split("&")
            .reduce((params, param) => {
                let [key, value] = param.split("=");
                params[key] = value ? decodeURIComponent(value.replace(/\+/g, " ")) : "";
                return params;
            }, {});
    }

    constructor() {
        super();

        // TODO: Search will be fixed once the search addon ships.
        ipcRenderer.on("tab-manager-search-stopped", () => {
            this.searchInProgress = false;
            this.xterm.clearSelection();
            this.xterm.focus();
        });

        ipcRenderer.on("tab-manager-search-findNext", (text) => {
            this.searchInProgress = true;
            console.log("FindNext", text);
            //this.xterm.findNext(text);
        });

        ipcRenderer.on("tab-manager-search-findPrevious", (text) => {
            this.searchInProgress = true;
            console.log("FindPrev", text);
            //this.xterm.findPrevious(text);
        });

        ipcRenderer.on("tab-manager-search-started", () => {
            this.searchInProgress = true;
        });

        this.refit = this.refit.bind(this);
        this.applyCustomizeStyle();
    }

    applyCustomizeStyle() {
        let params = this.getParams(window.location.search);
        if (params["relativePath"]) {
            let styles = TerminalConfigManager.getStyle(params["relativePath"]);
            if (document.styleSheets && document.styleSheets.length >= 2 && styles.length > 0) {
                let styleSheet = document.styleSheets[1] as any;
                if (styleSheet.cssRules) {
                    styles.forEach((style) => {
                        styleSheet.insertRule(style, styleSheet.cssRules.length - 1);
                    })
                }
            }
        }
    }

    getLaunchParametersFromTerminalManager(): string[] {

        let params = this.getParams(window.location.search);

        if (params["relativePath"]) {
            let launchParameters = TerminalConfigManager.getLaunchParameters(params["relativePath"]);
            launchParameters = launchParameters.trim();
            return launchParameters.split(" ");
        } else {
            return [];
        }
    }

    /* By default, xterm only adds as many rows as visible on-screen to the HTML dom. This technique is called virtual scrolling.
    To allow searching for all elements outside of the currently displayed set of rows, expand the DOM to include as many rows as there are total lines in the scrollback buffer.
    This is kind of a hack to allow searching through the entire scroll buffer. There is a perf hit with having a large scrollback buffer. Therefore the current buffer is limited to 5k rows.
    */
    resizeForSearch() {
        let newRows = Math.max(this.xterm.lines.length, this.xterm.rows);
        this.xterm.resize(this.xterm.cols, newRows);
    }

    /* resize the terminal based on the the dimensions of what's visible on screen.*/
    refit() {
        let size = this.xterm.proposeGeometry();

        let ptyRows = size.rows;
        let ptyCols = size.cols;//Math.max(size.cols, 190);
        this.ptyProcess.resize(ptyCols, ptyRows);

        let xtermRows = size.rows;// - 1;
        if (this.searchInProgress) {
            // search is in progress so add all the lines to the DOM.
            //xtermRows = Math.max(this.xterm.lines.length, xtermRows);
        }

        this.xterm.resize(size.cols, xtermRows);

    }

    getTerminalDataFromUrl(): string {
        if (window.location.search && this.getParams(window.location.search)["data"]) {
            // eg. ?data=<script>
            let query = window.location.search;
            //<Script>
            query = query.slice(6);
            //console.log(query);
            // replace all new lines with ; for now.
            // The terminal ends up reversing the order of lines if \n is used.
            return Buffer.from(decodeURIComponent(query), 'base64').toString('utf8').replace(/\n/g, ";");
        } else {
            return "";
        }
    }

    render() {
        let result = <div style={{ height: "100%" }} className={"terminal-container"} ref={(input) => this.terminalContainer = input}></div>
        return result;
    }

    componentWillMount() {

        let pathVar: string = process.env.Path;
        if (pathVar && !pathVar.endsWith(";")) {
            // Terminate path with ;. Without this, node-pty has trouble finding powershell.exe
            process.env.Path += ";"
        }

        try {
            this.ptyProcess = pty.spawn('powershell.exe', this.getLaunchParametersFromTerminalManager(), {
                name: 'xterm-color',
                cols: 120,
                rows: 120,
                cwd: process.env.PWD,
                env: process.env
            });
        } catch (e) {
            alert("Error launching powershell.exe. Make sure PowerShell is installed on your machine and your System Path Environment Variable contains the PowerShell directory.")
        }
    }

    componentDidMount() {
        if (!this.xterm) {
            this.xterm = new Terminal({
                cursorBlink: true,
                scrollback: 5000
            });

            if (!this.terminalContainer) {
                alert("Unkown error initializing terminal.");
            } else {
                this.xterm.open(this.terminalContainer, true); // Focus by default.
                this.refit();
                this.runTerminal();
            }
        }

        window.addEventListener("resize", () => this.refit());
    }

    componentWillUnmount() {
        window.removeEventListener("resize", () => this.refit());
    }

    runTerminal() {
        if (this.xterm._initialized) {
            return;
        }

        this.xterm.setOption('cursorStyle', 'underline');
        this.xterm.on('data', (data) => {
            this.ptyProcess.write(data);
        });

        this.xterm.on('paste', (data, ev) => {
            this.xterm.write(data);
        });

        this.xterm.on('title', (title) => {
            ipcRenderer.send("terminal-title-changed-callback", title);
        });

        this.ptyProcess.on('data', (data) => {
            this.xterm.clearSelection();
            this.xterm.write(data);
        });

        this.xterm.attachCustomKeyEventHandler((event: KeyboardEvent) => {

            if (event.ctrlKey && event.keyCode == 67) {
                // Ctrl+C handling
                if (this.xterm.hasSelection()) {
                    return false;
                }

                return true;
            }

            if (event.ctrlKey && event.keyCode == 8) {
                this.ptyProcess.write('\x17');
                return false;
            }

            // if (event.ctrlKey && event.keyCode == 70) {
            //     // Don't pass through Ctrl+F - this is used as the in-page search shortcut.
            //     // TODO: Fix in-page search after the search addon ships
            //     //return false;
            // }

            // TODO add the full list of shortcuts not to pass to terminal here.
        });

        this.xterm._initialized = true;
        let terminalData = this.getTerminalDataFromUrl();
        if (terminalData) {
            this.xterm.send(terminalData);
        }

        this.xterm.focus();
    }
}

const App = () => (
    <div style={{ height: "100%" }}>
        <TerminalContainer></TerminalContainer>
    </div>
);


ReactDOM.render(
    <App />,
    document.getElementById('react-app')
);
