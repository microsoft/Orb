//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />

import * as React from "react";
import { ToastProps, StateManager } from "../state/state";
import { observer } from "mobx-react";
const NotificationSystem = require("react-notification-system");

@observer
export class Toast extends React.Component<ToastProps, any> {
    notificationSystem: any;
    constructor(props) {
        super(props);
        this.handleRequestClose = this.handleRequestClose.bind(this);
        this.notificationSystem = null;
    }

    componentDidMount() {
        this.notificationSystem = this.refs["notificationSystem"];
        this.props.inner.setNotificationRef(this.notificationSystem);
        StateManager.signalToastReady();
    }

    handleRequestClose() {
        this.props.inner.hideToast();
    }

    componentWillUpdate() {
        if (this.props.inner.open && this.notificationSystem) {
            this.notificationSystem.addNotification({
                message: this.props.inner.message,
                title: this.props.inner.level.charAt(0).toUpperCase() + this.props.inner.level.slice(1),
                level: this.props.inner.level,
                position: this.props.inner.position,
                autoDismiss: this.props.inner.autoHideDuration,
                action: this.props.inner.action,
                onRemove: this.handleRequestClose
            })
        }
    }

    render() {
        const style = {
            NotificationItem: {
                info: {
                    borderTop: "2px solid rgb(48, 48, 48)",
                    backgroundColor: "rgb(109, 109, 109)",
                    color: "white",
                    WebkitBoxShadow: '0 0 1px 2px solid rgb(48, 48, 48)',
                    MozBoxShadow: '0 0 1px 2px solid rgb(48, 48, 48)',
                    boxShadow: '0 0 1px 2px solid rgb(48, 48, 48)'
                }
            },

            Title: {
                info: {
                    color: "white"
                }
            },
            Dismiss: {
                info: {
                    color: "white",
                    backgroundColor: "rgb(48, 48, 48)"
                }
            }
        }

        return (
            <div>
                <NotificationSystem ref="notificationSystem" style={style} open={this.props.inner.open} />
            </div>
        )
    }
}