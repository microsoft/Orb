//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />

import * as React from "react";
import { observer } from "mobx-react";
import { shell, ipcRenderer, remote } from "electron";
import { TabManagerContext, StateManager, TabManagerProps, Constants, Map, TabState, TabRequest } from "../state/state";
import { SearchInPage } from "./searchInPage";
import { WebView } from "../webview/webview";
import { AddressBar } from "../addressBar/addressBar";
import { LinkSuggestionDB, ISuggestion } from "../db/db";
import { ModelReader } from "../modelReader/modelReader";
import { LinkManager } from "../linkManager/linkManager";
import { ResourceEditorCtrl } from "../resourceEditor/resourceEditorCtrl";
import { ResourceProviderHelper } from "../extensions/resourceProviders/helper";
import { TreeGenerator } from "../Explorer/treeGenerator";
import * as uuidV4 from "uuid/v4";
import { Util } from "../util/util";
import { Win32Edge } from "../data/win32Edge";

const url = require("url");
const log = require("loglevel")
declare let ChromeTabs: any;

@observer
export class TabManager extends React.Component<TabManagerProps, any> {
    chromeTabs: any;
    width: number;
    height: number;

    constructor(props) {
        super(props);
        this.updateTab = this.updateTab.bind(this);
        this.hideSearch = this.hideSearch.bind(this);
        this.generateKey = this.generateKey.bind(this);
        this.handleTabNew = this.handleTabNew.bind(this);
        this.reloadWebview = this.reloadWebview.bind(this);
        this.handleTabChange = this.handleTabChange.bind(this);
        this.handleTabRemove = this.handleTabRemove.bind(this);
        this.beforeTabRemove = this.beforeTabRemove.bind(this);
        this.renderTabContent = this.renderTabContent.bind(this);
        this.createTabContent = this.createTabContent.bind(this);
        this.renderAddressBar = this.renderAddressBar.bind(this);
        this.updateAddressBar = this.updateAddressBar.bind(this);
        this.handleBackButtonClick = this.handleBackButtonClick.bind(this);
        this.handleForwardButtonClick = this.handleForwardButtonClick.bind(this);
        this.updateNavigationButtons = this.updateNavigationButtons.bind(this);
        this.handleRefreshButtonClick = this.handleRefreshButtonClick.bind(this);
        this.handleURLClick = this.handleURLClick.bind(this);

        let lastActiveElement;
        document.onmouseup = (event) => {
            lastActiveElement = document.activeElement;
        }

        ipcRenderer.on('tab-manager-goback', () => {
            if (this.props.inner.selectedWebview) {
                this.props.inner.selectedWebview.goBack();
            }
        });

        ipcRenderer.on('tab-manager-goforward', () => {
            if (this.props.inner.selectedWebview) {
                this.props.inner.selectedWebview.goForward();
            }
        });

        ipcRenderer.on('tab-manager-reload', () => {
            if (this.props.inner.selectedTabKey) {
                let tab = this.props.inner.tabs[this.props.inner.selectedTabKey]

                if (tab) {
                    this.reloadWebview(tab);
                }
            }
        });

        ipcRenderer.on('tab-manager-closeCurrentTab', () => {
            if (this.props.inner.selectedTabKey) {
                let tabEl = this.chromeTabs.getTabByKey(this.props.inner.selectedTabKey);

                if (tabEl) {
                    this.chromeTabs.removeTab(tabEl);
                }
            }
        });

        ipcRenderer.on('terminal-title-changed-callback', (event, title, webContentId) => {
            Object.keys(this.props.inner.tabs).some((key) => {
                let tabState = this.props.inner.tabs[key];
                let webview = tabState.webview;
                if (webview) {
                    let webcontents = webview.getWebContents();
                    if (webcontents && webcontents.id == webContentId) {
                        tabState.title = title;
                        tabState.tooltip = title;
                        this.updateTab(tabState);
                        return true;
                    }
                }
            })
        });

        ipcRenderer.on("tab-manager-clear-history", () => {
            LinkSuggestionDB.instance().destroy().then((res) => {
                if (res.ok) {
                    StateManager.getStore().toast.inner.showToast("Browser history has been cleared", "info");
                }
            });
        });

        ipcRenderer.on("tab-manager-focus", () => {
            let selectedTab = this.props.inner.tabs[this.props.inner.selectedTabKey];
            if (selectedTab && selectedTab.nativeWindowReference) {
                this.resizeWin32Tab(selectedTab);
                return;
            }

            if (this.props.inner.selectedWebview && lastActiveElement && lastActiveElement.tagName.toLowerCase() === "webview") {
                if (document.activeElement.tagName.toLocaleLowerCase() !== "webview") {
                    this.props.inner.selectedWebview.focus();
                }

                let webcontents = this.props.inner.selectedWebview.getWebContents();
                if (webcontents) {
                    webcontents.focus();
                }
            }
        });

        ipcRenderer.on("tab-manager-mainWindow-close", () => {
            Win32Edge.instance().TerminateAllSessionsClr({});
        });

        ipcRenderer.on("tab-manager-openNewTab", () => {
            this.handleTabNew();
        });

        ipcRenderer.on("tab-manager-selectAll", () => {
            let selectedAddressbar = this.props.inner.selectedAddressbar;
            if (selectedAddressbar) {
                selectedAddressbar.selectAll();
            }
        });

        ipcRenderer.on("tab-manager-switchTab", () => {
            this.chromeTabs.moveToNextTab();
        });

        ipcRenderer.on("tab-manager-generate-resource", () => {
            ResourceEditorCtrl.openResourceEditor(false, false, null, () => {
                StateManager.getStore().sideBar.inner.edit.inner.refreshChangeList();
                TreeGenerator.reloadAllTrees();
            });
        })

        ipcRenderer.on("tab-manager-generate-resource-from-clipboard", () => {
            ResourceEditorCtrl.openResourceEditor(true, false, null, () => {
                StateManager.getStore().sideBar.inner.edit.inner.refreshChangeList();
                TreeGenerator.reloadAllTrees();
            });
        })
    }

