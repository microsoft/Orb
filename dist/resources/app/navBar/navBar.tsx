//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />

import * as React from "react";
import { NavBarProps, StateManager, PageName, Constants, TabRequest } from "../state/state";

import { grey50, grey400 } from "material-ui/styles/colors";
import { ModelReader } from "../modelReader/modelReader";
import { List, ListItem } from "material-ui/List";
import IconButton from "material-ui/IconButton";
import MenuItem from "material-ui/MenuItem";
import FontIcon from "material-ui/FontIcon";
import { observer } from "mobx-react";
import Paper from "material-ui/Paper";
import Menu from "material-ui/Menu";
import { Repo } from "../repo/repo";
import { Util } from "../util/util";
import { Win32Edge } from "../data/win32Edge";
import { TerminalConfigManager } from "../config/terminalConfig";
import { ExtensionState, ExtensionPoints } from "../extensions/commonInterfaces";
import Badge from "material-ui/Badge";
import { _ } from "mobx";
import * as path from "path";
import { remote } from "electron";
import { KustoConnectionProfile } from "Model";

const log = require('loglevel');


const style = {
    paper: {
        height: "100vh",
        backgroundColor: "rgb(64, 64, 64)",
        left: "0px",
        top: "0px",
        textAlign: "center",
        width: "50px",
        zIndex: 3,
        position: "fixed"
    } as React.CSSProperties,
    iconButton: {
        "left": "0px"
    },
    tooltipStyles: {
        top: "24px",
    },
    bottomButtonDiv: {
        position: "absolute",
        bottom: "14px"
    } as React.CSSProperties,
    badge: {
        right: 3,
        top: 28,
        display: "flex",
        flexFlow: "row wrap",
        position: "absolute",
        fontWeight: 300,
        fontSize: 11,
        width: 17,
        height: 17,
        borderRadius: "50%",
        backgroundColor: "#007acc",
        color: "#fff"
    } as React.CSSProperties
};

@observer
export class NavBar extends React.Component<NavBarProps, any> {

    constructor(props) {
        super(props);
        TerminalConfigManager.initialize();
        this.handlePageClick = this.handlePageClick.bind(this);
        this.handleHelpClick = this.handleHelpClick.bind(this);
        this.handleTerminalClick = this.handleTerminalClick.bind(this);
        this.handleTerminalContextMenuClick = this.handleTerminalContextMenuClick.bind(this);
        this.refreshEditPage = this.refreshEditPage.bind(this);
        this.renderMenu = this.renderMenu.bind(this);
        this.refreshEditPage();

    }

    refreshEditPage() {
        const editState = StateManager.getStore().sideBar.inner.edit.inner;
        editState.refreshChangeList();
        Repo.instance().gitLog().then((res) => {
            editState.setLastCommitDate(new Date(res.latest.date).toISOString());
        });
    }

    handlePageClick(pageName: PageName) {
        let sideBarState = StateManager.getStore().sideBar.inner;
        if (!sideBarState.isVisible && sideBarState.width < sideBarState.defaultWidth) {
            sideBarState.resize(sideBarState.defaultWidth);
        }

        if (sideBarState.activePage == pageName) {
            sideBarState.toggle();
        } else {
            sideBarState.setActivePage(pageName);
            sideBarState.open();
        }

        if (sideBarState.activePage === PageName.EDIT) {
            this.refreshEditPage();
            const editState = StateManager.getStore().sideBar.inner.edit.inner;
            editState.refreshPendingPullRequest();
        }
    }

    handleHelpClick() {
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

    handleTerminalClick() {
        TerminalConfigManager.launchDefaultTerminal();
    }

    handleTerminalContextMenuClick(event) {
        event.preventDefault();
        TerminalConfigManager.getTerminalMenu().popup({});
    }

    renderMenu(Icon, badgeCount?: number) {
        if (badgeCount > 0) {
            return (
                <Badge badgeContent={badgeCount > 10 ? 10 + "+" : badgeCount} secondary={true} style={{ padding: 0 }} badgeStyle={style.badge}>
                    {Icon}
                </Badge>)
        } else {
            return Icon;
        }
    }

    render() {
        return (
            <div>
                <Paper style={style.paper} rounded={false}>
                    <IconButton onClick={() => this.handlePageClick(PageName.EXPLORER)} title="Explorer" style={style.iconButton}><FontIcon color={grey400} hoverColor={grey50} className="fa fa-th-list"></FontIcon></IconButton>
                    <IconButton onClick={() => this.handlePageClick(PageName.SEARCH)} title="Search" style={style.iconButton}><FontIcon color={grey400} hoverColor={grey50} className="fa fa-search"></FontIcon></IconButton>
                    {this.renderMenu(<IconButton onClick={() => this.handlePageClick(PageName.EDIT)} title="Edit" style={style.iconButton}><FontIcon color={grey400} hoverColor={grey50} className="fa fa-pencil"></FontIcon></IconButton>, this.props.inner.editBadgeCount)}
                    <IconButton onClick={() => this.handleTerminalClick()} onContextMenu={this.handleTerminalContextMenuClick} title="Terminal" style={style.iconButton}><FontIcon color={grey400} hoverColor={grey50} className="fa fa-terminal"></FontIcon></IconButton>
                    <div style={style.bottomButtonDiv}>
                        <IconButton onClick={this.handleHelpClick} title="Help" style={style.iconButton}><FontIcon color={grey400} hoverColor={grey50} className="fa fa-question"></FontIcon></IconButton>
                    </div>
                </Paper>
            </div>
        )
    }
}