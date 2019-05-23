//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />

import { observable, action, useStrict, computed } from "mobx";
import { ipcRenderer, remote } from "electron";
import { Util } from "../util/util";
import * as m from "Model";
import { GitFile, Repo } from "../repo/repo";
import { TreeGenerator } from "../explorer/treeGenerator";
import * as uuidV4 from "uuid/v4";
import { TerminalConfigManager } from "../config/terminalConfig";
import { ResourceProviderHelper } from "../extensions/ResourceProviders/helper";
import { ResourceSuggestionDB } from "../db/db";
import { ResourceProviderSelector } from "../extensions/ResourceProviders/ResourceProviderSelector";
import { VstsResponse } from "../repo/vstsClient";
import * as url from "url";
import * as fs from "fs";
import { LinkManager } from "../linkManager/linkManager";
import { ExtensionState } from "../extensions/commonInterfaces";
import { ConfigUtil } from "../config/configUtil";
import { Win32Edge } from "../data/win32Edge";
import * as Promise from "bluebird";

var glob = require("glob")
let log = require("loglevel");

export interface Map<V> {
    [K: string]: V;
}

export class SuggestedObjects {
    objectDefinitionKey: string;
    path: string;
    data: Array<m.ObjectContext>;
}

export class SuggestedResources {
    hitCount: number;
    namespace: string;
    objectPath: string;
    relativePath: string;
}

export class TabRequest {
    url: string;
    key?: string;
    title?: string;
    icon?: string;
    tooltip?: string;
    context?: TabManagerContext;
    openInNew?: boolean;
    pendingPromise?: Promise<any>;
    nodeIntegration?: boolean;
    refreshProvider?: () => void;
    resourceState?: TabResourceState;
    isForegroundTab?= true;
    preload?: string;
    win32AppRequest?: Win32AppTabRequest;
    tabKey?: string;

    // Currently supported events: show, close

    on?(eventName: string, handler: (e: Event) => void) {
        this.eventHandlers[eventName] = handler;
    }

    eventHandlers?: Map<(e: Event) => void> = {};
}

export class Win32AppTabRequest {
    appReference: string; // The reference to use while managing tabs. Re-use the same reference to have the same process handle multiple tabs.
    path: string; // The path to the Win32 App.
    arguments: string; // Arguments for the win32 App.
}

export class TabResourceState {
    objectId: string;
    namespace: string;
    objectPath: string;
    objectContext: m.ObjectContext;
    relativePath: string;
    isUnprotected: boolean;
}

export class TabState extends TabRequest { // TODO remove this extension. It's better to latch the original tab object on the tab state instead of inherit.
    element?: any;
    webview?: any;
    addressbar?: any;
    nativeWindowReference?: string;
    request?: TabRequest
}

export class Constants {
    static helpUrl = Util.getUrlPathRelativeToApp("./markdown/markdownView.html?md=documentation/all.md");
    static terminalUrl = Util.getUrlPathRelativeToApp("./terminal/terminal.html");
    static mdUrl = Util.getUrlPathRelativeToApp("./markdown/markdownView.html");
    static editorUrl = Util.getUrlPathRelativeToApp("./editor/editor.html") + "?originalSrc={0}&originalSrcType={1}&modifiedSrc={2}&modifiedSrcType={3}&language={4}&isDiff={5}";
    static prHelperUrl = Util.getUrlPathRelativeToApp("./markdown/markdownView.html?md=documentation/pullRequest.md");
    static reactResourceUrl = Util.getUrlPathRelativeToApp("./extensions/resourceProviders/reactResourceProvider/index.html");
    static resourceEditorUrl = Util.getUrlPathRelativeToApp("./resourceEditor/resourceEditor.html");
    static extensionApps = Util.getAppPath() + "\\extensions\\apps";
    static extensionsManifestDir = "src\\ProtectedModels\\Extensions";
    static orbHomePage = ConfigUtil.GetSetting("homePageUrl");
}

namespace ExplorerNodeTypes {
    export type Directory = "directory"
    export type Resource = "resource"
    export type Association = "association"
    export type Object = "object"
}

export enum PageName {
    EXPLORER,
    SEARCH,
    EDIT
}

export type EditorDataType = "URI" | "RAW_CONTENT";

export interface SearchResults {
    searchContext: Object;
    data: Array<SearchResult>;
}

export interface SearchResult {
    objectDefinitionKey: string;
    path: string;
    data: any[];
}

export type ExplorerNodeType =
    ExplorerNodeTypes.Directory | ExplorerNodeTypes.Association | ExplorerNodeTypes.Resource | ExplorerNodeTypes.Object;

export class ExplorerNode {
    // Immutable fields
    name: string;
    path: string;
    namespace: string;
    type: ExplorerNodeType;
    description?: string;
    depthLevel: number; // how many folders down from the root
    childNodes: ExplorerNodeProps[];
    resource: m.Resource;
    association: m.Association;
    objectContext: m.ObjectContext;
    objectDefinition: m.ParsedObjectDefinition;
    objectPath: string;
    relativePath: string;
    objectId: string;
    isRoot?: boolean;
    displayName: string;

    // is this node a part of an association group ([0..99], [100..199]). This flag is used for dynamic expansion.
    isAssociationGroupNode: boolean;

    // the data blob that will be used to expand the group.
    dataToGroupInto: any[];

    // the index number for the group.
    groupIndexNumber: number;

    // is this the root or a node that will contain a resource tree. This flag is used for dynamic expansion.
    isObjectNode: boolean;

    isResourceGroupDirectoryNode: boolean;

    contextMenuCreated: boolean;