    resizeWin32Tab(selectedTab: TabState) {
        let bounds = selectedTab.webview.c.getBoundingClientRect();

        if (bounds.width > 0 && bounds.height > 0) {
            let input = {
                reference: selectedTab.nativeWindowReference,
                x: bounds.left | 0, // convert to int
                y: bounds.top + 20 | 0, // TODO: Don't hardcode the margin but find a way to derive this.
                cx: bounds.width | 0,
                cy: bounds.height | 0
            };

            Win32Edge.instance().SetWindowPosClr(input);
        }
    }

    reloadWebview(tab: TabState) {
        this.hideSearch();
        if (tab.refreshProvider) {
            tab.refreshProvider();
        } else {
            if (tab && tab.webview) {
                tab.webview.reload();
            }
        }
    }

    generateKey() {
        return uuidV4();
    }

    hideSearch() {
        (this.refs["SearchInPage"] as any).hide();
    }

    createTabContent(tab: TabState) {
        let state = StateManager.getStore();
        let eventHandlerAttached = false;
        let contextMenuAttached = false;

        return (
            <div style={{ height: "100%" }}>
                <WebView
                    className={"contentManagerWebView"}
                    nodeintegration={tab.nodeIntegration ? tab.nodeIntegration : undefined}
                    style={{
                        width: "100%",
                        height: "100%"
                    }}
                    disableguestresize={true}
                    key={this.generateKey()} // Use a key to create a new webview if nodeIntegration changes. NodeIntegration cannot be switched dynamically.
                    src={tab.url}
                    minwidth={0}
                    minheight={0}
                    ref={
                        (innerWebView) => {
                            if (innerWebView && innerWebView.view) {
                                let webview = innerWebView.view;
                                if (!eventHandlerAttached) {

                                    webview.addEventListener("resize", () => {
                                        if (this.props.inner.selectedWebview === innerWebView) {
                                            let webContents = webview.getWebContents();
                                            if (webContents && innerWebView.c.clientWidth != 0 && innerWebView.c.clientHeight != 0) {
                                                this.width = innerWebView.c.clientWidth;
                                                this.height = innerWebView.c.clientHeight;
                                                webContents.setSize({
                                                    normal: {
                                                        width: innerWebView.c.clientWidth,
                                                        height: innerWebView.c.clientHeight
                                                    }
                                                });

                                                if (tab.nativeWindowReference) {
                                                    this.resizeWin32Tab(tab);
                                                }
                                            }
                                        }

                                    });

                                    let previousActiveElement = document.activeElement;
                                    webview.addEventListener('dom-ready', () => {
                                        // Only sets the webview when dom is ready.
                                        this.props.inner.setWebview(innerWebView, tab.key);

                                        if (tab.nativeWindowReference) {
                                            this.resizeWin32Tab(tab);
                                        }

                                        // Do not set focus if tab is inactive or focus changed between page click and dom-ready.
                                        if (this.props.inner.selectedTabKey === tab.key && previousActiveElement === document.activeElement) {
                                            webview.focus();
                                        }

                                        let webContents = webview.getWebContents();

                                        // Send any context that needs to be passed to the webview page.
                                        if (tab.context) {
                                            webContents.send("context-received", tab.context.webviewContext);
                                        }

                                        if (contextMenuAttached) {
                                            // All events must be attached only once to a given webview.
                                            return;
                                        }

                                        // Attach right-click handler.
                                        require('electron-context-menu')({
                                            window: webview,
                                            showInspectElement: false, // don't use the default implementation since it doesn't work with WebView
                                            append: (param, window) => {
                                                return [
                                                    {
                                                        label: "Back",
                                                        accelerator: "Alt + Left",
                                                        click: (item, window, event) => {
                                                            webview.goBack();
                                                        }
                                                    },
                                                    {
                                                        label: "Forward",
                                                        accelerator: "Alt + Right",
                                                        click: (item, window, event) => {
                                                            webview.goForward();
                                                        }
                                                    },
                                                    {
                                                        label: "Reload",
                                                        accelerator: "F5",
                                                        click: (item, window, event) => {
                                                            this.reloadWebview(this.props.inner.tabs[this.props.inner.selectedTabKey]);
                                                        }
                                                    },
                                                    {
                                                        label: "sep1",
                                                        type: "separator"
                                                    },
                                                    {
                                                        label: "Inspect Element",
                                                        click: (item, window, event) => {
                                                            webview.getWebContents().inspectElement(param.x, param.y);
                                                        }
                                                    },
                                                    {
                                                        label: "Search for Object",
                                                        click: (item, window, event) => {
                                                            StateManager.getStore().sideBar.inner.search.inner.handleSearchForObject(param.selectionText.toString());
                                                        }
                                                    }
                                                ]
                                            }
                                        });

                                        contextMenuAttached = true;
                                    });

                                    let favicon = tab.icon;
                                    let title = tab.title;
                                    webview.addEventListener("did-start-loading", () => {
                                        this.updateFavicon(tab.key, "./assets/ring.svg");
                                    });

                                    webview.addEventListener("did-stop-loading", (event) => {
                                        let url = webview.getURL();
                                        let newTab;

                                        if (url.startsWith("file://")) {
                                            newTab = this.props.inner.updateTabState(tab.key, { icon: tab.icon }, true);
                                            this.updateFavicon(newTab.key, newTab.icon);
                                        } else if (tab.resourceState) {
                                            // If it is a resource, don't update the title.
                                            newTab = this.props.inner.updateTabState(tab.key, { url: url, icon: tab.icon }, true);
                                            if (newTab) {
                                                this.updateFavicon(newTab.key, newTab.icon);
                                            }

                                        } else {
                                            newTab = this.props.inner.updateTabState(tab.key, { url: url, icon: favicon, title: title }, true);
                                            if (newTab) {
                                                this.updateTitle(newTab.key, newTab.title);
                                                this.updateFavicon(newTab.key, newTab.icon);
                                            }
                                        }

                                        if (newTab) {
                                            this.updateAddressBar(newTab, false);
                                        }

                                        if (this.props.inner.selectedTabKey == newTab.key) {
                                            this.updateNavigationButtons(webview);
                                        }
                                    });

                                    webview.addEventListener("will-navigate", (event) => {
                                        const newTab = this.props.inner.updateTabState(tab.key, { url: event.url });
                                        if (newTab) {
                                            this.updateAddressBar(newTab, false);
                                        }
                                    });

                                    webview.addEventListener("page-title-updated", (event) => {
                                        title = event.title ? event.title : title;

                                        // Don't change the title if it is a resource tab.
                                        if (!tab.resourceState) {
                                            const newTab = this.props.inner.updateTabState(tab.key, { title: title });
                                            if (newTab) {
                                                this.updateTitle(newTab.key, newTab.title);
                                            }
                                        }
                                    });

                                    webview.addEventListener("page-favicon-updated", (event) => {
                                        favicon = event.favicons[0] ? event.favicons[0] : favicon;
                                        if (!tab.resourceState) {
                                            const newTab = this.props.inner.updateTabState(tab.key, { icon: favicon });
                                            if (newTab) {
                                                this.updateFavicon(newTab.key, newTab.icon);
                                            }
                                        }
                                    });

                                    webview.addEventListener("will-navigate", (e) => {
                                        if (tab.pendingPromise) {
                                            let promiseToCancel = tab.pendingPromise as any;
                                            promiseToCancel.cancel();
                                        }

                                        tab.url = e.url;
                                        this.hideSearch();
                                    });

                                    webview.addEventListener("new-window", (e) => {
                                        if (e.disposition === "background-tab" || e.disposition === "foreground-tab") {
                                            let newTab = new TabRequest();
                                            let tabManager = StateManager.getStore().tabManager.inner;
                                            newTab.url = e.url;
                                            newTab.title = e.frameName ? e.FrameName : e.url;
                                            newTab.tooltip = e.frameName ? e.FrameName : e.url;
                                            newTab.openInNew = true;
                                            newTab.icon = "./extensions/resourceProviders/img/link.png"; // TODO: get favicon from url.
                                            newTab.isForegroundTab = e.disposition === "foreground-tab"
                                            tabManager.openTab(newTab);
                                        } else {
                                            let newWindow = new remote.BrowserWindow(e.options);
                                            newWindow.loadURL(e.url);
                                            newWindow.once("ready-to-show", () => {
                                                newWindow.show();
                                            });
                                        }

                                        e.preventDefault();
                                    });
                                }

                                eventHandlerAttached = true;
                            }
                        }
                    }
                />
            </div>
        );
    }

