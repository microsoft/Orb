//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />

import * as React from "react";
import { observer } from "mobx-react";
import AutoComplete from "material-ui/AutoComplete";
import { SearchProps, StateManager, PageName, SearchResult, SearchResults, Map } from "../state/state";
import RaisedButton from "material-ui/RaisedButton";
import { grey400 } from "material-ui/styles/colors";
import { DateTimeWidget } from "../dateTimeWidget/dateTimeWidget";
import { ModelReader } from "../modelReader/modelReader";
import { KustoData } from "../data/kustoData";
import Divider from "material-ui/Divider";
import { List, ListItem } from "material-ui/List";
import * as m from "Model";
import { IDataProviderResourceExternalContext } from "../extensions/dataProviders/dataProvider";
import { DataProviderSelector } from "../extensions/dataProviders/dataProviderSelector";
import { TreeGenerator } from "../explorer/treeGenerator";
import CircularProgress from "material-ui/CircularProgress";
import Subheader from "material-ui/Subheader";
import TextField from "material-ui/TextField";
import * as Promise from "bluebird";

let log = require("loglevel");

// Will revisit these code once we have more actions on the search result.
// const iconButtonElement = (
//     <IconButton
//         touch={true}
//         tooltip="more"
//         tooltipPosition="bottom-left"
//         >
//         <MoreVertIcon color={grey400} />
//     </IconButton>
// );

// const renderRightButtonIcon =
//     (callback: (definitionKey: string, path: string, objectKey: string) => any, definitionKey, path: string, objectKey: string) => {
//         return (
//             <IconMenu onItemTouchTap={(object, childobject) => { callback(definitionKey, path, objectKey); } } iconButtonElement={iconButtonElement}>
//                 <MenuItem>Add to Tree</MenuItem>
//             </IconMenu>
//         )
//     };

@observer
export class Search extends React.Component<SearchProps, any> {
    private searchNamespace: string;
    private searchIncarnation: string;
    private searchProps: Array<m.RequiredBaseProps>;
    private requiredBaseProps: Map<string> = {};
    pathRef;
    keyRef;

    constructor(props) {
        super(props);
        this.handleNamespaceUpdate = this.handleNamespaceUpdate.bind(this);
        this.handleNamespaceSelect = this.handleNamespaceSelect.bind(this);
        this.handlePathUpdate = this.handlePathUpdate.bind(this);
        this.handlePathSelect = this.handlePathSelect.bind(this);
        this.handleKeyChange = this.handleKeyChange.bind(this);
        this.handleSearchClick = this.handleSearchClick.bind(this);
        this.handleCancelClick = this.handleCancelClick.bind(this);
        this.handleListItemClick = this.handleListItemClick.bind(this);
        this.handleSearchPropsSelect = this.handleSearchPropsSelect.bind(this);
        this.handleSearchPropsUpdate = this.handleSearchPropsUpdate.bind(this);
    }

    handleSearchPropsSelect(name, selectText) {
        this.requiredBaseProps[name] = selectText;

        // when the search prop is selected, rerender the view
        // fixes issue introduced with newer Material UI
        this.forceUpdate();
    }

    handleSearchPropsUpdate(name, searchText, dataSource) {
        let index = dataSource.indexOf(searchText);
        if (searchText !== "" && index !== -1) {
            this.handleSearchPropsSelect(name, searchText);
        }
    }

    handleNamespaceUpdate(searchText, dataSource) {
        if (searchText === "" || dataSource.includes(searchText)) {
            this.updateObjectDefinitions(searchText);
        }
    }

    handleNamespaceSelect(selectedText, index) {
        let forceUpdate = selectedText != this.props.inner.namespace;

        this.updateObjectDefinitions(selectedText);

        if (forceUpdate) {
            this.forceUpdate();
        }
    }

    handlePathUpdate(searchText, dataSource) {
        if (searchText === "" || dataSource.includes(searchText)) {
            this.props.inner.setPath(searchText);
        }
    }

    handlePathSelect(selectedText, index) {
        this.props.inner.setPath(selectedText);

        // when the path is selected, rerender the view
        // fixes issue introduced with newer Material UI
        this.forceUpdate();
    }

    handleKeyChange(event: React.FormEvent<any>) {
        this.props.inner.setKey(((event.target) as any).value);
    }