    // observables
    @observable childrenVisible: boolean;
    @observable childrenComputingInProgress: boolean;
    @observable isInEdit: boolean;

    @action toggleChildrenVisible() {
        this.childrenVisible = !this.childrenVisible;
    }

    @action toggleChildrenComputingInProgress() {
        this.childrenComputingInProgress = !this.childrenComputingInProgress;
    }

    @action setChildrenComputingInProgress(value: boolean) {
        this.childrenComputingInProgress = value;
    }

    @action setChildrenObservables(visible: boolean, inProgress: boolean) {
        this.childrenVisible = visible;
        this.childrenComputingInProgress = inProgress;
    }

    @action setInEdit(isInEdit: boolean) {
        this.isInEdit = isInEdit;
    }
}

export class ExplorerNodeProps {
    node: ExplorerNode;
}

export class ExplorerTree {
    @observable root: ExplorerNodeProps;

    constructor(root: ExplorerNodeProps) {
        this.root = root;
    }

    @action setRoot(root: ExplorerNodeProps) {
        this.root = root;
    }
}

export class ExplorerState {
    @observable trees: ExplorerTree[];
    @observable showInlineSearch: boolean;
    associationLimit: number;
    associationGroupLimit: number;
    cloudType: string;
    dateTimeWidget: DateTimeWidgetProps;

    constructor(dateTimeWidget: DateTimeWidgetProps, startTime: Date, endTime: Date) {
        this.associationLimit = 10000;
        this.associationGroupLimit = 100;
        this.cloudType = "Public";
        this.trees = [];
        this.dateTimeWidget = dateTimeWidget;
    }

    @action addObjectTree(objectRoot: ExplorerNodeProps, position: number = -1) {
        let treeAlreadyPresent = this.trees.some(tree => {
            if (tree.root.node.path === objectRoot.node.path) {
                tree.setRoot(objectRoot);
                return true;
            }
            return false;
        })

        if (treeAlreadyPresent) {
            return;
        }

        let newTree = new ExplorerTree(objectRoot);

        if (position < 0) {
            this.trees.push(newTree);
        } else {
            this.trees.splice(position, 0, newTree);
        }
    }

    @action removeAll(): Promise<any> {
        let promises = [];

        this.trees.slice().forEach((tree) => {
            promises.push(this.removeObjectTree(tree.root.node.path));
        })

        return Promise.all(promises);
    }

    @action removeObjectTree(nodePath: string): Promise<any> {
        let index = this.trees.findIndex(tree => tree.root.node.path === nodePath);
        if (index > -1) {
            this.trees.splice(index, 1);
        }

        return ResourceSuggestionDB.instance().removeSuggestionsByPath(nodePath);
    }

    @action setInlineSearchVisible(isVisible: boolean) {
        this.showInlineSearch = isVisible;
    }
}

export class ExplorerProps {
    inner: ExplorerState;

    constructor(explorerState: ExplorerState) {
        this.inner = explorerState;
    }
}

export class EditState {
    @observable modifiedFileSrc: Array<GitFile>;
    @observable unprotectedFileSrc: Array<GitFile>;
    @observable pullRequests: Array<VstsResponse>;
    @observable lastCommitDateTime: string;
    @observable isGetPendingPullRequestInProgress: boolean;
    constructor() {
        this.modifiedFileSrc = [];
        this.pullRequests = [];
        this.unprotectedFileSrc = [];
        this.isGetPendingPullRequestInProgress = false;
    }

    @action setGetPendingPullRequestInProgress(inProgress: boolean) {
        this.isGetPendingPullRequestInProgress = inProgress;
    }

    @action setModifiedFileSrc(files: Array<GitFile>) {
        this.modifiedFileSrc = files;
    }

    @action refreshChangeList() {
        Repo.instance().gitFileStatus().then((files) => {
            this.setModifiedFileSrc(files);
            const navBarState = StateManager.getStore().navBar.inner;
            navBarState.setEditBadgeCount(files.length);
        }).catch((e) => {
            log.error(e.toString());
        });
    }

    @action refreshPendingPullRequest() {
        this.setGetPendingPullRequestInProgress(true);
        Repo.instance().getPendingPullRequest().then((res) => {
            this.setPullRequests(res.value);
        }).catch((e) => {
            log.info(e.error.message);
        }).finally(() => {
            this.setGetPendingPullRequestInProgress(false);
        });
    }

    @action setLastCommitDate(lastCommitDateTime: string) {
        this.lastCommitDateTime = lastCommitDateTime;
    }

    @action setPullRequests(pullRequests: Array<VstsResponse>) {
        this.pullRequests = pullRequests;
    }
}

export class EditProps {
    inner: EditState;

    constructor(editState: EditState) {
        this.inner = editState;
    }
}

export class ExtensionPageState {
    @observable extensions: Array<any>;

    @action setExtensions(extensions: Array<any>) {
        this.extensions = extensions;
    }
}

export class ExtensionPageProps {
    inner: ExtensionPageState;
    constructor(extensionState: ExtensionPageState) {
        this.inner = extensionState;
    }
}

export class NavBarState {
    @observable editBadgeCount: number;

    static width = 50;

    constructor() {
    }

    @action setEditBadgeCount(count) {
        this.editBadgeCount = count;
    }
}

export class NavBarProps {
    inner: NavBarState

    constructor(navBarstate: NavBarState) {
        this.inner = navBarstate;
    }
}

export class ToastState {
    @observable open?: boolean;
    notification: any;
    message: string;
    level: string;
    autoHideDuration: number;
    action: Object;
    position: string;

    constructor() {
        this.autoHideDuration = 5;
        this.message = "";
        this.open = false;
        this.level = "info";
    }

