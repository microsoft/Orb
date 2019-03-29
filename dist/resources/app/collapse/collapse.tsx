//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />

import * as React from "react";
import { observer } from "mobx-react";
import ListItem from "material-ui/List/ListItem";
import FontIcon from "material-ui/FontIcon";

interface Props {
    title: any;
    openByDefault: boolean;
    style?: Object;
    innerDivStyle?: Object;
    lazyLoad?: () => any
    onContextMenu?: () => any;
    renderRightIcon?: () => JSX.Element;
}

interface State {
    open?: boolean;
    lazyLoadElement?: any;
}

const style = {
    fontIcon: {
        fontSize: "14px",
        color: "rgb(218,216,216)",
        lineHeight: "16px",
        textAlign: "center",
        width: "16px",
        margin: "5px",
        top: "4px"
    },
    listItem: {
        innerDiv: {
            fontFamily: "Roboto, sans-serif",
            fontSize: "13.5px",
            paddingTop: "10px",
            paddingLeft: "28px",
            paddingBottom: "10px",
            backgroundColor: "rgb(64, 64, 64)"
        }
    }
}

export class Collapse extends React.PureComponent<Props, State> {
    constructor(props) {
        super(props);
        this.handleCollapseClick = this.handleCollapseClick.bind(this);
        this.loadLazyContent = this.loadLazyContent.bind(this);
        this.renderLeftIcon = this.renderLeftIcon.bind(this);
        this.renderContent = this.renderContent.bind(this);
        this.state = {
            open: this.props.openByDefault
        };
    }

    renderLeftIcon() {
        return this.state.open ? (
            <FontIcon
                className="fa fa-caret-down"
                style={style.fontIcon}
            />
        ) : (
                <FontIcon
                    className="fa fa-caret-right"
                    style={style.fontIcon}
                />
            )
    }

    loadLazyContent() {
        this.props.lazyLoad().then((element) => {
            this.setState({ lazyLoadElement: element });
        });
    }

    componentDidMount() {
        if (this.state.open && this.props.lazyLoad) {
            this.loadLazyContent();
        }
    }

    handleCollapseClick() {
        let open = !this.state.open;
        this.setState({ open: open });
        if (open && this.props.lazyLoad) {
            this.loadLazyContent();
        }
    }

    renderContent() {
        if (!this.state.open) {
            return null;
        }

        return (
            <div>
                {this.props.children}
                {this.state.lazyLoadElement}
            </div>)
    }

    render() {
        return (
            <div style={{ width: "100%" }}>
                <ListItem onContextMenu={this.props.onContextMenu} style={this.props.style} innerDivStyle={this.props.innerDivStyle ? this.props.innerDivStyle : style.listItem.innerDiv} onClick={() => this.handleCollapseClick()} primaryText={this.props.title} leftIcon={this.renderLeftIcon()} rightIcon={this.props.renderRightIcon ? this.props.renderRightIcon() : null} />
                {this.renderContent()}
            </div >
        )
    }
}