    handleSearchClick() {
        let absoluteTime = this.props.inner.dateTimeWidget.inner.getAbsoluteTimeSynchronized();
        if (absoluteTime.startTime >= absoluteTime.endTime) {
            log.error("Invalid time range, please review your selection.");
            return;
        }

        this.props.inner.setInProgress(true);
        this.searchIncarnation = new Date().toString();
        this.searchObject(this.searchIncarnation, this.props.inner.searchResultLimit).then((result) => {
            if (this.props.inner.inProgress && result.searchContext === this.searchIncarnation) {
                if (!result.data || result.data.length === 0) {
                    this.props.inner.setSearchResult(null, 0);
                    this.props.inner.renderSearchResult();
                    return;
                }

                let showLimitHitMessage = false;
                let resultCount = 0;

                result.data.forEach(item => {
                    if (item) {
                        let count = item.data ? item.data.length : 0;
                        resultCount += count;
                        if (count > this.props.inner.searchResultLimit) {
                            showLimitHitMessage = true;
                        }
                    }
                });

                if (showLimitHitMessage) {
                    log.info("Search result hit the max limit: " + this.props.inner.searchResultLimit + ", not all results will be displayed.");
                }

                this.props.inner.setSearchResult(result.data, resultCount);
                this.props.inner.renderSearchResult();
                let state = this.props.inner;
            }
        }).catch((e) => {
            this.props.inner.setInProgress(false);
            log.error(e);
        });
    }

    handleCancelClick() {
        this.props.inner.setInProgress(false);
    }

    componentWillMount() {
        if (this.props.inner.namespace) {
            this.updateObjectDefinitions(this.props.inner.namespace);
        }

        ModelReader.updateNameSpaceSrc();
    }

    componentDidMount() {
        this.props.inner.setRef(this);
    }

    addObjectToTree(namespace: string, path: string, objectContext: m.ObjectContext, definitionKey: string) {
        let explorerState = StateManager.getStore().sideBar.inner.explorer.inner;
        return TreeGenerator.generateTree(namespace, path, definitionKey ? objectContext.requiredProps : {}, null, true, objectContext.requiredBaseProps)
            .then((root) => {
                explorerState.addObjectTree(root);
            });
    }

    handleListItemClick(event: React.MouseEvent<any>, namespace: string, path: string, objectContext: m.ObjectContext, definitionKey: string) {
        this.addObjectToTree(namespace, path, objectContext, definitionKey).then(() => {
            StateManager.getStore().sideBar.inner.setActivePage(PageName.EXPLORER);
        }).catch((e) => {
            log.error(e);
        });
    }

    updateObjectDefinitions(namespace: string) {
        this.props.inner.setNameSpace(namespace);

        if (!namespace) {
            return;
        }

        // Reads the objectDefinition, and add the object path to PathDataSrc.
        ModelReader.getObjectDefinitions(namespace).then((Definitions) => {
            let pathDataSrc = [];

            for (let path in Definitions) {
                if (!Definitions[path].original.hideFromSearch) {
                    pathDataSrc.push(path);
                }
            }

            return ModelReader.getRequiredBaseProps(namespace).then((requiredBaseProps) => {
                let searchProps = [];
                if (requiredBaseProps && requiredBaseProps.length > 0) {
                    requiredBaseProps.forEach((requiredBaseProp) => {
                        if (requiredBaseProp.type === "enum") {
                            searchProps.push(requiredBaseProp);
                            this.requiredBaseProps[requiredBaseProp.name] = requiredBaseProp.value[0];
                        }
                        else if (requiredBaseProp.type === "string") {
                            searchProps.push(requiredBaseProp);
                            this.requiredBaseProps[requiredBaseProp.name] = "";
                        }
                    })
                }

                this.searchProps = searchProps;
                this.props.inner.setPathDataSrc(pathDataSrc);
            });
        }).catch((e) => {
            log.error(e);
        });
    }