    setNotificationRef(notification) {
        this.notification = notification;
    }

    @action showToast(
        message: string,
        level: "success" | "error" | "warning" | "info",
        position: "tr" | "tl" | "tc" | "br" | "bl" | "bc" = "bc",
        action = null,
        autoHideDuration = 5) {
        if (this.notification) {
            this.message = message;
            this.level = level;
            this.position = position;
            this.action = action;
            this.autoHideDuration = autoHideDuration;
            this.open = true;
        }
    }

    @action hideToast() {
        this.open = false;
    }
}

export class ToastProps {
    inner: ToastState

    constructor(toastState: ToastState) {
        this.inner = toastState;
    }
}

export class SearchState {
    namespace: string;
    path: string;
    key: string;
    namespaceDataSrc: Array<string>;
    searchResult: Array<SearchResult>;
    searchResultLimit: number;
    searchResultCount: number;
    dateTimeWidget: DateTimeWidgetProps;
    objectDefinition: m.ObjectDefinition;
    @observable inProgress: boolean;
    @observable searchResultVisible: boolean;
    @observable pathDataSrc: Array<string>;
    search: any;

    constructor(dateTimeWidgetProps: DateTimeWidgetProps) {
        this.namespaceDataSrc = [];
        this.pathDataSrc = [];
        this.searchResultLimit = 50;
        this.dateTimeWidget = dateTimeWidgetProps;
        this.searchResultVisible = false;
        this.inProgress = false;
        this.key = "";
    }

    setSearchResult(searchResult, searchCount) {
        this.searchResult = searchResult;
        this.searchResultCount = searchCount;
    }

    clearSearchResult() {
        this.searchResult = null;
    }

    addNameSpaceToSrc(namespace: string) {
        this.namespaceDataSrc.push(namespace);
    }

    clearNameSpaceSrc() {
        this.namespaceDataSrc = [];
    }

    setNameSpace(namespace: string) {
        this.namespace = namespace;
    }

    setPath(path: string) {
        this.path = path;
    }

    setKey(key: string) {
        this.key = key;
    }

    setRef(search) {
        this.search = search;
    }

    @action handleSearchForObject(key: string) {
        if (this.search.keyRef) {
            this.setKey(key);
            this.search.keyRef.input.value = key;
        }

        if (this.search.pathRef) {
            this.setPath("");
            this.search.pathRef.setState({
                searchText: ""
            });
        }

        StateManager.getStore().sideBar.inner.setActivePage(PageName.SEARCH);
        this.search.handleSearchClick();
    }

    @action setPathDataSrc(pathDataSrc: Array<string>) {
        this.pathDataSrc = pathDataSrc;
    }

    @action setInProgress(newState: boolean) {
        this.inProgress = newState;
        if (this.inProgress) {
            this.searchResultVisible = false;
        }
    }

    @action renderSearchResult() {
        this.searchResultVisible = true;
        this.inProgress = false;
    }
}

export class SearchProps {

    inner: SearchState

    constructor(searchState: SearchState) {
        this.inner = searchState;
    }
}

export class DateTimeWidgetProps {
    inner: DateTimeWidgetState;
    style?: Object;

    constructor(dateTimeWidgetState: DateTimeWidgetState) {
        this.inner = dateTimeWidgetState;
    }
}

interface AbsoluteTime {
    startTime: Date;
    endTime: Date;
}

export class DateTimeWidgetState {
    @observable startTime?: Date;
    @observable endTime?: Date;
    @observable isStartTimeValid: boolean;
    @observable isEndTimeValid: boolean;
    @observable isRelativeMode: boolean;
    @observable buttonIndex: number;
    @observable timeAgoText: string;
    @observable isTimeAgoValid: boolean;
    timeButtonMap: Object;

    constructor(startTime: Date, endTime: Date) {
        this.startTime = startTime;
        this.endTime = endTime;
        this.isStartTimeValid = true;
        this.isEndTimeValid = true;
        this.isTimeAgoValid = true;
        this.isRelativeMode = true;
        this.timeAgoText = "1h";
        this.buttonIndex = 0;
        this.timeButtonMap = {
            "1h": {
                index: 0,
                minutes: 60
            },
            "6h": {
                index: 1,
                minutes: 360
            },
            "12h": {
                index: 2,
                minutes: 720
            },
            "1d": {
                index: 3,
                minutes: 1440
            },
            "7d": {
                index: 4,
                minutes: 10080
            },
            "30d": {
                index: 5,
                minutes: 43200
            }
        }
    }

    @action setTimeRangeByMin(minutes: number) {
        const MS_PER_MINUTE = 60000;
        let timeRange = minutes * MS_PER_MINUTE;
        let endTime = new Date();
        this.setTimeRange(new Date(endTime.getTime() - timeRange), endTime);
    }


    @action setTimeRange(startTime: Date, endTime: Date) {
        this.startTime = startTime;
        this.endTime = endTime;
        this.isStartTimeValid = true;
        this.isEndTimeValid = true;
    }

    @action setStartTime(startTime: Date) {
        this.startTime = startTime;
        this.isStartTimeValid = true;
    }

    @action setEndTime(endTime: Date) {
        this.endTime = endTime;
        this.isEndTimeValid = true;
    }

    @action setStartTimeValid(isValid: boolean) {
        this.isStartTimeValid = isValid;
    }

    @action setEndTimeValid(isValid: boolean) {
        this.isEndTimeValid = isValid;
    }

    @action setRelativeMode(isRelativeMode: boolean) {
        this.isRelativeMode = isRelativeMode;
    }

