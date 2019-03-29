//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />

import * as React from "react";
import * as Autosuggest from "react-autosuggest";
import IconButton from "material-ui/IconButton";
import IconMenu from "material-ui/IconMenu";
import FontIcon from "material-ui/FontIcon";
import MenuItem from "material-ui/MenuItem";
import { TabState } from "../state/state";
import { LinkSuggestionDB, ResourceSuggestionDB, ISuggestion } from "../db/db";
import { StateManager } from "../state/state";
import * as Promise from "bluebird";
import * as path from "path";

const electron = require('electron');
const log = require("loglevel");

interface AddressBarState {
    value?: string;
    suggestions?: ISuggestion[];
    isBackButtonDisabled?: boolean;
    isForwardButtonDisabled?: boolean;
}

interface AddressBarProps {
    tab: TabState;
    onChange?: (event, newValue) => any;
    isBackButtonDisabled: boolean;
    isForwardButtonDisabled: boolean;
    onBackButtonClick: () => any;
    onForwardButtonClick: () => any;
    onRefreshButtonClick: () => any;
    onURLClick?: (suggestion: ISuggestion, ctrlPressed: boolean, enterPressed: boolean) => any;
}

interface InputProps {
    placeholder: string;
    value: string;
    onChange: (event, { newValue }) => any;
    onKeyDown: (event) => any;
    onBlur: () => any;
    onClick: () => any;
}

const renderInputComponent = (inputProps) => {
    return (
        <div style={{
            position: "relative",
        }}>
            <input {...inputProps} />
        </div>
    );
};

export class AddressBar extends React.Component<AddressBarProps, AddressBarState> {
    private inputRef: any;
    private contextMenu;
    private mounted;
    private inputFocused: boolean;

    constructor(props) {
        super(props);
        this.selectAll = this.selectAll.bind(this);
        this.correctURL = this.correctURL.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.getSuggestions = this.getSuggestions.bind(this);
        this.renderSuggestion = this.renderSuggestion.bind(this);
        this.handleInputChange = this.handleInputChange.bind(this);
        this.handleInputOnBlur = this.handleInputOnBlur.bind(this);
        this.handleInputOnClick = this.handleInputOnClick.bind(this);
        this.storeInputReference = this.storeInputReference.bind(this);
        this.handleBackButtonClick = this.handleBackButtonClick.bind(this);
        this.handleNextButtonClick = this.handleNextButtonClick.bind(this);
        this.handleSuggestionSelected = this.handleSuggestionSelected.bind(this);
        this.handleRefreshButtonClick = this.handleRefreshButtonClick.bind(this);
        this.handleSuggestionsFetchRequested = this.handleSuggestionsFetchRequested.bind(this);
        this.handleSuggestionsClearRequested = this.handleSuggestionsClearRequested.bind(this);
        this.state = {
            value: this.props.tab.url,
            suggestions: [],
            isBackButtonDisabled: this.props.isBackButtonDisabled,
            isForwardButtonDisabled: this.props.isForwardButtonDisabled,
        };

        this.inputFocused = false;
        this.mounted = false;
    }

    private selectAll() {
        if (this.inputRef) {
            this.inputRef.focus();
            this.inputRef.setSelectionRange(0, this.inputRef.value.length);
        }
    }

    private getSuggestionValue(suggestion: ISuggestion) {
        return suggestion.url;
    }

    private getSuggestions(value): Promise<any[]> {
        const inputValue = value.trim().toLowerCase();
        const inputLength = inputValue.length;

        if (inputLength === 0) {
            return Promise.resolve([]);
        }

        let suggestions = [];
        return ResourceSuggestionDB.instance()
            .findAddressbarAutoSuggestions(value).then((resourceSuggestions: ISuggestion[]) => {
                if (resourceSuggestions != null && resourceSuggestions.length != 0) {
                    suggestions = suggestions.concat(resourceSuggestions);
                }

                return LinkSuggestionDB.instance()
                    .findAddressbarAutoSuggestions(value).then((linkSuggestions: ISuggestion[]) => {
                        suggestions = suggestions.concat(linkSuggestions);
                        return suggestions;
                    });
            });
    }

    private handleInputChange(event, { newValue }) {
        if (this.mounted) {
            this.setState({
                value: newValue,
            });

            if (this.props.onChange) {
                this.props.onChange(event, newValue);
            }
        }
    }

    private handleKeyDown(event) {
        if (this.props.onURLClick) {
            let enterPressed = event.which === 13 || event.keyCode === 13;
            let ctrlPressed = event.ctrlKey;
            if (enterPressed) {
                let url = this.state.value;
                if (url === "about:help") {
                    StateManager.openHelpPageTab();
                } else {
                    ResourceSuggestionDB.instance().getSuggestionByURL(url).then((suggestion) => {
                        if (suggestion && suggestion.objectPath && suggestion.relativePathWithExtension) {
                            return;
                        }

                        let hostname = url.indexOf("://") > -1 ? url.split('/')[2] : url.split('/')[0];
                        let extname = path.extname(hostname);

                        if (ctrlPressed || extname && extname !== ".") {
                            url = this.correctURL(url, hostname);
                        } else if (url.indexOf("://") > -1) {

                        } else {
                            url = "https://www.google.com/search?q=" + url;
                        }

                        this.props.onURLClick({ url: url }, ctrlPressed, enterPressed);
                    })
                }
            }
        }
    }

