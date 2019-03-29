//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />

import * as m from "Model";
import * as path from "path";
import * as React from "react";
import * as Autosuggest from "react-autosuggest";
import FontIcon from "material-ui/FontIcon";
import { ResourceCollections, IResource } from "../db/db";
import { ModelReader } from "../modelReader/modelReader";
import { ResourceProviderHelper } from "../extensions/resourceProviders/helper";
import * as Promise from "bluebird";

interface InlineSearchState {
    value?: string;
    suggestions?: IResource[];
    showSearchInput: boolean;
}

interface InlineSearchProps {
    onChange?: (event, newValue) => any;
    onVisibleChange?: (isVisible: boolean) => void;
    disable?: boolean;
    displayName: string;
    namespace: string;
    objectPath: string;
    depth: number;
    objectContext: m.ObjectContext;
    directory: string;
    closeButton: any;
}

interface InputProps {
    className: string;
    placeholder: string;
    value: string;
    autoFocus: boolean;
    onChange: (event, { newValue }) => any;
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

export class InlineSearch extends React.Component<InlineSearchProps, InlineSearchState> {
    private inputRef: any;
    private mounted;
    private inputFocused: boolean;
    private escKeyListener: (event) => void;
    private mouseListener: (event) => void;

    constructor(props) {
        super(props);
        this.handleURLClick = this.handleURLClick.bind(this);
        this.getSuggestions = this.getSuggestions.bind(this);
        this.renderSuggestion = this.renderSuggestion.bind(this);
        this.renderCloseButton = this.renderCloseButton.bind(this);
        this.handleInputChange = this.handleInputChange.bind(this);
        this.handleInputOnBlur = this.handleInputOnBlur.bind(this);
        this.getSuggestionValue = this.getSuggestionValue.bind(this);
        this.handleInputOnClick = this.handleInputOnClick.bind(this);
        this.renderSearchButton = this.renderSearchButton.bind(this);
        this.storeInputReference = this.storeInputReference.bind(this);
        this.handleSearchButtonClick = this.handleSearchButtonClick.bind(this);
        this.handleSuggestionSelected = this.handleSuggestionSelected.bind(this);
        this.handleSuggestionsFetchRequested = this.handleSuggestionsFetchRequested.bind(this);
        this.handleSuggestionsClearRequested = this.handleSuggestionsClearRequested.bind(this);
        this.state = {
            value: this.props.displayName + "*",
            suggestions: [],
            showSearchInput: false,
        };

        this.inputFocused = false;
        this.mounted = false;
        this.escKeyListener = (event) => {
            if (event.keyCode === 27 || event.key === "Escape") {
                this.handleInputOnBlur();
            }
        };

        this.mouseListener = (event) => {
            if (this.mounted && !event.target.className.startsWith("exclude") && !event.target.className.startsWith("react-autosuggest__suggestion")) {
                this.handleInputOnBlur();
            }
        }
    }

    public componentDidMount() {
        this.mounted = true;
    }

    public componentWillMount() {
        document.addEventListener("keydown", this.escKeyListener);
        document.addEventListener("mousedown", this.mouseListener);
    }

    public componentWillUnmount() {
        this.mounted = false;
        document.removeEventListener("keydown", this.escKeyListener);
        document.removeEventListener("mousedown", this.mouseListener);
    }

    public render() {
        const inputProps: InputProps = {
            placeholder: "",
            autoFocus: true,
            className: "inlineSearchInput",
            value: this.state.value,
            onChange: this.handleInputChange,
            onBlur: this.handleInputOnBlur,
            onClick: this.handleInputOnClick,
        };

        const element = this.state.showSearchInput ?
            (<div
                className="addressBar highlight"
                style={{
                    paddingRight: 25,
                    paddingLeft: 20 * (1 + this.props.depth) + 4,
                    width: "inherit",
                    right: "10px",
                    whiteSpace: "nowrap",
                    zIndex: 2,
                    height: 24,
                    paddingTop: 4,
                    paddingBottom: 4,
                    alignItems: "center",
                    display: "flex",
                }}>
                <div style={{ width: "inherit" }}>
                    <Autosuggest
                        suggestions={this.state.suggestions}
                        onSuggestionsFetchRequested={this.handleSuggestionsFetchRequested}
                        onSuggestionsClearRequested={this.handleSuggestionsClearRequested}
                        getSuggestionValue={this.getSuggestionValue}
                        renderSuggestion={this.renderSuggestion}
                        onSuggestionSelected={this.handleSuggestionSelected}
                        renderInputComponent={renderInputComponent}
                        ref={this.storeInputReference}
                        inputProps={inputProps}
                    />
                </div>
            </div >) :
            (<div className={"fade"} style={{
                alignItems: "center",
                display: "flex",
                width: "inherit",
            }}>
                {this.props.children}
                {this.renderCloseButton()}
                {this.renderSearchButton()}
            </div>);

        return element;
    }

