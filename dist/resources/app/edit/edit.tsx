// ------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ------------------------------------------------------------

/// <import path="../typings/index.d.ts" />

import * as React from "react";
import { observer } from "mobx-react";
import { EditProps, StateManager } from "../state/state";
import { Collapse } from "../collapse/collapse";
import { Repo, GitFile } from "../repo/repo";
import { SpinnerButton } from "../components/spinnerButton";
import Divider from 'material-ui/Divider';
import { FileItem } from "./fileItem";
import { FileNode } from "./fileNode";
import * as path from "path";
import { ListItem } from 'material-ui/List';
import { VstsClient } from "../repo/VstsClient";
import { ConfigUtil } from "../config/configUtil";
import { ModelReader } from "../modelReader/modelReader";
import { TreeGenerator } from "../Explorer/treeGenerator";
import CircularProgress from 'material-ui/CircularProgress';

const log = require("loglevel");

interface RenderSectionProps {
    modifiedDataSource?: Array<GitFile>,
    dataSource?: Array<GitFile>,
    row: (file: GitFile) => any
}

const RenderSection = ({ modifiedDataSource, row }: RenderSectionProps) => {
    return (
        <div>
            {
                modifiedDataSource.map((file, index) => {
                    return row(file);
                })
            }
        </div>
    );
};

@observer
export class Edit extends React.Component<EditProps, any> {

    constructor(props) {
        super(props);
        this.renderRow = this.renderRow.bind(this);
        this.refreshFileTree = this.refreshFileTree.bind(this);
        this.handlePushButtonClick = this.handlePushButtonClick.bind(this);
        this.handleDiscardButtonClick = this.handleDiscardButtonClick.bind(this);
        this.handleRefreshButtonClick = this.handleRefreshButtonClick.bind(this);
        this.refreshLastCommitDateTime = this.refreshLastCommitDateTime.bind(this);
        this.refreshLastCommitDateTime();
    }

    refreshLastCommitDateTime() {
        Repo.instance().gitLog().then((res) => {
            this.props.inner.setLastCommitDate(new Date(res.latest.date).toISOString());
        });
    }

    refreshFileTree() {
        (this.refs["fileTree"] as any).setState({ open: false });
    }

    handlePushButtonClick() {
        (this.refs["pushButton"] as any).setInProgress(true);
        ModelReader.validateModelFiles()
            .then(() => Repo.instance().gitAdd())
            .then(() => Repo.instance().gitAddAndCommit())
            .then(() => Repo.instance().gitPull())
            .then(() => Repo.instance().gitPush())
            .then(() => Repo.instance().pullRequest())
            .then((res) => {
                log.info("Pull request created.");
            }).catch((e) => {
                log.error(e);
            }).finally(() => {
                this.refreshLastCommitDateTime();
                this.props.inner.refreshChangeList();
                this.props.inner.refreshPendingPullRequest();
                (this.refs["pushButton"] as any).setInProgress(false);
            })
    }

    handleDiscardButtonClick() {
        Repo.instance().discard().then(() => {
            this.props.inner.refreshChangeList();
            this.refreshFileTree();
            TreeGenerator.reloadAllTrees();
        }).catch((e) => {
            log.error(e.toString());
        });
    }

    handleRefreshButtonClick() {
        (this.refs["refreshButton"] as any).setInProgress(true);
        Repo.instance().gitPull().then(() => {
            log.info("Object definitions are up to date.");
        }).catch((e) => {
            log.error(e);
        }).finally(() => {
            this.refreshLastCommitDateTime();
            this.props.inner.refreshChangeList();
            TreeGenerator.reloadAllTrees();
            (this.refs["refreshButton"] as any).setInProgress(false);
        });

        this.props.inner.refreshPendingPullRequest();
    }

    renderRow(file: GitFile) {
        return (
            <FileItem key={file.path} enableEdit={true} showDiff={true} onEdit={() => { TreeGenerator.reloadAllTrees(); }} enableDelete={true} onDelete={() => { this.props.inner.refreshChangeList(); this.refreshFileTree(); TreeGenerator.reloadAllTrees(); }} file={file} />
        )
    }

