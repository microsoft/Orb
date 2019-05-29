//------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//------------------------------------------------------------

/// <reference path="../typings/index.d.ts" />

import * as React from "react";
import { ExplorerProps } from "../state/state"
import Drawer from "material-ui/Drawer";
import { observer } from "mobx-react";
import { TreeNode } from "./treeNode";
import { Collapse } from "../collapse/collapse";
import { DateTimeWidget } from "../dateTimeWidget/dateTimeWidget";

@observer
export class Explorer extends React.Component<ExplorerProps, any> {

    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div>
                <Collapse openByDefault={true} title={"Time Range"}>
                    <div style={{ paddingTop: 20, paddingLeft: 20, paddingBottom: 20, paddingRight: 20 }} >
                        <DateTimeWidget style={{ width: "150px" }} inner={this.props.inner.dateTimeWidget.inner} />
                    </div>
                </Collapse>
                {this.getTrees()}
            </div>
        )
    }

    private getTrees() {
        if (this.props.inner.trees.length > 0) {
            return (
                <div className={this.props.inner.showInlineSearch ? "searchActive" : null}>
                    {this.props.inner.trees.map(tree => {
                        return <TreeNode key={tree.root.node.path} node={tree.root.node}></TreeNode>
                    })}
                </div>
            );
        } else {
            return (
                <div style={{ margin: 10 }}>* Search for an object to add it here.</div>
            )
        }
    }
}