    searchObject(searchContext: Object, limit: number): Promise<SearchResults> {
        let state = this.props.inner;
        let namespace = state.namespace;
        this.searchNamespace = namespace;

        let pathSpecified: boolean = (state.path) ? true : false;

        // If using the default path data source, exclude paths that are global
        let paths = pathSpecified ? [state.path] : this.props.inner.pathDataSrc;
        let searchKey = state.key ? state.key.trim() : state.key;
        let dateTimeWidgetState = state.dateTimeWidget.inner;
        let absoluteTime = dateTimeWidgetState.getAbsoluteTimeSynchronized();
        let timeAgoText = dateTimeWidgetState.timeAgoText;
        let isRelativeMode = dateTimeWidgetState.isRelativeMode;

        if (!namespace || !paths || paths.length === 0) {
            // Searching without namespace currently is not supported.
            let result: SearchResults = {
                searchContext: searchContext,
                data: []
            }
            return Promise.resolve(result);
        }

        return Promise.all(paths.map((path, i) => {

            return ModelReader.getObjectDefinition(namespace, path).then((objectDefinition) => {
                state.objectDefinition = objectDefinition.original;

                // If disablePathlessSearch is true and a path is not specified, skip searching this object
                if (!pathSpecified && objectDefinition.original.disablePathlessSearch) {
                    return {
                        objectDefinitionKey: "",
                        path: "",
                        data: []
                    };
                }

                if (!objectDefinition.original.key) {
                    let result: SearchResult;

                    if (!state.path) {
                        // This is for handling global objects when no path specified
                        result = {
                            objectDefinitionKey: "",
                            path: "",
                            data: []
                        }
                    } else {
                        // This is for handling root path.
                        result = {
                            objectDefinitionKey: "",
                            path: path,
                            data: [path]
                        };
                    }

                    return result;
                }

                let externalContext: IDataProviderResourceExternalContext = {
                    startTime: absoluteTime.startTime,
                    endTime: absoluteTime.endTime,
                    timeAgoText: timeAgoText,
                    isRelativeMode: isRelativeMode,
                };

                let dataProviderResource = objectDefinition.original.constructor;

                let dataProvider = DataProviderSelector.getDataProvider(dataProviderResource);
                if (!dataProvider.getObjectSearchData) {
                    throw "Object search implementation not found for resource type: " + dataProviderResource.type;
                }

                let objectContext = null;
                if (this.requiredBaseProps && this.requiredBaseProps != {}) {
                    objectContext = {
                        requiredBaseProps: Object.assign({}, this.requiredBaseProps)
                    }
                }

                return dataProvider.getObjectSearchData(searchKey, dataProviderResource, objectDefinition, externalContext, this.props.inner.searchResultLimit + 1, objectContext).then((data) => {
                    if (data.length > 0) {
                        return this.convertToObjectContext(data, objectDefinition.original.requiredProps, objectContext.requiredBaseProps).then((data) => {
                            let result: SearchResult = {
                                objectDefinitionKey: objectDefinition.original.key,
                                path: path,
                                data: data
                            };

                            return result;
                        });
                    }

                    return {};
                })
            }).catch((e) => {
                log.error(e);
                return {};
            });
        })).then((results: SearchResult[]) => {
            let searchResults = {
                searchContext: searchContext,
                data: results
            };

            return searchResults;
        });
    }

    convertToObjectContext(data: any[], requiredProps: string[], requiredBaseProps: string[]): Promise<m.ObjectContext[]> {
        return Promise.all(data.map((row, i) => {
            return { requiredProps: row, requiredBaseProps: requiredBaseProps };
        }));
    }

    renderSearchResult() {
        if (!this.props.inner.searchResultVisible) {
            return;
        }

        if (!this.props.inner.searchResultCount) {
            return (
                <div style={{ paddingTop: 20, paddingLeft: 22, fontFamily: "Roboto, sans-serif", fontSize: 13.5, fontWeight: "normal" }}>
                    No results found. <br />
                    <ul>
                        <li>Try using the wildcard * in your key.</li>
                        <li>Expand your search time range.</li>
                    </ul>
                </div>)
        }
        // RightIconButton will be added once we have more action.
        // <ListItem key={objectKeyIndex}
        //     rightIconButton={renderRightButtonIcon(this.handleRightButtonClick, item.objectDefinitionKey, item.path, objectKey)}
        //     primaryText={objectKey}
        //     onClick={(event) => this.handleListItemClick(event, item.objectDefinitionKey, item.path, objectKey)}
        //     />
        return (
            <div>
                <div style={{ width: "100%", backgroundColor: "rgb(64, 64, 64)", height: "30px", fontSize: "13.5px", paddingTop: "10px", paddingLeft: "10px" }}>
                    <span style={{ color: "rgb(189, 189, 189)" }}>Search Results</span>
                </div >
                {
                    this.props.inner.searchResult.map((item, itemIndex) => {

                        if (!item.path) {

                            return;
                        }
                        return (
                            <div key={itemIndex}>
                                <Subheader>{item.path}</Subheader>
                                <Divider />
                                {

                                    item.data.map((objectContext, objectIndex) => {
                                        let primaryText = item.path;

                                        if (objectContext && objectContext.requiredProps && objectContext.requiredProps[item.objectDefinitionKey]) {
                                            primaryText = objectContext.requiredProps[item.objectDefinitionKey];
                                        }

                                        return <ListItem style={{ fontFamily: "Roboto, sans-serif", fontSize: 13.5, fontWeight: "normal" }}
                                            key={objectIndex}
                                            innerDivStyle={{ padding: "16px 16px 16px 25px" }}
                                            primaryText={
                                                <div style={{
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap"
                                                }}>
                                                    {primaryText}
                                                </div>}
                                            onClick={(event) => this.handleListItemClick(event, this.searchNamespace, item.path, objectContext, item.objectDefinitionKey)}
                                        />
                                    })
                                }
                            </div>
                        )
                    })
                }
            </div>
        );
    }