    createTab(tab: TabState) {
        this.chromeTabs.addTab({
            title: tab.title,
            key: tab.key,
            favicon: tab.icon || "",
            tooltip: tab.tooltip
        }, tab.isForegroundTab);
    }

    updateTab(tab: TabState) {
        this.chromeTabs.updateTab(this.chromeTabs.getTabByKey(tab.key), {
            title: tab.title,
            key: tab.key,
            favicon: tab.icon || "",
            tooltip: tab.tooltip
        })
    }

    updateAddressBar(tab: TabState, loadURL = true) {
        if (tab) {
            if (tab.addressbar && tab.addressbar.mounted) {
                tab.addressbar.setState({ value: tab.url.startsWith("file://") ? "about:help" : tab.url });
            }

            if (loadURL && tab.webview) {
                tab.webview.loadURL(tab.url);
            }
        }
    }

    updateFavicon(key, favicon) {
        this.chromeTabs.updateFavicon(this.chromeTabs.getTabByKey(key), {
            favicon: favicon || ""
        })
    }

    updateNavigationButtons(webview) {
        if (this.props.inner.selectedAddressbar && this.props.inner.selectedAddressbar.mounted) {
            this.props.inner.selectedAddressbar.setState({
                isBackButtonDisabled: !webview.canGoBack(),
                isForwardButtonDisabled: !webview.canGoForward(),
            });
        }
    }

