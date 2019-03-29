//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="./typings/index.d.ts" />

import * as React from "react";
import { Toast } from "./toast/toast";
import { observer } from "mobx-react";
import { OrbState } from "./state/state";
import { NavBar } from "./navBar/navBar";
import { SideBar } from "./sideBar/sideBar";
import { TabManager } from "./tabManager/tabManager";
import MuiThemeProvider from "material-ui/styles/MuiThemeProvider";
import { ResourceCollections } from "./db/db";

let log = require("loglevel");

interface AppProps {
    orbState: OrbState,
    theme
}

@observer
export class App extends React.Component<AppProps, any> {

    componentDidMount() {
        ResourceCollections.instance();
    }

    render() {
        return (
            <div>
                <MuiThemeProvider muiTheme={this.props.theme}>
                    <div>
                        <NavBar inner={this.props.orbState.navBar.inner} />
                        <SideBar inner={this.props.orbState.sideBar.inner} />
                        <Toast inner={this.props.orbState.toast.inner} />
                        <TabManager inner={this.props.orbState.tabManager.inner} />
                    </div>
                </MuiThemeProvider>
            </div>)
    }
}