    @action setRelativeTime(timeAgoText: string, isTimeAgoValid = true, buttonIndex = -1) {
        if (this.timeButtonMap[timeAgoText] !== undefined) {
            this.buttonIndex = this.timeButtonMap[timeAgoText].index;
        } else {
            this.buttonIndex = buttonIndex;
        }

        this.timeAgoText = timeAgoText;
        this.isTimeAgoValid = isTimeAgoValid;
    }

    @action syncTime() {
        if (this.isRelativeMode && this.timeButtonMap[this.timeAgoText] !== undefined) {
            this.setTimeRangeByMin(this.timeButtonMap[this.timeAgoText].minutes);
        }
    }

    // Call this method for public access to startTime and endTime.
    // This will sync the time between absolute time and relative time if the widget is in relative mode.
    @action getAbsoluteTimeSynchronized(): AbsoluteTime {
        this.syncTime();
        return {
            startTime: this.startTime,
            endTime: this.endTime
        }
    }
}

export type ContentRefreshProvider = () => void;

export interface TabManagerContext {
    incarnation: string;
    webviewContext: any;
}

export class SideBarState {
    @observable isVisible?: boolean;
    @observable width: number;
    defaultWidth: number;
    height: number;
    explorer: ExplorerProps;
    search: SearchProps;
    edit: EditProps;
    extension: ExtensionPageProps;
    @observable transform: string;
    @observable activePage: PageName;
    @observable activeExtensionPage: ExtensionState;

    constructor(explorerProps: ExplorerProps, searchProps: SearchProps, editProps: EditProps, extensionProps: ExtensionPageProps) {
        this.isVisible = true;
        this.defaultWidth = 400;
        this.width = 400;
        this.height = 0;
        this.explorer = explorerProps;
        this.search = searchProps;
        this.edit = editProps;
        this.extension = extensionProps;
        this.transform = "translate(0px, 0px)";
        this.activePage = PageName.EXPLORER;
    }

    @action toggle() {
        this.isVisible = !this.isVisible;
        this.transform = this.isVisible ? "translate(0px, 0px)" : "translate(" + -StateManager.getStore().sideBar.inner.width + "px, 0px)";
    }

    @action open() {
        this.isVisible = true;
        this.transform = "translate(0px, 0px)";
    }

    @action close() {
        this.isVisible = false;
        this.transform = "translate(" + -StateManager.getStore().sideBar.inner.width + "px, 0px)";
    }

    @action resize(width: number) {
        this.width = width;
    }

    @action setActivePage(pageName: PageName) {
        this.activePage = pageName;
        this.activeExtensionPage = null;
    }

    @action setActiveExtensionPage(extensionState: ExtensionState) {
        this.activeExtensionPage = extensionState;
        this.activePage = null;
    }

    @computed get computedWidth(): any {
        if (this.isVisible) {
            return this.width;
        }

        return NavBarState.width;
    }
}

export class SideBarProps {
    inner: SideBarState

    constructor(sideBarState: SideBarState) {
        this.inner = sideBarState
    }
}

export class TabManagerState {
    @observable selectedTabKey: string;
    @observable selectedWebview: any;
    @observable selectedAddressbar: any;
    selectedNativeWindowReference: string;
    tabs: any;
    tabManager: any;

    constructor() {
        this.selectedTabKey = "";
        this.tabs = {};
    }

    @action setRef(tabManager) {
        this.tabManager = tabManager;
    }

    @action setWebview(webview: any, tabKey: string) {
        this.tabs[tabKey].webview = webview;

        if (this.selectedTabKey === tabKey) {
            this.selectedWebview = webview;
        }
    }

    @action setAddressbar(addressbar: any, tabKey: string) {
        if (addressbar) {
            this.tabs[tabKey].addressbar = addressbar;

            if (this.selectedTabKey === tabKey) {
                this.selectedAddressbar = addressbar;
            }
        }
    }

    @action setActiveTab(selectedTabKey) {
        if (this.tabs[selectedTabKey]) {
            this.selectedWebview = null;
            this.selectedWebview = this.tabs[selectedTabKey].webview;
            this.selectedAddressbar = this.tabs[selectedTabKey].addressbar;

            if (this.selectedWebview) {
                this.selectedWebview.focus();
            }

            this.selectedTabKey = selectedTabKey;

            let newNativeWindow = this.tabs[selectedTabKey].nativeWindowReference;
            if (newNativeWindow != this.selectedNativeWindowReference) {
                if (this.selectedNativeWindowReference) {
                    Win32Edge.instance().ShowWindowClr(
                        {
                            reference: this.selectedNativeWindowReference,
                            show: false
                        });
                }
            }

            if (newNativeWindow) {
                Win32Edge.instance().ShowWindowClr(
                    {
                        reference: newNativeWindow,
                        show: true
                    });
            }

            if (newNativeWindow) {
                let handler = this.tabs[selectedTabKey].request.eventHandlers["show"];
                if (handler) {
                    handler(new Event("show"));
                }
            }

            this.selectedNativeWindowReference = newNativeWindow;
        }
    }

    @action closeTab(selectedTabKey) {
        let tabToClose = this.tabs[selectedTabKey] as TabState;
        if (this.tabs[selectedTabKey] && this.tabs[selectedTabKey].pendingPromise) {
            this.tabs[selectedTabKey].pendingPromise.cancel();
        }

        if (tabToClose && tabToClose.nativeWindowReference) {
            let handler = tabToClose.request.eventHandlers["close"];
            if (handler) {
                handler(new Event("close"));
            }
        }

        delete this.tabs[selectedTabKey];

        // If all the tabs closed. Reset the selected tab key.
        if (Object.keys(this.tabs).length === 0) {
            this.selectedTabKey = "";

            if (tabToClose && tabToClose.nativeWindowReference) {
                Win32Edge.instance().ShowWindowClr(
                    {
                        reference: this.selectedNativeWindowReference,
                        show: false
                    });
            }
        }
    }