    private correctURL(url: string, hostname: string) {
        const extname = path.extname(hostname);

        if (!url.match(/^[a-zA-Z]+:\/\//)) {
            url = "http://" + url;
        }

        if (!extname) {
            url = url.replace(hostname, hostname + ".com");
        }

        return url;
    }

    componentWillReceiveProps(newProps: AddressBarProps) {
        if (this.mounted) {
            this.setState({
                value: newProps.tab.url.startsWith("file://") ? "about:help" : newProps.tab.url,
            })
        }
    }

    componentDidMount() {
        this.mounted = true;
    }

    componentWillUnmount() {
        this.props.tab.addressbar = null;
        this.mounted = false;
    }

    handleSuggestionsFetchRequested({ value }) {
        if (this.mounted) {
            this.getSuggestions(value).then((res) => {
                this.setState({
                    suggestions: res
                });
            })
        }
    }

    handleSuggestionsClearRequested() {
        if (this.mounted) {
            this.setState({
                suggestions: []
            });
        }
    }

    handleBackButtonClick() {
        this.props.onBackButtonClick();
    }

    handleNextButtonClick() {
        this.props.onForwardButtonClick();
    }

    handleRefreshButtonClick() {
        this.props.onRefreshButtonClick();
    }

    handleSuggestionSelected(event, { suggestion }) {
        let ctrlPressed = event.ctrlKey;
        let enterPressed = event.which === 13 || event.keyCode === 13;
        this.props.onURLClick(suggestion, ctrlPressed, enterPressed);
    }

    handleInputOnBlur() {
        this.inputFocused = false;
    }

    handleInputOnClick() {
        if (!this.inputFocused) {
            this.selectAll();
            this.inputFocused = true;
        }
    }

    renderSuggestion(suggestion: ISuggestion) {
        return (
            <div style={{
                display: "flex",
                alignItems: "center"
            }} title={suggestion.url}>
                <img style={
                    {
                        width: 16,
                        height: 16,
                        marginRight: 2
                    }
                } src={"./extensions/resourceProviders/img/{0}.png".format(
                    suggestion.relativePathWithExtension ?
                        path.extname(suggestion.relativePathWithExtension).replace(".", "")
                        : "link")} />
                {suggestion.url}
            </div>)
    }

    storeInputReference = autosuggest => {
        if (autosuggest !== null) {
            this.inputRef = autosuggest.input;
        }
    }

    render() {
        const styles = {
            icon: {
                width: 18,
                height: 18,
            },
            iconButton: {
                width: 30,
                height: 30,
                padding: 3,
                marginRight: 5
            }
        }

        const inputProps: InputProps = {
            placeholder: '',
            value: this.state.value,
            onChange: this.handleInputChange,
            onKeyDown: this.handleKeyDown,
            onBlur: this.handleInputOnBlur,
            onClick: this.handleInputOnClick,
        };

        return (
            <div
                className="addressBar"
                style={{
                    display: "flex",
                    paddingLeft: 20,
                    paddingRight: 20,
                    paddingTop: 1,
                    paddingBottom: 1,
                    background: "rgb(64, 64, 64)"
                }}>
                <div style={{ width: 90, display: "flex", marginRight: 10 }}>
                    <IconButton disabled={this.state.isBackButtonDisabled} onClick={this.handleBackButtonClick} style={styles.iconButton}><FontIcon className="fa fa-chevron-left"></FontIcon></IconButton>
                    <IconButton disabled={this.state.isForwardButtonDisabled} onClick={this.handleNextButtonClick} style={styles.iconButton}><FontIcon className="fa fa-chevron-right"></FontIcon></IconButton>
                    <IconButton onClick={this.handleRefreshButtonClick} style={styles.iconButton}><FontIcon className="fa fa-refresh"></FontIcon></IconButton>
                </div>
                <div style={{ flex: 1, paddingTop: 2 }}>
                    <Autosuggest
                        suggestions={this.state.suggestions}
                        onSuggestionsFetchRequested={this.handleSuggestionsFetchRequested}
                        onSuggestionsClearRequested={this.handleSuggestionsClearRequested}
                        getSuggestionValue={this.getSuggestionValue}
                        renderSuggestion={this.renderSuggestion}
                        onSuggestionSelected={this.handleSuggestionSelected}
                        inputProps={inputProps}
                        renderInputComponent={renderInputComponent}
                        ref={this.storeInputReference}
                    />
                </div>
            </div>
        );
    }
}