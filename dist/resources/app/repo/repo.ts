import * as path from "path";
export type GitFileStatus = "NEW" | "MODIFIED" | "CONFLICTED" | "DELETED";
import * as Promise from "bluebird";
import { ModelReader } from "../modelReader/modelReader";
import { ConfigUtil } from "../config/configUtil";
import { EditorCtrl } from "../editor/editorCtrl";
import { VstsClient, VstsResponse } from "./vstsClient";
import { VstsAuthenticator } from "../data/auth";
import { Util } from "../util/util";
const Config = require("electron-config");
const config = new Config();
const log = require("loglevel");

export interface GitFile {
    name: string,
    path: string,
    status?: GitFileStatus
    isProtected?: boolean;
}

abstract class BaseRepo {
    protected repoPath;
    protected userName;
    protected branchName;
    protected constructor(repoPath: string) {
        this.repoPath = repoPath;
        this.userName = process.env.USERNAME;
        this.branchName = "zzz_pullrequest_temp/{0}/master".format(this.userName);
    }

    protected getCommitMessage(): string {
        return "{0} committed at {1}".format(this.userName, new Date().toISOString());
    }

    protected convertToGitFiles(files: Array<any>, status: GitFileStatus): Array<GitFile> {
        if (files == null || files.length === 0) {
            return [];
        }

        return files.map((file: String) => {
            const name = path.basename(file.replace(/['"]+/g, ''));
            const filePath = path.join(this.repoPath, file.replace(/['"]+/g, ''));
            return {
                name: name,
                path: filePath,
                status: status,
                isProtected: ModelReader.isProtected(filePath),
            } as GitFile;
        });
    }

    protected getSrcPath(fullPath: string): string {
        let srcPath = fullPath.startsWith(ConfigUtil.GetSetting("modelRepoDir")) ?
            fullPath.substring(ConfigUtil.GetSetting("modelRepoDir").length + 1) :
            fullPath;

        return srcPath.replace(/\\/g, "/");
    }

    existsSync(): boolean {
        return Util.existsSync(path.join(ConfigUtil.GetSetting("modelRepoDir"), ".git"));
    }

    pullRequest(): Promise<any> {
        return VstsClient.instance().createOrUpdatePullRequest(
            "Request for merging: {0}".format(this.branchName),
            this.branchName, "{0} sent pull request at {1}".format(this.userName, new Date().toUTCString()));
    }

    getPendingPullRequest(): Promise<{ value: VstsResponse[] }> {
        return VstsClient.instance().getActivePendingPullRequests(this.branchName);
    }

    gitFileStatus(): Promise<GitFile[]> {
        console.log("gitFileStatus");
        return this.gitStatus().then((res) => {
            let files: Array<GitFile> = [];
            files = files.concat(
                this.convertToGitFiles(res.conflicted, "CONFLICTED"),
                this.convertToGitFiles(res.created, "NEW"),
                this.convertToGitFiles(res.not_added, "NEW"),
                this.convertToGitFiles(res.modified, "MODIFIED"),
                this.convertToGitFiles(res.deleted, "DELETED")
            );

            return files;
        });
    }

    abstract gitStatus(): Promise<any>;

    abstract gitAddAndCommit(): Promise<any>;

    abstract gitAdd(): Promise<any>;

    abstract gitPull(): Promise<any>;

    abstract gitPush(): Promise<void>;

    abstract gitClone(): Promise<any>;

    abstract gitLog(): Promise<any>;

    abstract discard(): Promise<void>;

    abstract gitShow(modifiedFilePath: string): Promise<any>;

    abstract gitReset(modifiedFilePath: string): Promise<void>;

    abstract gitCheckout(modifiedFilePath: string): Promise<void>;

    abstract setGitPath(gitPath: string);
}

class SimpleGitRepo extends BaseRepo {

    private git;

    constructor(repoPath: string) {
        super(repoPath);
        this.git = require("simple-git")(repoPath);
    }

    private gitCommit(): Promise<any> {
        console.log("gitCommit");
        return new Promise<any>((resolve, reject) => {
            this.git.commit(this.getCommitMessage(), (err, res) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(res);
                }
            })
        });
    }

    gitAdd(): Promise<any> {
        console.log("gitAdd");
        return new Promise<any>((resolve, reject) => {
            this.git.add("./*", (err, res) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(res);
                }
            });
        });
    }

    gitAddAndCommit(): Promise<any> {
        return this.gitAdd().then(() => {
            return this.gitCommit();
        })
    }

    gitStatus(): Promise<any> {
        console.log("gitStatus");
        return new Promise<any>((resolve, reject) => {
            this.git.status((err, res) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(res);
                }
            });
        });
    }