    @action openTab(tabRequest: TabRequest): string {
        let newTabKey;
        let newTab: TabState = new TabState;
        let tabRequestNodeIntegration = url.parse(tabRequest.url).protocol === "file:";
        let currentTab = this.tabs[this.selectedTabKey] as TabState;
        let openInNew = tabRequest.openInNew || Object.keys(this.tabs).length == 0 || !!(tabRequest.win32AppRequest) || (currentTab && tabRequest.win32AppRequest != currentTab.request.win32AppRequest) || (!tabRequest.key && currentTab && (currentTab.url.startsWith(Constants.terminalUrl) || currentTab.url.includes("terminal.html")));
        // If tab does not exist or selected tab needs to be updated, we need to set active tab.
        let setActiveTab = tabRequest.isForegroundTab || Object.keys(this.tabs).length == 0
            || (!openInNew && (!this.tabs[tabRequest.key] || this.selectedTabKey == tabRequest.key));

        //let waitPromise = Promise.resolve();
        if (openInNew) {
            newTabKey = tabRequest.tabKey ? tabRequest.tabKey : uuidV4();
            let nativeWindowReference = "";
            if (tabRequest.win32AppRequest) {
                let handle = remote.getGlobal("mainWindowHandle") as Buffer;
                Win32Edge.instance().LaunchProcessAndAttachAsChildWindowClr({
                    path: tabRequest.win32AppRequest.path,
                    arguments: tabRequest.win32AppRequest.arguments,
                    reference: tabRequest.win32AppRequest.appReference,
                    mainWindowHandle: handle
                }, (e, r) => {
                    if (e) { alert(JSON.stringify(e)); }
                    let tab = this.tabs[newTabKey];
                    if (tab) {
                        tab.nativeWindowLatched = true;
                        if (tab.webview) {
                            this.tabManager.resizeWin32Tab(tab);
                        }
                    }
                });

                nativeWindowReference = tabRequest.win32AppRequest.appReference;
            }


            newTab = {
                url: tabRequest.url,
                key: newTabKey,
                title: tabRequest.title,
                icon: tabRequest.icon,
                context: tabRequest.context,
                openInNew: openInNew,
                tooltip: tabRequest.tooltip,
                pendingPromise: tabRequest.pendingPromise,
                nodeIntegration: tabRequestNodeIntegration,
                refreshProvider: tabRequest.refreshProvider,
                resourceState: tabRequest.resourceState,
                isForegroundTab: tabRequest.isForegroundTab,
                preload: tabRequest.preload,
                nativeWindowReference: nativeWindowReference,
                request: tabRequest
            }

            // This will only create a tab.
            this.tabManager.createTab(newTab);
            this.tabs[newTab.key] = newTab;

            // This will create the content element for the tab, and set webview.
            newTab.element = this.tabManager.createTabContent(newTab);
        } else {

            if (!this.tabs[tabRequest.key]) {
                // If tab does not exists. This is the case to open in the selectedTab.
                newTab = this.tabs[this.selectedTabKey];
                newTabKey = this.selectedTabKey;
            } else {
                newTab = this.tabs[tabRequest.key];
                newTabKey = tabRequest.key;
            }

            if (newTab.pendingPromise) {
                (newTab.pendingPromise as any).cancel();
            }

            let reloadURL = newTab.webview && newTab.webview.getURL() != tabRequest.url;

            let deliverContext = newTab.context
                && newTab.context.incarnation
                && tabRequest.context
                && tabRequest.context.incarnation
                && newTab.context.incarnation != tabRequest.context.incarnation;

            let originalResourceState = newTab.resourceState;
            newTab.url = tabRequest.url;
            newTab.key = newTabKey;
            newTab.title = tabRequest.title;
            newTab.icon = tabRequest.icon;
            newTab.tooltip = tabRequest.tooltip;
            newTab.context = tabRequest.context;
            newTab.pendingPromise = tabRequest.pendingPromise;
            newTab.refreshProvider = tabRequest.refreshProvider;
            newTab.resourceState = tabRequest.resourceState;
            newTab.isForegroundTab = tabRequest.isForegroundTab;

            if (tabRequestNodeIntegration !== newTab.nodeIntegration) {
                // If node integration changed, we need recreate the webview.
                newTab.nodeIntegration = tabRequestNodeIntegration;
                newTab.element = this.tabManager.createTabContent(newTab);
            } else if (originalResourceState !== tabRequest.resourceState) {
                newTab.element = this.tabManager.createTabContent(newTab);
            } else {
                if (reloadURL && newTab.webview) {
                    newTab.webview.loadURL(newTab.url);
                }

                if (deliverContext && newTab.webview && newTab.webview.view && newTab.webview.view.getWebContents) {
                    newTab.webview.view.getWebContents().send("context-received", newTab.context.webviewContext);
                }
            }

            this.tabManager.updateTab(newTab);
        }

        if (setActiveTab) {

            // TODO we should call the setActiveTab here.

            if (this.selectedTabKey == newTabKey) {
                this.selectedTabKey = "";
                this.selectedWebview = null;
            }

            this.selectedTabKey = newTabKey;
            let selectedTab = this.tabs[newTabKey];
            this.selectedWebview = selectedTab.webview;

            let newNativeWindow = this.tabs[newTabKey].nativeWindowReference;
            if (newNativeWindow != this.selectedNativeWindowReference) {
                if (this.selectedNativeWindowReference) {
                    Win32Edge.instance().ShowWindowClr(
                        {
                            reference: this.selectedNativeWindowReference,
                            show: false
                        });
                }
            }

            if (newNativeWindow) {
                Win32Edge.instance().ShowWindowClr(
                    {
                        reference: newNativeWindow,
                        show: true
                    });
            }

            if (newNativeWindow && selectedTab.Request) {
                let handler = selectedTab.request.eventHandlers["show"];
                if (handler) {
                    handler(new Event("show"));
                }
            }

            this.selectedNativeWindowReference = newNativeWindow;
        }

        return newTabKey;
    }

