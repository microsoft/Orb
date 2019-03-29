//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../../typings/index.d.ts" />
import * as React from "react";
import * as ReactDOM from "react-dom";
import { MarkdownExtension } from "./markdownExtension";

class HealthSnapShotProps {
    data: [[{ CollectionTime: string, ExtensionObject: object, HealthDescription: object, HealthMask: string, InterfaceName: string, MaximumInconsistencyPeriod: object, RoleInstanceIPAddress: string, RoleInstanceName: string, RoleName: string, SourceName: string, UD: number }]]
}

interface SnapShotState {
    idx?: number;
}

const colors = ["#c3e6cb", "#dddfe2", "#b8daff", "#dddfe2", "#f5c6cb", "#dddfe2", "#bee5eb", "#dddfe2", "#ffeeba", "#dddfe2"];

function SnapShotDescription(props) {

    const healthDescription = props.data[props.idx].map((item) => {
        const timeStamp = new Date(parseInt(item.CollectionTime.substring(6, item.CollectionTime.length - 2))).toUTCString();
        return (
            <div>
                <div className="titleDiv bg1">
                    <span className="bigInfo">{item.RoleInstanceName}</span> &nbsp;&nbsp;&nbsp;&nbsp;
                    <span className="smallInfo">
                        <i className="fa fa-plug" aria-hidden="true"></i>&nbsp;
                        InterfaceName: {item.InterfaceName}
                    </span> &nbsp;&nbsp;&nbsp;&nbsp;
                    <span className="smallInfo" style={{ color: "red" }}>
                        <i className="fa fa-clock-o" aria-hidden="true"></i>&nbsp;
                        CollectionTime: {timeStamp}
                    </span>
                </div>

                <div className="keyDiv bg2">UD</div>
                <div className="valueDiv bg2">{item.UD}</div>
                <div style={{ clear: "both" }}></div>

                <div className="keyDiv bg3">HealthMask</div>
                <div className="valueDiv bg3">{item.HealthMask}</div>
                <div style={{ clear: "both" }}></div>

                <div className="keyDiv bg4">RoleInstanceIPAddress</div>
                <div className="valueDiv bg4">{item.RoleInstanceIPAddress}</div>
                <div style={{ clear: "both" }}></div>

                <div className="keyDiv bg5">HealthDescription</div>
                <div className="valueDiv bg5">raw data waiting to be processed...</div>
                <div style={{ clear: "both" }}></div>

                <div style={{ background: "#ffffff", height: "48px" }}></div>
            </div>
        );
    });

    return (
        <div>
            <h3 className="healthDescription">$f.MRDriver.LatestHealthSnapshot[{props.idx}]</h3>
            <p>{healthDescription}</p>
        </div>
    );
}

function ProcessRawData(dataArray: [{ CollectionTime: string, ExtensionObject: object, HealthDescription: object, HealthMask: string, InterfaceName: string, MaximumInconsistencyPeriod: object, RoleInstanceIPAddress: string, RoleInstanceName: string, RoleName: string, SourceName: string, UD: number }]) {
    var newData = [];
    dataArray.forEach((role) => {
        const name = role.RoleInstanceName
        const key = name.split('_').pop();
        if (!(key in newData)) {
            newData[key] = [];
        }

        newData[key].push(role);
    })

    return newData;
}

export class MRDriverLatestHealthSnapShot extends MarkdownExtension<HealthSnapShotProps, SnapShotState> {

    constructor(props) {
        super(props);
        this.state = { idx: 0 };
        this.handleClick = this.handleClick.bind(this);
    }

    handleClick(idx: number, e) {
        this.setState({ idx: idx });
    }

    static fromNode(node: any, children: any[]) {
        var formattedData = JSON.parse(children.toString()) as [{ CollectionTime: string, ExtensionObject: object, HealthDescription: object, HealthMask: string, InterfaceName: string, MaximumInconsistencyPeriod: object, RoleInstanceIPAddress: string, RoleInstanceName: string, RoleName: string, SourceName: string, UD: number }];
        return <MRDriverLatestHealthSnapShot data={ProcessRawData(formattedData) as any}></MRDriverLatestHealthSnapShot>;
    }

    render() {
        const roleInstances = this.props.data.map((item, index) => {
            const roles = item.map((role) => {
                if (role.HealthMask == "Healthy") {
                    return (
                        <div>
                            <p className="info" style={{ paddingLeft: "10px", paddingRight: "10px" }}><i className="fa fa-check-circle healthy" title="Healthy" aria-hidden="true"></i> {role.RoleInstanceName}</p>
                            <hr className="rolehr" />
                        </div>
                    );
                } else {
                    return (
                        <div>
                            <p className="info"><i className="fa fa-times-circle-o non-contactable" title="non-contactable" aria-hidden="true"></i> {role.RoleInstanceName}</p>
                            <hr className="rolehr" />
                        </div>
                    );
                }
            });
            return (
                <div className="roleInstance" onClick={(e) => this.handleClick(index, e)}>
                    {roles}
                </div>
            );
        });
        return (
            <div style={{ background: "#ffffff", color: "#212529", padding: "10px" }}>
                {roleInstances}
                <SnapShotDescription data={this.props.data} idx={this.state.idx} />
            </div>
        );
    }
}

export const MarkdownExtensionImplementation = MRDriverLatestHealthSnapShot;