    private getSuggestionValue(suggestion: IResource) {
        return suggestion.relativePathWithExtension.replace(this.props.directory, "");
    }

    private getSuggestions(value) {
        const inputValue = value.trim();
        const inputLength = inputValue.length;

        if (inputLength === 0) {
            return Promise.resolve([]);
        }

        return ResourceCollections.instance().findResource(
            this.props.namespace,
            this.props.objectPath,
            this.props.directory + inputValue,
        ).then((resourceSuggestions: IResource[]) => {
            return resourceSuggestions;
        });
    }

    private handleInputChange(event, { newValue }) {
        if (this.mounted && (newValue as string).startsWith(this.props.displayName)) {
            this.setState({
                value: newValue,
            });

            if (this.props.onChange) {
                this.props.onChange(event, newValue);
            }
        }
    }

    private handleSuggestionsFetchRequested({ value }) {
        if (this.mounted) {
            this.getSuggestions(value.replace(this.props.displayName, "")).then((res) => {

                this.setState({
                    suggestions: res.sort((a, b) => {
                        return a.relativePathWithExtension.localeCompare(b.relativePathWithExtension);
                    }),
                });

                // Auto focus gets called before setting input value, this will place the cursor at the beginning.
                // We need to reset the value when suggestions loaded so that input cursor can move to the end.
                let previous = this.inputRef.value;
                this.inputRef.value = "";
                this.inputRef.value = previous;
            });
        }
    }

    private handleSuggestionsClearRequested() {
        if (this.mounted) {
            this.setState({
                suggestions: [],
            });
        }
    }

    private handleSuggestionSelected(event, { suggestion }) {
        this.handleURLClick(event, suggestion);
    }

    private handleInputOnBlur() {
        this.inputFocused = false;

        this.setState({
            showSearchInput: false,
            value: this.props.displayName + "*",
        });

        if (this.props.onVisibleChange) {
            this.props.onVisibleChange(false);
        }
    }

    private handleInputOnClick() {
        if (!this.inputFocused) {
            if (this.inputRef) {
                this.inputRef.focus();
                this.inputFocused = true;
            }
        }
    }

    private handleSearchButtonClick() {
        if (this.mounted) {
            this.setState({
                showSearchInput: true,
            });

            if (this.props.onVisibleChange) {
                this.props.onVisibleChange(true);
            }
        }
    }

    private handleURLClick(event, suggestion: IResource) {
        event.persist();

        ModelReader.getObjectDefinition(this.props.namespace, this.props.objectPath).then((objectDefinition) => {
            const resource = objectDefinition.resourceByRelativePathWithExtension[
                suggestion.relativePathWithExtension
            ];

            ResourceProviderHelper.openResource(
                resource,
                this.props.objectContext,
                objectDefinition,
                "InlineSearch",
                event,
                path.join(this.props.namespace, this.props.objectPath, suggestion.relativePathWithExtension),
                false,
                true);
        });

        this.handleInputOnBlur();
    }

    private renderSuggestion(suggestion: IResource) {
        const displayURL = suggestion.relativePathWithExtension.replace(this.props.directory, "");
        return (
            <div className="exclude" style={{
                display: "flex",
                alignItems: "center",
                fontSize: 12
            }} onContextMenu={() => {
                ModelReader.getObjectDefinition(this.props.namespace, this.props.objectPath).then((objectDefinition) => {
                    const resource = objectDefinition.resourceByRelativePathWithExtension[
                        suggestion.relativePathWithExtension
                    ];

                    const contextMenu = ResourceProviderHelper.createResourceContextMenu(
                        resource,
                        objectDefinition,
                        this.props.objectContext)

                    contextMenu.popup({});
                });
            }} title={displayURL}>
                <img style={
                    {
                        width: 16,
                        height: 16,
                        minHeight: 16,
                        minWidth: 16,
                        marginRight: 2,
                    }
                } src={"./extensions/resourceProviders/img/{0}.png".format(
                    suggestion ? path.extname(suggestion.relativePathWithExtension).replace(".", "") : "link")} />
                {displayURL}
            </div>
        );
    }

    private renderSearchButton() {
        if (!this.props.disable && !this.state.showSearchInput) {
            return (
                <span
                    title={"Search Under Directory"} className={"inlineSearchButton"}
                    onClick={this.handleSearchButtonClick}>
                    <FontIcon
                        className="fa fa-search"
                        style={{ fontSize: 15 }}
                    />
                </span>
            );
        }
    }

    private renderCloseButton() {
        if (this.props.closeButton && !this.state.showSearchInput) {
            return this.props.closeButton;
        }
    }

    private storeInputReference = (autosuggest) => {
        if (autosuggest !== null) {
            this.inputRef = autosuggest.input;
        }
    }
}