    @action updateTabState(tabKey: string,
        properties?: {
            [key: string]: string | number;
        },
        didStopLoading = false) {
        if (!this.tabs[tabKey]) {
            return null;
        }

        this.tabs[tabKey] = Object.assign({}, this.tabs[tabKey], properties);

        return this.tabs[tabKey];
    }
}

export class TabManagerProps {
    inner: TabManagerState

    constructor(tabManagerState: TabManagerState) {
        this.inner = tabManagerState;
    }
}

export class OrbState {
    sideBar: SideBarProps;
    navBar: NavBarProps;
    toast: ToastProps;
    tabManager: TabManagerProps;

    constructor(
        sideBar: SideBarProps, navBar: NavBarProps, toast: ToastProps, tabManager: TabManagerProps) {
        this.sideBar = sideBar;
        this.navBar = navBar;
        this.toast = toast;
        this.tabManager = tabManager;
    }
}

export interface FileFormatState {
    instance: string;
    searchNamespace?: string
    explorerTrees: PersistedTree[];
    explorerTime: PersistedTime;
    openTabs: PersistedOpenedResource[];
}

/* Create a separate state model that gets persisted and rehydrated.
* serializr https://github.com/mobxjs/serializr was explored as an option here
* but it had issues with deep nested observable objects that did not all need to be persisted.
* The separate state for persistence is a bit inconvenient, but it's easier to test and reason about.
* This class cannot have any breaking changes, since older clients can have an older version of persistedstate.
*/
export class PersistedState implements FileFormatState {
    instance: string;
    sideBarWidth: number;
    searchNamespace?: string;
    explorerTrees: PersistedTree[];
    explorerTime: PersistedTime;
    openTabs: PersistedOpenedResource[];
}

export class PersistedTime {
    type: "absolute" | "relative";
    ago: string;
    startTime: string;
    endTime: string;
}

export class PersistedOpenedResource {
    type: "explorerResource" | "localTerminal" | "link";
}

class ExplorerOpenedResource extends PersistedOpenedResource {
    objectId: string;
    relativePath: string;
}

class LocalTerminalOpenedResource extends PersistedOpenedResource {
    relativePath: string;
}

class PersistedTree {
    objectId: string;
    namespace: string;
    objectPath: string;
    requiredProps: any;
    requiredBaseProps: any;
}

export class StateManager {

    private static store: OrbState;
    private static tabManagerReadyPromise: Promise<void>;
    private static tabManagerReadyPromiseResolver: () => void;
    private static toastReadyPromise: Promise<void>;
    private static toastReadyPromiseResolver: () => void;

    private static createInitialState(): OrbState {
        useStrict(true);
        ipcRenderer.on("state-manager-persistStateOnClose", () => {
            StateManager.saveStateToLocalStorage();
            ResourceSuggestionDB.instance().destroy();
            ipcRenderer.send("state-manager-persistStateOnCloseCompleted");
        });

        ipcRenderer.on("state-manager-persistStateOnReload", () => {
            StateManager.saveStateToLocalStorage();
            ipcRenderer.send("state-manager-persistStateOnReloadCompleted");
        });

        ipcRenderer.on("state-manager-set-state", (event, fileData) => {
            let parsedData = JSON.parse(fileData);
            StateManager.clearStoreForSetState();
            StateManager.applyFileFormatStateToStore(parsedData);
        });

        ipcRenderer.on("state-manager-append-state", (event, fileData) => {
            let parsedData = JSON.parse(fileData);
            StateManager.applyFileFormatStateToStore(parsedData);
        });

        ipcRenderer.on("state-manager-append-state-from-link", (event, linkData) => {
            LinkManager.applyLinkFormatStateToStore(linkData);
        })

        ipcRenderer.on("state-manager-save-state", (event, filePath) => {
            StateManager.saveStateToFile(filePath);
        });

        ipcRenderer.on("state-manager-copy-link", (event) => {
            LinkManager.saveStateToLink();
        });

        let now = new Date();
        let endTime = new Date(now as any);
        let startTime = new Date(now.setHours(now.getHours() - 2));
        let explorerDateTimeWidgetProps = new DateTimeWidgetProps(new DateTimeWidgetState(startTime, endTime));
        let explorerProps = new ExplorerProps(new ExplorerState(explorerDateTimeWidgetProps, startTime, endTime));
        let searchDateTimeWidgetProps = new DateTimeWidgetProps(new DateTimeWidgetState(startTime, endTime));
        let searchProps = new SearchProps(new SearchState(searchDateTimeWidgetProps));
        let editProps = new EditProps(new EditState());
        let extensionProps = new ExtensionPageProps(new ExtensionPageState());
        let sideBarProps = new SideBarProps(new SideBarState(explorerProps, searchProps, editProps, extensionProps));
        let navBarProps = new NavBarProps(new NavBarState());
        let toastProps = new ToastProps(new ToastState());
        let tabManagerProps = new TabManagerProps(new TabManagerState());
        this.tabManagerReadyPromise = new Promise<void>(function () {
            StateManager.tabManagerReadyPromiseResolver = arguments[0];
        });

        this.toastReadyPromise = new Promise<void>(function () {
            StateManager.toastReadyPromiseResolver = arguments[0];
        })

        return new OrbState(sideBarProps, navBarProps, toastProps, tabManagerProps);
    }