    gitPull(): Promise<any> {
        console.log("gitPull");
        return new Promise<any>((resolve, reject) => {
            this.git.pull(["origin", "master"], (err, res) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(res);
                }
            });
        });
    }

    gitPush(): Promise<any> {
        console.log("gitPush");
        return new Promise<any>((resolve, reject) => {
            this.git.push(["push", "-f", "--no-verify", "origin", "master:" + this.branchName], (err, res) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(res);
                }
            });
        });
    }

    gitClone(): Promise<any> {
        console.log("gitClone");
        return new Promise<any>((resolve, reject) => {
            this.git.clone(ConfigUtil.GetSetting("remoteOrigin"), ConfigUtil.GetSetting("modelRepoDir"), [], (err, res) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(res);
                }
            });
        });
    }

    gitLog(): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.git.log((err, res) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(res);
                }
            });
        });
    }

    discard(): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.git.reset(["--hard", "origin/master"], (err) => {
                // This will discard conflicted file.
                if (err) {
                    reject(err);
                }
            }).checkout("-f", (err) => {
                // Clean the file added/staged.
                if (err) {
                    reject(err);
                }
            }).clean("f", ["-d"], (err) => {
                // Clean the directory newly added, discard the delete change.
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    gitShow(modifiedFilePath: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.git.show(["HEAD:" + this.getSrcPath(modifiedFilePath)], (err, res) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(res);
                }
            });
        });
    }

    gitReset(modifiedFilePath: string) {
        console.log("gitReset");
        return new Promise<any>((resolve, reject) => {
            this.git.reset([this.getSrcPath(modifiedFilePath)], (err, res) => {
                if (res) {
                    reject(err);
                } else {
                    resolve(res);
                }
            })
        });
    }

    gitCheckout(modifiedFilePath: string): Promise<any> {
        console.log("gitCheckout");
        return new Promise<any>((resolve, reject) => {
            this.git.checkout(this.getSrcPath(modifiedFilePath), (err, res) => {
                console.log(err);
                console.log(res);
                if (res) {
                    reject(err);
                } else {
                    resolve(res);
                }
            })
        });
    }

    setGitPath(gitPath: string) {
        this.git.customBinary(gitPath);
    }
}

class NodeGitRepo extends BaseRepo {

    private git;

    constructor(repoPath: string) {
        super(repoPath);
        this.git = require("nodegit");
    }

    private getFetchOpts(token) {
        return {
            fetchOpts: {
                callbacks: {
                    certificateCheck: () => {
                        return 1;
                    },
                    credentials: (url, userName) => {
                        return this.git.Cred.userpassPlaintextNew(token, "x-oauth-basic");
                    }
                }
            }
        }
    }

    private getPersonalAccessToken() {
        return VstsAuthenticator.instance().getToken();
    }

    private parseGitLogResult(latestCommit) {
        var res = {};
        var latest = {
            date: latestCommit.date(),
        }

        res["latest"] = latest;
        return res;
    }

    gitStatus(): Promise<any> {
        console.log("gitStatus");
        return this.git.Repository.open(this.repoPath).then((repository) => {
            var res = {
                conflicted: [],
                created: [],
                modified: [],
                deleted: []
            };

            return repository.getStatus().then((files) => {
                files.forEach((file) => {
                    if (file.isConflicted()) {
                        res.conflicted.push(file.path());
                    } else if (file.isNew()) {
                        res.created.push(file.path());
                    } else if (file.isModified()) {
                        res.modified.push(file.path());
                    } else if (file.isDeleted()) {
                        res.deleted.push(file.path());
                    }
                });

                return res;
            });
        })
    }

    gitAdd(): Promise<any> {
        console.log("gitAdd");
        return this.git.Repository.open(this.repoPath).then((repository) => {
            return repository.refreshIndex().then((index) => {
                return index.addAll().then(() => {
                    return index.write();
                }).then(() => {
                    return index.writeTree();
                });
            });
        });
    }

