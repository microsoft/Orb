//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />

import * as React from "react";
import RaisedButton from 'material-ui/RaisedButton';
import { grey400 } from "material-ui/styles/colors";
import CircularProgress from "material-ui/CircularProgress";

interface SpinnerButtonState {
    inProgress
}

export class SpinnerButton extends React.Component<any, SpinnerButtonState> {
    constructor(props) {
        super(props);
        this.setInProgress = this.setInProgress.bind(this);
        this.state = {
            inProgress: false
        }
    }

    setInProgress(newState) {
        this.setState({ inProgress: newState });
    }

    render() {
        if (this.state.inProgress) {
            return <RaisedButton
                style={this.props.style}
                labelStyle={{ color: "white" }}
                buttonStyle={{ backgroundColor: "rgb(109, 109, 109)" }}
                labelPosition="after"
                disabled={this.props.disabled}
                onClick={this.props.onLoading}
                label={this.props.onLoadingText ? this.props.onLoadingText : this.props.label}
                icon={<CircularProgress size={23} />} />;
        } else {
            return <RaisedButton
                style={this.props.style}
                labelStyle={{ color: "white" }}
                label={this.props.label}
                disabled={false}
                onClick={this.props.onClick}
                buttonStyle={{ backgroundColor: "rgb(109, 109, 109)" }}
                backgroundColor={grey400} />;
        }
    }
}