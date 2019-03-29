//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />

import * as React from "react";
import { ipcRenderer } from 'electron';

interface Props {
    webview: any
    isDrivenExternally: boolean
}

interface State {
    isVisible?: boolean;
    matchCountString?: string;
    webContents?: any;
}

export class SearchInPage extends React.PureComponent<Props, State> {

    input: any;
    searchInProgress: boolean;
    webview: any;
    text: string;

    constructor(props) {
        super(props);

        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.onChange = this.onChange.bind(this);
        this.handleCloseButton = this.handleCloseButton.bind(this);
        this.handleSearchPrevious = this.handleSearchPrevious.bind(this);
        this.handleSearchNext = this.handleSearchNext.bind(this);
        this.stopSearch = this.stopSearch.bind(this);
        this.show = this.show.bind(this);
        this.hide = this.hide.bind(this);
        this.text = "";
        this.state = {
            isVisible: false,
            matchCountString: "",
            webContents: {},
        }

        ipcRenderer.on('tab-manager-toggleSearch', () => {
            this.show();
            if (this.input) {
                this.input.value = this.text;
                this.input.focus();
                this.input.select();
            }
        });
    }

    componentWillReceiveProps(props: Props) {
        if (props.webview && props.webview.view) {
            this.webview = props.webview.view;

            if (this.webview.getWebContents) {
                let webContents = this.webview.getWebContents();
                if (webContents) {
                    webContents.on('found-in-page', (event, result) => {
                        this.setState({ matchCountString: result.activeMatchOrdinal + " of " + result.matches });
                    })

                    this.setState({
                        webContents: webContents
                    })

                    return;
                }
            }

            this.webview.addEventListener('dom-ready', () => {
                let webContents = this.webview.getWebContents();
                if (webContents) {
                    webContents.on('found-in-page', (event, result) => {
                        this.setState({ matchCountString: result.activeMatchOrdinal + " of " + result.matches });
                    })

                    this.setState({
                        webContents: webContents
                    })
                }
            });
        }
    }

    show() {
        this.state.webContents.send("tab-manager-search-started");

        this.setState({
            isVisible: true
        })
    }

    hide() {
        if (this.state.webContents.isDestroyed && !this.state.webContents.isDestroyed()) {
            if (this.state.webContents && this.state.webContents.send) {
                this.state.webContents.send('tab-manager-search-stopped');
            }
        }

        this.stopSearch();
        this.setState({
            isVisible: false
        });

        if (this.props.webview) {
            this.props.webview.focus();
        }
    }

    stopSearch() {
        if (this.state.webContents && this.state.webContents.isDestroyed && !this.state.webContents.isDestroyed()) {
            this.state.webContents.stopFindInPage("clearSelection");
        }

        this.setState({
            matchCountString: ""
        })
    }

    handleSearchPrevious() {
        if (this.text) {
            if (this.props.isDrivenExternally) {
                this.state.webContents.send('tab-manager-search-findPrevious', this.text);
            } else {
                this.state.webContents.findInPage(this.text, { findNext: true, forward: false })
            }
            this.input.focus();
        }
    }

    handleSearchNext() {
        if (this.text) {
            if (this.props.isDrivenExternally) {
                this.state.webContents.send('tab-manager-search-findNext', this.text);
            } else {
                this.state.webContents.findInPage(this.text);
            }
            this.input.focus();
        }
    }

    handleCloseButton() {
        this.hide();
    }

    handleKeyDown(event: React.KeyboardEvent<any>) {
        if (event.key === "F3") {
            if (!event.shiftKey) {
                this.handleSearchNext();
            } else {
                this.handleSearchPrevious();
            }
        } else if (event.key === "Enter") {
            this.handleSearchNext();
        } else if (event.key === "Escape") {
            this.handleCloseButton();
        }
    }

    onChange(event) {
        this.text = this.input.value
        if (!this.text) {
            this.stopSearch();
        }

        this.setState({ isVisible: true });
        if (this.text) {
            this.state.webContents.findInPage(this.text);
        }
    }

    render() {
        if (!this.state.isVisible) {
            return null;
        }

        return (
            <div className={"searchInPage-box"}>
                <input ref={(input) => this.input = input} type={"text"} autoFocus className={"searchInPage-input"} onChange={this.onChange} onKeyDown={this.handleKeyDown} />
                <span className={"searchInPage-count"}>{this.state.matchCountString}</span>
                <button title={"Previous (Shift + F3)"} type={"button"} className={"searchInPageButton"} onClick={this.handleSearchPrevious}>
                    <i className={"fa fa-angle-up"}></i>
                </button>
                <button title={"Next (F3)"} type={"button"} className={"searchInPageButton"} onClick={this.handleSearchNext}>
                    <i className={"fa fa-angle-down"}></i>
                </button>
                <button title={"Close (Escape)"} type={"button"} className={"searchInPageButton"} onClick={this.handleCloseButton}>
                    <i style={{ fontStyle: "normal" }}>{String.fromCharCode(10006)} </i>
                </button>
            </div>);
    }
}