    gitAddAndCommit(): Promise<any> {
        return this.gitAdd().then((oid) => {
            return this.git.Repository.open(this.repoPath).then((repository) => {
                return this.git.Reference.nameToId(repository, "HEAD").then((head) => {
                    return repository.getCommit(head).then((parent) => {
                        var author = this.git.Signature.now(this.userName, this.userName + "@microsoft.com");

                        console.log("gitCommit");
                        return repository.createCommit("HEAD", author, author, this.getCommitMessage(), oid, [parent]);
                    })
                })
            });
        })
    }

    gitPull(): Promise<any> {
        console.log("gitPull");
        return this.getPersonalAccessToken().then((token) => {
            return this.git.Repository.open(this.repoPath).then((repository) => {
                return repository.fetchAll(this.getFetchOpts(token).fetchOpts).then(() => {
                    return repository.mergeBranches("master", "origin/master");
                });
            })
        })
    }

    gitPush(): Promise<any> {
        console.log("gitPush");
        return this.getPersonalAccessToken().then((token) => {
            return this.git.Repository.open(this.repoPath).then((repository) => {
                return repository.getRemote("origin").then((remote) => {
                    return remote.push(
                        ["+refs/heads/master:refs/heads/" + this.branchName],
                        this.getFetchOpts(token).fetchOpts
                    )
                })
            });
        });
    }

    gitClone(): Promise<any> {
        console.log("gitClone");
        return this.getPersonalAccessToken().then((token) => {
            return this.git.Clone(ConfigUtil.GetSetting("remoteOrigin"), ConfigUtil.GetSetting("modelRepoDir"),
                this.getFetchOpts(token)).catch((e) => {
                    return Util.remove(ConfigUtil.GetSetting("modelRepoDir")).then(() => {
                        return this.git.Clone(ConfigUtil.GetSetting("remoteOrigin"), ConfigUtil.GetSetting("modelRepoDir"),
                            this.getFetchOpts(token));
                    })
                });
        })
    }

    gitLog(): Promise<any> {
        return this.git.Repository.open(this.repoPath).then((repository) => {
            return repository.getHeadCommit().then((latestCommit) => {
                return this.parseGitLogResult(latestCommit);
            });
        });
    }

    discard(): Promise<any> {
        return this.git.Repository.open(this.repoPath).then((repository) => {
            return repository.getReferenceCommit("refs/remotes/origin/master").then((commit) => {
                return this.git.Reset.reset(repository, commit, this.git.Reset.TYPE.HARD, {});
            });
        });
    }

    gitShow(modifiedFilePath: string): Promise<any> {
        return this.git.Repository.open(this.repoPath).then((repository) => {
            return repository.getBranchCommit("refs/heads/master").then((commit) => {
                return commit.getTree().then((tree) => {
                    return tree.getEntry(this.getSrcPath(modifiedFilePath)).then((treeEntry) => {
                        return treeEntry.getBlob().then((blob) => {
                            return blob.toString();
                        });
                    })
                });
            });
        });
    }

    gitReset(modifiedFilePath: string) {
        console.log("gitReset");
        return this.git.Repository.open(this.repoPath).then((repository) => {
            return repository.getMasterCommit().then((commit) => {
                return this.git.Reset.default(repository, commit, this.getSrcPath(modifiedFilePath)).then(() => {
                    return repository.refreshIndex().then((index) => {
                        return index.write().then(() => {
                            return index.writeTree();
                        });
                    });
                });
            });
        });
    }

    gitCheckout(modifiedFilePath: string): Promise<any> {
        console.log("gitCheckout");
        return this.git.Repository.open(this.repoPath).then((repository) => {
            return this.git.Checkout.head(repository, {
                checkoutStrategy: this.git.Checkout.STRATEGY.FORCE,
                paths: this.getSrcPath(modifiedFilePath)
            });
        });
    }

    setGitPath(gitPath: string) {
        // Not needed for nodegit.
    }
}

export class Repo {
    private static _instance: BaseRepo = null;

    public static instance() {
        try {
            if (Repo._instance == null) {
                Repo._instance = new NodeGitRepo(ConfigUtil.GetSetting("modelRepoDir"));
            }
        } catch (ex) {
            log.error(ex.toString());
        }

        return Repo._instance;
    }
}