    static signalTabManagerReady() {
        this.tabManagerReadyPromiseResolver();
    }

    static signalToastReady() {
        this.toastReadyPromiseResolver();
    }

    static openHelpPageTab() {
        let store = StateManager.getStore();
        let tab: TabRequest = {
            url: Constants.helpUrl,
            title: "Help",
            openInNew: true,
            icon: "./extensions/resourceProviders/img/help.png",
            isForegroundTab: true
        }

        store.tabManager.inner.openTab(tab);
    }

    static openPRPageTab() {
        let store = StateManager.getStore();
        let tab: TabRequest = {
            url: Constants.prHelperUrl,
            title: "Pull Request",
            openInNew: true,
            icon: "./extensions/resourceProviders/img/help.png",
            isForegroundTab: true
        }

        store.tabManager.inner.openTab(tab);
    }

    /* Persist state to localStorage. */
    private static saveStateToLocalStorage() {
        if (StateManager.store) {
            let ser = StateManager.serializeStore(false, true);
            console.log("Serializing State");
            console.log(ser);

            localStorage.setItem("OrbState", JSON.stringify(ser));
        }
    }

    @action private static clearStoreForSetState() {
        // Only clear the tree state for now.
        let sideBarState = StateManager.store.sideBar.inner;
        let explorerState = sideBarState.explorer.inner;
        explorerState.trees = [];
    }

    private static saveStateToFile(filePath: string) {
        console.log("saving state to", filePath);
        let s = StateManager.serializeStore(true, true);

        fs.writeFile(filePath, JSON.stringify(s, null, 4), 'utf8', (err) => {
            if (err) {
                log.error(err.toString())
            }
        });
    }

    /* Serialize state to PersistedState. */
    static serializeStore(saveResource: boolean, saveToFile: boolean = false): PersistedState {
        let s = new PersistedState();
        s.instance = "new"; // Use new as the default launch mode.
        let sideBarState = StateManager.store.sideBar.inner;
        let tabManagerState = StateManager.store.tabManager.inner;
        let searchNamespace = sideBarState.search.inner.namespace;
        if (searchNamespace) {
            s.searchNamespace = searchNamespace;
        }

        if (!saveResource) {
            s.sideBarWidth = sideBarState.width;
        }

        s.explorerTrees = [];

        for (let i = 0; i < sideBarState.explorer.inner.trees.length; i++) {

            let tree = sideBarState.explorer.inner.trees[i];

            let persistedTree = new PersistedTree();
            persistedTree.objectId = tree.root.node.objectId;
            persistedTree.namespace = tree.root.node.namespace;
            persistedTree.objectPath = tree.root.node.objectPath;
            persistedTree.requiredProps = tree.root.node.objectContext.requiredProps;
            persistedTree.requiredBaseProps = tree.root.node.objectContext.requiredBaseProps;

            s.explorerTrees.push(persistedTree);
        }

        s.openTabs = []
        // Loop through all tabs and create/append trees as required.
        if (saveResource) {
            Object.keys(tabManagerState.tabs).forEach(k => {
                let tab = tabManagerState.tabs[k] as TabState;

                if (tab && tab.resourceState) {
                    if (!saveToFile && !tab.resourceState.isUnprotected) {
                        return;
                    }

                    // Find if this tree was already persisted.
                    let matchingTree =
                        s.explorerTrees.find(tree => tree.objectId === tab.resourceState.objectId);

                    if (!matchingTree) {
                        // This might be a resource opened by an association. Since it's not possible to specify an association in the file format yet, add another tree for the associated object.
                        // Also, the user might delete the explorer tree but leave the tab open. In that case also, add the object back in the file.
                        matchingTree = new PersistedTree();
                        matchingTree.namespace = tab.resourceState.namespace;
                        matchingTree.objectPath = tab.resourceState.objectPath;
                        matchingTree.requiredProps = tab.resourceState.objectContext.requiredProps;
                        matchingTree.requiredBaseProps = tab.resourceState.objectContext.requiredBaseProps;
                        matchingTree.objectId = tab.resourceState.objectId;

                        s.explorerTrees.push(matchingTree);
                    }

                    let resourceToSave = new ExplorerOpenedResource();

                    resourceToSave.type = "explorerResource";
                    resourceToSave.objectId = matchingTree.objectId;
                    resourceToSave.relativePath = tab.resourceState.relativePath;
                    s.openTabs.push(resourceToSave);
                }
            })
        }

        let dateTimeWidgetState = sideBarState.explorer.inner.dateTimeWidget.inner;

        s.explorerTime = new PersistedTime();
        if (dateTimeWidgetState.isRelativeMode) {
            s.explorerTime.type = "relative";
            s.explorerTime.ago = dateTimeWidgetState.timeAgoText;
        } else {
            s.explorerTime.type = "absolute";
            s.explorerTime.startTime = dateTimeWidgetState.startTime.toISOString();
            s.explorerTime.endTime = dateTimeWidgetState.endTime.toISOString();
        }

        return s;
    }

    /* Restore state on startup. */
    @action private static rehydrateStoreInternal(s: PersistedState, applyFileFormat: boolean) {
        let sideBarState = StateManager.store.sideBar.inner;
        sideBarState.width = s.sideBarWidth;

        if (applyFileFormat) {
            StateManager.applyFileFormatStateToStore(s, true);
        }
    }

