//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />

import * as React from "react";
import { observer } from 'mobx-react';
import { DateTimeWidgetProps, DateTimeWidgetState } from "../state/state";
import SelectField from 'material-ui/SelectField';
import MenuItem from 'material-ui/MenuItem';
import { Util } from "../util/util";
import { ResourceProviderHelper } from "../extensions/resourceProviders/helper";
import Toggle from "material-ui/Toggle";
let DateTime = require("react-datetime");
let log = require("loglevel");

@observer
export class DateTimeWidget extends React.Component<DateTimeWidgetProps, any> {
    expression = /^\d*(m|d|h)$/i;
    constructor(props) {
        super(props);

        this.handleToggle = this.handleToggle.bind(this);
        this.resetRelativeTime = this.resetRelativeTime.bind(this);
        this.renderGroupButtons = this.renderGroupButtons.bind(this);
        this.handleTimeAgoChange = this.handleTimeAgoChange.bind(this);
        this.handleEndTimeChange = this.handleEndTimeChange.bind(this);
        this.renderDataTimePicker = this.renderDataTimePicker.bind(this);
        this.handleStartTimeChange = this.handleStartTimeChange.bind(this);
        this.handleTimeRangeButtonClick = this.handleTimeRangeButtonClick.bind(this);
    }

    resetRelativeTime() {
        this.props.inner.setRelativeTime("1h");
    }

    handleTimeAgoChange(text: string) {
        if (this.expression.test(text)) {
            let minutes = ResourceProviderHelper.convertTimeAgoToMinutes(text);
            this.props.inner.setRelativeTime(text);
            this.props.inner.setTimeRangeByMin(minutes);
        } else {
            this.props.inner.setRelativeTime(text, false);
        }
    }

    handleStartTimeChange(momentDate) {
        let date;

        if (momentDate && typeof momentDate == "string") {
            let parsed = Util.tryParseDateTime(momentDate);
            if (parsed) {
                date = parsed;
            } else {
                this.props.inner.setStartTimeValid(false);
                return;
            }
        } else {
            date = momentDate.toDate();
        }

        this.props.inner.setStartTime(date);

        if (date > this.props.inner.endTime) {
            this.props.inner.setEndTimeValid(false);
            this.props.inner.setStartTimeValid(false);
        } else {
            this.props.inner.setEndTimeValid(true);
            this.props.inner.setStartTimeValid(true);
        }

        this.resetRelativeTime();
    }

    handleEndTimeChange(momentDate) {
        let date;

        if (momentDate && typeof momentDate == "string") {
            let parsed = Util.tryParseDateTime(momentDate);
            if (parsed) {
                date = parsed;
            } else {
                this.props.inner.setEndTimeValid(false);
                return;
            }
        } else {
            date = momentDate.toDate();
        }

        this.props.inner.setEndTime(date);

        if (date < this.props.inner.startTime) {
            this.props.inner.setEndTimeValid(false);
            this.props.inner.setStartTimeValid(false);
        } else {
            this.props.inner.setEndTimeValid(true);
            this.props.inner.setStartTimeValid(true);
        }

        this.resetRelativeTime();
    }

    handleTimeRangeButtonClick(minutes: number, buttonIndex = 0, text = "1h") {
        this.props.inner.setRelativeTime(text, true, buttonIndex);
        this.props.inner.setTimeRangeByMin(minutes);
    }

    handleToggle(event: Object, isRelativeMode: boolean) {
        if (!isRelativeMode) {
            this.props.inner.syncTime();
        }

        this.props.inner.setRelativeMode(isRelativeMode);
    }

