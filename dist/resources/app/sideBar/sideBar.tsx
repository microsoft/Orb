//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />

import * as React from "react";
import { SideBarProps, StateManager, PageName, Constants } from "../state/state"
import Drawer from "material-ui/Drawer";
import { observer } from "mobx-react";
import { Explorer } from "../explorer/explorer";
import { Search } from "../search/search";
import { Edit } from "../edit/edit";
import { TreeGenerator } from "../explorer/treeGenerator";
let Resizable = require("react-resizable").Resizable;

const Section = ({ text }) => {
    return (
        <div style={{ width: "100%", backgroundColor: "rgb(48, 48, 48)", height: "30px", fontSize: "13.5px", paddingTop: "10px", paddingLeft: "10px", paddingBottom: "28px" }}>
            <span style={{ color: "rgb(189, 189, 189)" }}>{text} </span>
        </div>
    );
};

@observer
export class SideBar extends React.Component<SideBarProps, any> {

    constructor(props) {
        super(props);
        this.handleResize = this.handleResize.bind(this);
        this.renderExtension = this.renderExtension.bind(this);
    }

    handleResize(event, { element, size }) {
        if (this.props.inner.width < 200) {
            this.props.inner.close();
        }

        if (this.props.inner.isVisible) {
            this.props.inner.resize(size.width);
        }
    }

    renderExtension() {
        let extensionState = this.props.inner.activeExtensionPage;
        if (extensionState) {
            return (
                <div>
                    <Section text={extensionState.name} />
                </div>
            )
        }
    }

    render() {
        return (
            <Resizable className="box" height={this.props.inner.width} width={this.props.inner.width} onResize={this.handleResize}>
                <div style={{ width: this.props.inner.width }}>
                    <Drawer containerStyle={{ transform: this.props.inner.transform, maxHeight: "100%", maxWidth: "100%", overflowX: "hidden", overflowY: "scroll", height: "100vh", zIndex: 1, paddingLeft: "50px", width: this.props.inner.width }}
                        open={this.props.inner.isVisible}>

                        <div className={this.props.inner.activePage == PageName.SEARCH ? "" : "hidden"}>
                            <Section text={PageName[PageName.SEARCH]} />
                            <Search inner={this.props.inner.search.inner} />
                        </div>

                        <div className={this.props.inner.activePage == PageName.EXPLORER ? "" : "hidden"}>
                            <Section text={PageName[PageName.EXPLORER]} />
                            <Explorer inner={this.props.inner.explorer.inner} />
                        </div>

                        <div className={this.props.inner.activePage == PageName.EDIT ? "" : "hidden"}>
                            <Section text={PageName[PageName.EDIT]} />
                            <Edit inner={this.props.inner.edit.inner} />
                        </div>
                        {this.renderExtension()}
                    </Drawer>
                </div>
            </Resizable>
        )
    }
}