    renderSearchButton() {
        if (this.props.inner.inProgress) {
            return <RaisedButton buttonStyle={{ backgroundColor: "rgb(109, 109, 109)" }} labelPosition="after" label="Cancel" icon={<CircularProgress size={23} />} onClick={this.handleCancelClick} />;
        } else {
            return <RaisedButton buttonStyle={{ backgroundColor: "rgb(109, 109, 109)" }} label="Search" onClick={this.handleSearchClick} backgroundColor={grey400} />
        }
    }

    renderSearchProps() {
        if (this.searchProps && this.searchProps.length > 0) {
            return this.searchProps.map((item, index) => {
                if (item.type === "enum") {
                    return (
                        <AutoComplete
                            key={index}
                            menuCloseDelay={0}
                            style={{ width: "100%", paddingLeft: 20, paddingRight: 20, boxSizing: "border-box" }}
                            floatingLabelText={item.label}
                            dataSource={item.value.slice()}
                            filter={AutoComplete.noFilter}
                            textFieldStyle={{ width: "100%" }}
                            onUpdateInput={(searchText, dataSource) => this.handleSearchPropsUpdate(item.name, searchText, dataSource)}
                            onNewRequest={(selectText, index) => this.handleSearchPropsSelect(item.name, selectText)}
                            searchText={this.requiredBaseProps[item.name]}
                            openOnFocus={true}
                        />
                    )
                }
                else if (item.type === "string") {
                    return (
                        <div style={{ width: "100%", paddingLeft: 20, paddingRight: 20, boxSizing: "border-box" }}>
                            <TextField
                                style={{ width: "100%" }}
                                floatingLabelText={item.name}
                                defaultValue=""
                                onChange={(event) => this.handleSearchPropsSelect(item.name, ((event.target) as any).value)}
                            />
                        </div>
                    )
                }
            })
        }
    }

    // Will revisit these code once we resolve the autocomplete performance issue.
    // filter(searchText: string, key: string): boolean {
    //     if (searchText && searchText.length > 3) {
    //         let k = key.toLowerCase();
    //         let s = searchText.toLowerCase();
    //         if (k.indexOf(s) !== -1 || k.match(s.split("*").join(".*"))) {
    //             return true;
    //         }
    //     }

    //     return false;
    // }

    render() {
        let extendedProps = {
            onKeyPress: (event) => {
                if (event.which === 13 || event.keyCode === 13) {
                    this.handleSearchClick();
                }
            }
        };

        return (
            <div style={{ marginTop: -10 }}>
                <div>
                    <AutoComplete
                        menuCloseDelay={0}
                        style={{ width: "100%", paddingLeft: 20, paddingRight: 20, boxSizing: "border-box" }}
                        menuStyle={{ overflowY: "auto", maxHeight: "75vh" }}
                        floatingLabelText="Namespace"
                        dataSource={this.props.inner.namespaceDataSrc.slice()}
                        filter={AutoComplete.caseInsensitiveFilter}
                        textFieldStyle={{ width: "100%" }}
                        onUpdateInput={this.handleNamespaceUpdate}
                        onNewRequest={this.handleNamespaceSelect}
                        searchText={this.props.inner.namespace}
                        openOnFocus={true}
                    />
                </div>
                <div>
                    <AutoComplete
                        ref={
                            (ref) => {
                                this.pathRef = ref;
                            }
                        }
                        menuCloseDelay={0}
                        style={{ width: "100%", paddingLeft: 20, paddingRight: 20, boxSizing: "border-box" }}
                        menuStyle={{ overflowY: "auto", maxHeight: "75vh" }}
                        floatingLabelText="Object Path"
                        dataSource={this.props.inner.pathDataSrc.slice()}
                        filter={AutoComplete.caseInsensitiveFilter}
                        textFieldStyle={{ width: "100%" }}
                        onUpdateInput={this.handlePathUpdate}
                        onNewRequest={this.handlePathSelect}
                        searchText={this.props.inner.path}
                        openOnFocus={true}
                    />
                </div>
                <div style={{ width: "100%", paddingLeft: 20, paddingRight: 20, boxSizing: "border-box" }}>
                    <TextField
                        ref={
                            (ref) => {
                                this.keyRef = ref;
                            }
                        }
                        style={{ width: "100%" }}
                        floatingLabelText="Key"
                        defaultValue={this.props.inner.key}
                        onChange={(event) => this.handleKeyChange(event)}
                        {...extendedProps}
                    />
                </div>
                {this.renderSearchProps()}
                <div style={{ paddingTop: 10, paddingLeft: 20, paddingRight: 20 }} >
                    <DateTimeWidget style={{ width: "150px" }} inner={this.props.inner.dateTimeWidget.inner} />
                </div>
                <Divider style={{ marginTop: 20, marginBottom: 20 }} />
                <div style={{ marginLeft: 20 }}>
                    {this.renderSearchButton()}
                </div>
                <br />
                <Divider />
                <div>
                    {this.renderSearchResult()}
                </div>
            </div >
        )
    }
}