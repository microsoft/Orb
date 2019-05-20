const Config = require("electron-config");
const config = new Config();
import * as path from "path";
import { DialogManager } from "../dialog/dialogManager";
import { remote } from "electron";
import * as Promise from "bluebird";

export class ConfigUtil {
    public static Settings = {
        modelRepoDir: null,
        remoteOrigin: null,
        fontFamily: null,
        fontSize: null,
        alwaysOpenInNewTab: null,
        pullRequestUrl: null,
        vstsBaseUri: null,
        kustoClientId: null,
        kustoClientReplyUri: null,
        kustoResourceId: null,
        vstsClientId: null,
        vstsClientReplyUri: null,
        vstsResourceId: null,
        featureRequestUrl: null,
        supportUrl: null,
        homePageUrl: null,
    }

    private static DefaultConfig = {
        modelRepoDir: path.join(remote.app.getPath("userData"), "OrbModels"),
        remoteOrigin: "https://dev.azure.com/orbModels/_git/OrbModels",
        fontFamily: "Roboto,sans-serif",
        fontSize: "14px",
        alwaysOpenInNewTab: true,
        pullRequestUrl: "https://dev.azure.com/orbModels/_git/OrbModels/pullrequest",
        vstsBaseUri: "https://dev.azure.com/orbModels/_apis/git/repositories/d4136505-6729-4843-9213-84b700af567d",
        kustoClientId: "db662dc1-0cfe-4e1c-a843-19a68e65be58",
        kustoClientReplyUri: "https://microsoft/kustoclient",
        kustoResourceId: "https://orbcluster.westus2.kusto.windows.net",
        vstsClientId: "872cd9fa-d31f-45e0-9eab-6e460a02d1f1",
        vstsClientReplyUri: "urn:ietf:wg:oauth:2.0:oob",
        vstsResourceId: "499b84ac-1321-427f-aa17-267ca6975798",
        featureRequestUrl: "https://github.com/Microsoft/Orb/issues",
        supportUrl: "mailto:orbTalk@microsoft.com",
        homePageUrl: "https://github.com/Microsoft/Orb"
    }

    private static set(name: string, value: any): void {
        config.set(name, value);
        ConfigUtil.Settings[name] = value;
    }

    static promptForMissingConfiguration(): Promise<void> {
        let missingConfigs = [];

        Object.keys(ConfigUtil.DefaultConfig).forEach((prop) => {
            let cache = config.get(prop);
            if (cache == undefined) {
                if (ConfigUtil.DefaultConfig[prop] != null) {
                    ConfigUtil.set(prop, ConfigUtil.DefaultConfig[prop]);
                } else {
                    missingConfigs.push(prop);
                }
            } else {
                ConfigUtil.Settings[prop] = cache;
            }
        })

        if (missingConfigs.length == 0) {
            return Promise.resolve();
        }

        return DialogManager.prompt("Configuration", "Some required configuration(s) are missing: ", "*All fields are required", missingConfigs).then((res) => {
            let emptyInputs = [];

            missingConfigs.forEach((missingConfig) => {
                if (res[missingConfig] != undefined) {
                    ConfigUtil.set(missingConfig, res[missingConfig]);
                } else {
                    emptyInputs.push(missingConfig);
                }
            });

            if (emptyInputs.length > 0) {
                return ConfigUtil.promptForMissingConfiguration();
            }
        })
    }
}
