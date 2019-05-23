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
        alwaysOpenInNewTab: null,
        vstsBaseUri: null,
        homePageUrl: null,
    }

    private static DefaultConfig = {
        modelRepoDir: path.join(remote.app.getPath("userData"), "OrbModels"),
        remoteOrigin: "https://dev.azure.com/orbModels/_git/OrbModels",
        alwaysOpenInNewTab: true,
        vstsBaseUri: "https://dev.azure.com/orbModels/_apis/git/repositories/d4136505-6729-4843-9213-84b700af567d",
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

    static GetSetting(name: string) {
        if (ConfigUtil.Settings[name] == null) {
            ConfigUtil.Settings[name] = config.get(name);
        }

        return ConfigUtil.Settings[name];
    }
}
