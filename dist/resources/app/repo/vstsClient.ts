
import * as rp from "request-promise";
import * as Promise from "bluebird";
import { VstsAuthenticator } from "../data/auth";
import { ConfigUtil } from "../config/configUtil";

export interface VstsResponse {
    pullRequestId: number;
    creationDate: string;
    statusCode: number;
    status: "active" | "abandoned" | "completed";
    url: string;
    createdBy: {
        displayName: string;
        id: string;
        uniqueName: string;
        url: string;
        imageUrl: string;
    };
    title: string;
    description: string;
}

export class VstsClient {
    private baseURI = ConfigUtil.GetSetting("vstsBaseUri");
    private PULLREQUEST_URI = this.baseURI + "/pullRequests?api-version=3.0";
    private UPDATE_PULLREQUEST_URI = this.baseURI + "/pullRequests/{0}?api-version=3.0";
    private GET_PULLREQUEST_URI = this.PULLREQUEST_URI + "&sourceRefName={0}&targetRefName={1}&$top=1";
    private retryCount: number;
    private static _instance: VstsClient;
    private constructor() {
        this.retryCount = 0;
    }

    public static instance(): VstsClient {
        if (!VstsClient._instance) {
            VstsClient._instance = new VstsClient();
        }

        return VstsClient._instance;
    }

    private static invoke(url: string, body: any, method: "POST" | "PATCH" | "GET" = "GET", token: string, contentType = "application/json") {
        let options = {
            method: method,
            uri: url,
            body: body,
            headers: {
                "Content-Type": contentType,
                "Authorization": "Bearer " + token,
            },
            json: true
        };

        return rp(options);
    }

    private getPullRequest(branchName, token): Promise<{ value: VstsResponse[] }> {
        console.log("get pull request");
        return (VstsClient.invoke(this.GET_PULLREQUEST_URI.format("refs/heads/{0}".format(branchName), "refs/heads/master"), "", "GET", token) as any).then((res) => {
            if (!res || !res.value) {
                throw "authentication failed for getting pull request";
            }

            return res;
        });
    }

    private createPullRequest(title: string, remoteBranchName: string, description: string, token: string): Promise<VstsResponse> {
        console.log("create pull request");
        let body = {
            "sourceRefName": "refs/heads/{0}".format(remoteBranchName),
            "targetRefName": "refs/heads/master",
            "title": title,
            "description": description,
            "reviewers": [

            ]
        };

        return (VstsClient.invoke(this.PULLREQUEST_URI, body, "POST", token) as any).then((res: VstsResponse) => {
            if (!res || !res.pullRequestId) {
                throw "authentication failed for creating pull request.";
            }

            return res;
        });
    }

    private updatePullRequest(autoCompleteSetBy: string, mergeCommitMessage: string, pullRequestId: number, token: string) {
        console.log("update pull request");
        let body = {
            "autoCompleteSetBy": {
                "id": autoCompleteSetBy,
            },
            "completionOptions": {
                "deleteSourceBranch": "true",
                "mergeCommitMessage": mergeCommitMessage,
                "squashMerge": "true"
            }
        };

        return VstsClient.invoke(this.UPDATE_PULLREQUEST_URI.format(pullRequestId), body, "PATCH", token);
    }

    public getPullRequestURL(pullRequestId) {
        return ConfigUtil.GetSetting("remoteOrigin") + "/pullrequest/{0}".format(pullRequestId);
    }

    public getActivePendingPullRequests(branchName: string): Promise<{ value: VstsResponse[] }> {
        return VstsAuthenticator.instance().getToken().then((token) => {
            return VstsClient.instance().getPullRequest(branchName, token).then((res) => {
                return res;
            }).catch((e) => {
                if (this.retryCount >= 1) {
                    throw e;
                }

                this.retryCount++;
                return this.getActivePendingPullRequests(branchName);
            });
        }).finally(() => {
            this.retryCount = 0;
        })
    }

    public createOrUpdatePullRequest(title: string, remoteBranchName: string, description: string) {
        console.log("create or update pull request");
        return VstsAuthenticator.instance().getToken().then((token) => {
            return this.createPullRequest(title, remoteBranchName, description, token)
                .catch((e) => {
                    if (e.statusCode == 409 && e.message.indexOf("the source and target branch already exists") != -1) {
                        return this.getPullRequest(remoteBranchName, token).then((res: {
                            value: VstsResponse[]
                        }) => {
                            return res.value[0];
                        });
                    } else {
                        if (this.retryCount >= 1) {
                            throw e;
                        }

                        this.retryCount++;
                        return this.createOrUpdatePullRequest(title, remoteBranchName, description);
                    }
                }).then((res) => {
                    console.log(res);
                    return this.updatePullRequest(res.createdBy.id, res.description, res.pullRequestId, token);
                });
        }).finally(() => {
            this.retryCount = 0;
        })
    }
}