    static applyFileFormatStateToStore(s: FileFormatState, isProcessRehydration = false, fromLink = false) {
        console.log("Applying file format to state store.");

        let sideBarState = StateManager.store.sideBar.inner;

        let explorerState = sideBarState.explorer.inner;
        let generatedTrees: Map<ExplorerNodeProps> = {};
        let dateTimeWidgetState = explorerState.dateTimeWidget.inner;

        if (s.searchNamespace) {
            sideBarState.search.inner.namespace = s.searchNamespace;
        }

        if (s.explorerTime && ((s.explorerTime.startTime && s.explorerTime.endTime) || s.explorerTime.ago)) {
            if (s.explorerTime.type === "relative") {
                dateTimeWidgetState.setRelativeMode(true);
                dateTimeWidgetState.setRelativeTime(s.explorerTime.ago);
            } else {
                dateTimeWidgetState.setRelativeMode(false);
                let start = Util.tryParseDateTime(s.explorerTime.startTime);
                let end = Util.tryParseDateTime(s.explorerTime.endTime);
                if (start && end && (start < end)) {
                    dateTimeWidgetState.setTimeRange(start, end);
                }
            }
        }

        let promisesToWaitOn = [];
        if (s.explorerTrees) {
            for (let i = 0; i < s.explorerTrees.length; i++) {
                let tree = s.explorerTrees[i];
                let newPromise = TreeGenerator.generateTree(tree.namespace, tree.objectPath, tree.requiredProps, null, true, tree.requiredBaseProps);

                let promiseToWaitOn =
                    newPromise
                        .then((root) => {
                            generatedTrees[tree.objectId] = root;
                            // If the process is starting up, preseve the index numbers for the tree. If not, add to the end of the tree.
                            explorerState.addObjectTree(root, isProcessRehydration ? i : -1);
                            root.node.setChildrenObservables(false, false);

                        })
                        .catch(err => log.error(err));

                promisesToWaitOn.push(promiseToWaitOn);
            }
        }

        if (s.openTabs && s.openTabs.length > 0) {
            promisesToWaitOn.push(this.tabManagerReadyPromise); // can't open tabs till tab manager is ready.
            promisesToWaitOn.push(this.toastReadyPromise);
            Promise.all(promisesToWaitOn).then(() => {

                for (let j = 0; j < s.openTabs.length; j++) {
                    let resourceToOpen = s.openTabs[j];
                    if (resourceToOpen.type === "explorerResource") {
                        let explorerResource = resourceToOpen as ExplorerOpenedResource;

                        let matchingTree = generatedTrees[explorerResource.objectId];
                        if (matchingTree) {
                            let resourcePath = explorerResource.relativePath;
                            let resource = matchingTree.node.objectDefinition.resourceByRelativePathWithExtension[resourcePath];
                            if (!resource) {
                                resource = matchingTree.node.objectDefinition.resourceByRelativePath[resourcePath];
                            }
                            if (!resource) {
                                log.error("Could not find resource: {0} in the object definition. Make sure you have the latest model files by clicking on Refresh on the Edit page.".format(resourcePath))
                            } else {
                                let tooltip = matchingTree.node.path + "\\" + resource.relativePath + "." + resource.type;
                                let resourceProvider = ResourceProviderSelector.getResourceProvider(resource);
                                if (!fromLink || (resourceProvider.isUnprotected && resourceProvider.isUnprotected())) {
                                    ResourceProviderHelper.openResource(resource, matchingTree.node.objectContext, matchingTree.node.objectDefinition, fromLink ? "LinkRestore" : "FileRestore", null, tooltip, false, true);
                                }
                            }
                        }
                    } else if (resourceToOpen.type === "localTerminal") {
                        let terminalResource = resourceToOpen as LocalTerminalOpenedResource;
                        TerminalConfigManager.launchTerminal(terminalResource.relativePath);
                    }
                }
            }).catch(err => log.error(err));
        }

        if (!isProcessRehydration) {

            // Updating the state to remove potential override strings in state
            if (fromLink) {
                this.saveStateToLocalStorage();
            }
        }
    }

    public static rehydrateStore() {
        if (StateManager.store) {
            let fileData = remote.getGlobal("fileData");
            let linkData = remote.getGlobal("linkData");

            if (fileData) {
                StateManager.applyFileFormatStateToStore(JSON.parse(fileData));
            } else if (linkData) {
                LinkManager.applyLinkFormatStateToStore(linkData);
            }

            // Some state is rehydrated from browser cache regardless of the file.
            // Last explorer width and search namespace are examples.
            // These are note part of the file format but make for a better experience on rehydration.
            let filePath = remote.getGlobal('filePath');

            // No file path for this session - i.e no file specified or this was opened in 'Default' mode.
            // If the linkData exists, do not append state from browser cache.
            let shouldApplyFileFormatFromBrowserCache = !filePath && !linkData;

            // No file found. Rehydrate from the browser cache.
            let persistedJson = localStorage.getItem("OrbState");

            if (persistedJson) {
                try {
                    let persisted: PersistedState = JSON.parse(persistedJson);
                    if (persisted) {
                        console.log("Rehydrating State", persisted);
                        // Don't apply the browser cache version of the persisted file format if it's been applied from an actual file.
                        StateManager.rehydrateStoreInternal(persisted, shouldApplyFileFormatFromBrowserCache);
                    }
                } catch (e) {
                    console.log("Error rehydrating:", e);
                    localStorage.removeItem("OrbState");
                }
            }
        }
    }

    public static getStore(): OrbState {
        if (!StateManager.store) {
            StateManager.store = StateManager.createInitialState();

            StateManager.rehydrateStore();
        }
        return StateManager.store;
    }
}