    updateTitle(key, title) {
        this.chromeTabs.updateTitle(this.chromeTabs.getTabByKey(key), {
            title: title
        });
    }

    componentDidMount() {
        this.props.inner.setRef(this);
        this.chromeTabs = new ChromeTabs(this.beforeTabRemove);
        let el = this.refs["Tabs"] as HTMLElement;

        el.addEventListener('activeTabChange', (event: any) => {
            this.handleTabChange(event.detail.tabEl);
        });

        el.addEventListener('tabRemove', (event: any) => {
            this.handleTabRemove(event.detail.tabEl);
        });

        el.addEventListener("tabNew", (event: any) => {
            this.handleTabNew();
        });

        this.chromeTabs.init(el, {
            tabOverlapDistance: 14,
            minWidth: 45,
            maxWidth: 243
        });

        let fileData = remote.getGlobal('fileData');
        if (!fileData) {
            StateManager.openHelpPageTab();
        }

        StateManager.signalTabManagerReady();
    }

    handleTabChange(tabEl: HTMLElement) {
        this.hideSearch();
        let key = tabEl.getAttribute("key");
        let tab = this.props.inner.tabs[key];

        if (tab && tab.webview && tab.webview.view) {
            let webcontents = tab.webview.view.getWebContents();
            if (webcontents) {
                webcontents.setSize({
                    normal: {
                        width: this.width,
                        height: this.height
                    }
                })
            }
        }

        this.props.inner.setActiveTab(key);
    }

    handleTabRemove(tabEl: HTMLElement) {
        let key = tabEl.getAttribute("key");
        this.props.inner.closeTab(key);
    }

    beforeTabRemove(tabEl: HTMLElement): Promise<Boolean> {
        let key = tabEl.getAttribute("key");
        let tabToClose = this.props.inner.tabs[key] as TabState;
        return Promise.resolve(true);
    }

    handleTabNew() {
        let tabRequest: TabRequest = {
            url: "about:blank", // Todo: customize default page/search engine.
            title: "New Tab",
            openInNew: true,
            isForegroundTab: true,
        }

        this.props.inner.openTab(tabRequest);
        if (this.props.inner.selectedAddressbar) {
            this.props.inner.selectedAddressbar.selectAll();
        }
    }