    renderPushButton(modifiedFileSrc: GitFile[]) {
        if (modifiedFileSrc != null && modifiedFileSrc.length > 0) {

            let isProtected = false;
            for (let fileSrc of modifiedFileSrc) {
                if (fileSrc.isProtected) {
                    isProtected = true;
                }
            }

            return (
                <div style={{ paddingTop: 10, paddingLeft: 15, paddingBottom: 10 }}>
                    <SpinnerButton ref={"pushButton"} disabled={true} onClick={this.handlePushButtonClick} label={"Submit Pull Request"} />
                    <SpinnerButton ref={"discardButton"} disabled={true} onClick={this.handleDiscardButtonClick} style={{ marginLeft: 10, marginTop: 10 }} label={"Discard"} />
                </div>
            )
        }
    }

    renderChanges(modifiedFileSrc: GitFile[]) {
        return modifiedFileSrc.length > 0 ? (
            <div>
                <RenderSection modifiedDataSource={modifiedFileSrc} row={this.renderRow} />
                {this.renderPushButton(modifiedFileSrc)}
            </div>) :
            (<div style={{ paddingTop: 10, paddingLeft: 30, paddingBottom: 10, fontFamily: "Roboto, sans-serif", fontSize: 13.5, fontWeight: "normal" }}>
                No changes found. <br />
            </div>);
    }

    renderPullRequests() {
        if (this.props.inner.isGetPendingPullRequestInProgress) {
            return (
                <div style={{ paddingTop: 10, paddingBottom: 10, fontFamily: "Roboto, sans-serif", fontSize: 13.5, fontWeight: "normal" }}>
                    <CircularProgress style={{ marginLeft: 20 }} size={23} />
                </div>);
        }

        if (this.props.inner.pullRequests.length == 0) {
            return (
                <div style={{ paddingTop: 10, paddingLeft: 30, paddingBottom: 10, fontFamily: "Roboto, sans-serif", fontSize: 13.5, fontWeight: "normal" }}>
                    No active pull request found. <br />
                </div>
            );
        }

        return this.props.inner.pullRequests.map((pullRequest, index) => {
            return (
                <ListItem
                    key={index}
                    primaryText={pullRequest.title}
                    secondaryText={pullRequest.creationDate}
                    onClick={() => {
                        StateManager.getStore().tabManager.inner.openTab({ url: VstsClient.instance().getPullRequestURL(pullRequest.pullRequestId), title: "Azure Devops" });
                    }}
                />);
        })
    }

    render() {
        return (
            <div>
                <Collapse openByDefault={true} title={"Changes"}>
                    {this.renderChanges(this.props.inner.modifiedFileSrc)}
                </Collapse>
                <Collapse ref={"fileTree"} openByDefault={true} title={"Object Definitions"}>
                    <div>
                        <FileNode
                            style={{
                                paddingLeft: 5
                            }}
                            innerDivStyle={
                                {
                                    fontFamily: "Roboto, sans-serif",
                                    fontSize: "13.5px",
                                    paddingTop: "10px",
                                    paddingLeft: "28px",
                                    paddingBottom: "10px",
                                    fontWeight: "inherit"
                                }
                            }
                            directory={path.join(ConfigUtil.GetSetting("modelRepoDir"), "src")}
                        />
                    </div>
                </Collapse>
                <Collapse openByDefault={true} title={"Active Pull Requests"}>
                    {this.renderPullRequests()}
                </Collapse>
                <Divider style={{ marginTop: 10, marginBottom: 10 }} />
                <div style={{ paddingLeft: 15 }}>
                    <div style={{ paddingBottom: 10 }}>
                        <span style={{ color: "rgb(109, 109, 109)", fontSize: 11 }}>Last updated at {this.props.inner.lastCommitDateTime}</span>
                    </div>
                    <SpinnerButton ref={"refreshButton"} disabled={true} onClick={this.handleRefreshButtonClick} label={"Refresh"} />
                </div>
            </div >
        )
    }
}