    renderDataTimePicker() {
        if (this.props.inner.isRelativeMode) {
            return (
                <div>
                    <span style={{ fontFamily: "Roboto, sans-serif", color: "rgba(255, 255, 255, 0.298039)", display: "inline-block", height: 25, fontSize: 13.5, fontWeight: "normal", paddingBottom: 10 }} > Ago:</span>
                    <div
                        className={this.props.inner.isTimeAgoValid ? "rdt" : "rdt invalid"}>
                        <input
                            style={{ width: 28 }}
                            value={this.props.inner.timeAgoText}
                            onChange={(event) => this.handleTimeAgoChange((event.target as any).value)}
                            type="text"
                        />
                    </div>
                </div >
            );
        } else {
            return (
                <div>
                    <span style={{ fontFamily: "Roboto, sans-serif", color: "rgba(255, 255, 255, 0.298039)", display: "inline-block", height: 25, fontSize: 13.5, fontWeight: "normal", paddingBottom: 10 }} > From (UTC):</span>
                    <div>
                        <DateTime className={this.props.inner.isStartTimeValid ? "" : "invalid"} closeOnSelect={true} utc={true} value={this.props.inner.startTime} onChange={this.handleStartTimeChange} timeFormat={"HH:mm:ss"} dateFormat={"YYYY-MM-DDT"}></DateTime>
                    </div>
                    <br />
                    <span style={{ fontFamily: "Roboto, sans-serif", color: "rgba(255, 255, 255, 0.298039)", display: "inline-block", height: 25, fontSize: 13.5, fontWeight: "normal", paddingBottom: 10 }} > To (UTC):</span>
                    <div>
                        <DateTime className={this.props.inner.isEndTimeValid ? "" : "invalid"} closeOnSelect={true} utc={true} value={this.props.inner.endTime} onChange={this.handleEndTimeChange} timeFormat={"HH:mm:ss"} dateFormat={"YYYY-MM-DDT"}></DateTime>
                    </div>
                </div>
            )
        }
    }

    renderGroupButtons() {
        if (this.props.inner.isRelativeMode) {
            return (
                <div className="button-group">
                    <a className={this.props.inner.buttonIndex === 0 ? "button active" : "button"} onClick={() => this.handleTimeRangeButtonClick(60, 0, "1h")} tabIndex={0} role="button">1h</a>
                    <a className={this.props.inner.buttonIndex === 1 ? "button active" : "button"} onClick={() => this.handleTimeRangeButtonClick(360, 1, "6h")} tabIndex={0} role="button">6h</a>
                    <a className={this.props.inner.buttonIndex === 2 ? "button active" : "button"} onClick={() => this.handleTimeRangeButtonClick(720, 2, "12h")} tabIndex={0} role="button">12h</a>
                    <a className={this.props.inner.buttonIndex === 3 ? "button active" : "button"} onClick={() => this.handleTimeRangeButtonClick(1440, 3, "1d")} tabIndex={0} role="button">1d</a>
                    <a className={this.props.inner.buttonIndex === 4 ? "button active" : "button"} onClick={() => this.handleTimeRangeButtonClick(10080, 4, "7d")} tabIndex={0} role="button">7d</a>
                    <a className={this.props.inner.buttonIndex === 5 ? "button active" : "button"} onClick={() => this.handleTimeRangeButtonClick(43200, 5, "30d")} tabIndex={0} role="button">30d</a>
                </div>
            )
        } else {
            return (
                <div className="button-group">
                    <a className={"button"} onClick={() => this.handleTimeRangeButtonClick(60, 0, "1h")} tabIndex={0} role="button">1h</a>
                    <a className={"button"} onClick={() => this.handleTimeRangeButtonClick(360, 1, "6h")} tabIndex={0} role="button">6h</a>
                    <a className={"button"} onClick={() => this.handleTimeRangeButtonClick(720, 2, "12h")} tabIndex={0} role="button">12h</a>
                    <a className={"button"} onClick={() => this.handleTimeRangeButtonClick(1440, 3, "1d")} tabIndex={0} role="button">1d</a>
                    <a className={"button"} onClick={() => this.handleTimeRangeButtonClick(10080, 4, "7d")} tabIndex={0} role="button">7d</a>
                    <a className={"button"} onClick={() => this.handleTimeRangeButtonClick(43200, 5, "30d")} tabIndex={0} role="button">30d</a>
                </div>
            )
        }
    }

    render() {
        return (
            <div style={this.props.style}>
                <div style={{ display: "inline-flex", paddingBottom: 10 }}>
                    {this.renderGroupButtons()}
                    <Toggle
                        defaultToggled={this.props.inner.isRelativeMode}
                        thumbStyle={{
                            backgroundColor: "rgb(64, 64, 64)"
                        }}
                        thumbSwitchedStyle={{
                            backgroundColor: "rgb(109, 109, 109)"
                        }}
                        trackSwitchedStyle={{
                            backgroundColor: "rgb(109, 109, 109)"
                        }}
                        style={{
                            width: "auto",
                            paddingTop: 5
                        }}
                        onToggle={this.handleToggle}
                    />
                </div>
                {this.renderDataTimePicker()}
            </div >
        )
    }
}