    handleURLClick(suggestion: ISuggestion, ctrlPressed: boolean, enterPressed: boolean) {
        const url = this.props.inner.tabs[this.props.inner.selectedTabKey].url;
        let openInNew = (ctrlPressed && !enterPressed) ||
            this.props.inner.tabs[this.props.inner.selectedTabKey].url.startsWith("file://") || url === "about:help";

        if (suggestion.objectPath && suggestion.relativePathWithExtension) {
            ModelReader.getObjectDefinition(suggestion.namespace, suggestion.objectPath).then((objectDefinition) => {
                ResourceProviderHelper.openResource(
                    objectDefinition.resourceByRelativePathWithExtension[
                    suggestion.relativePathWithExtension
                    ],
                    suggestion.objectContext, objectDefinition, "AddressBar", null, suggestion.url, false, openInNew);
            });
        } else {
            let currentTabKey = this.props.inner.selectedTabKey;
            let currentTab = this.props.inner.tabs[currentTabKey];
            this.props.inner.openTab({
                url: suggestion.url,
                key: currentTabKey,
                title: currentTab.title,
                icon: currentTab.icon,
                openInNew: openInNew,
                isForegroundTab: true,
            });

            if (!suggestion.url.startsWith("file://")) {
                LinkSuggestionDB.instance().putSuggestionIfNotExists(suggestion);
            }
        }
    }

    handleBackButtonClick() {
        this.props.inner.selectedWebview.goBack();
    }

    handleForwardButtonClick() {
        this.props.inner.selectedWebview.goForward();
    }

    handleRefreshButtonClick(tab: TabState) {
        this.reloadWebview(tab);
    }

    isCurrentTabTerminal(): boolean {
        let currentTabKey = this.props.inner.selectedTabKey;
        if (!currentTabKey) {
            return false;
        }

        let currentTab = this.props.inner.tabs[currentTabKey];

        if (currentTab && currentTab.url && currentTab.url.startsWith("file://") || currentTab.url.indexOf("terminal.html") >= 0) {
            return true;
        }

        return false;
    }

    renderTabContent() {
        if (this.props.inner.selectedTabKey) {
            return Object.keys(this.props.inner.tabs).map((key, index) => {
                let tabState = (this.props.inner.tabs[key] as TabState);
                let addressBarElement = this.props.inner.selectedTabKey === key ? this.renderAddressBar(tabState) : null;
                let addressBarHeight = addressBarElement ? "31px" : "0px";

                let style = this.props.inner.selectedTabKey === key ? { height: "calc(100% - 42px)" } : { height: "0px", width: "0px" };

                return (
                    <div style={style} key={key}>
                        {addressBarElement}
                        <div
                            style={{ height: "calc(100% - " + addressBarHeight + ")" }}
                        >
                            {tabState.element}
                        </div>
                    </div>)
            })
        }
    }

    renderAddressBar(tab: TabState) {
        if (tab.url.startsWith("file://") && tab.title === "Help") {
            tab.url = "about:help";
        }

        if (tab.nativeWindowReference) {
            return;
        }

        if (!tab.url.startsWith("file://") || tab.url === "about:help" || !tab.nodeIntegration) {
            return (
                <AddressBar
                    ref={(addressbar) => {
                        this.props.inner.setAddressbar(addressbar, tab.key);
                    }}
                    isBackButtonDisabled={!tab.webview || !tab.webview.canGoBack()}
                    isForwardButtonDisabled={!tab.webview || !tab.webview.canGoForward()}
                    onBackButtonClick={this.handleBackButtonClick}
                    onForwardButtonClick={this.handleForwardButtonClick}
                    onRefreshButtonClick={() => this.handleRefreshButtonClick(tab)}
                    onURLClick={this.handleURLClick} tab={tab} />
            )
        }
    }

    render() {
        let state = StateManager.getStore();
        let isTerminal = this.isCurrentTabTerminal();

        return (
            <div
                style={
                    {
                        width: "calc(100% - " + state.sideBar.inner.computedWidth + "px)",
                        height: "100%",
                        position: "fixed",
                        display: "inline",
                        right: 0
                    }
                }>
                <SearchInPage ref={"SearchInPage"} webview={this.props.inner.selectedWebview} isDrivenExternally={isTerminal} />
                <div className={"chrome-tabs chrome-tabs-dark-theme"} ref={"Tabs"}>
                    <div className={"chrome-tabs-content"}>
                    </div>
                    <div className={"chrome-tabs-bottom-bar"}>
                    </div>
                </div>
                {this.renderTabContent()}
            </div>
        )
    }
}