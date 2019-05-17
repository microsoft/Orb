const Config = require("electron-config");
const config = new Config();
import * as path from "path";
import { DialogManager } from "../dialog/dialogManager";
import { remote } from "electron";
import * as Promise from "bluebird";

export class ConfigUtil {
    public static modelRepoDir: string;
    private static remoteOrigin: string;
    private static fontFamily: string;
    private static fontSize: string;
    private static alwaysOpenInNewTab: boolean;

    public static defaultConfig = {
        modelRepoDir: path.join(remote.app.getPath("userData"), "OrbModels"),
        remoteOrigin: "https://dev.azure.com/orbModels/OrbModels",
        fontFamily: "Roboto,sans-serif",
        fontSize: "14px",
        alwaysOpenInNewTab: true,
    }

    static promptForMissingConfiguration(): Promise<void> {
        let missingConfigs = [];

        Object.keys(ConfigUtil.defaultConfig).forEach((prop) => {
            if (config.get(prop) == undefined) {
                if (ConfigUtil.defaultConfig[prop] != null) {
                    config.set(prop, ConfigUtil.defaultConfig[prop]);
                } else {
                    missingConfigs.push(prop);
                }
            }
        })

        if (missingConfigs.length == 0) {
            return Promise.resolve();
        }

        return DialogManager.prompt("Configuration", "Some required configuration(s) are missing: ", "*All fields are required", missingConfigs).then((res) => {
            let emptyInputs = [];

            missingConfigs.forEach((missingConfig) => {
                if (res[missingConfig]) {
                    config.set(missingConfig, res[missingConfig]);
                } else {
                    emptyInputs.push(missingConfig);
                }
            });

            if (emptyInputs.length > 0) {
                return ConfigUtil.promptForMissingConfiguration();
            }
        })
    }

    static getModelRepoDir(): string {
        if (!ConfigUtil.modelRepoDir) {
            ConfigUtil.modelRepoDir = config.get("modelRepoDir");
        }

        return ConfigUtil.modelRepoDir;
    }

    static getRemoteOrigin() {
        if (!ConfigUtil.remoteOrigin) {
            ConfigUtil.remoteOrigin = config.get("remoteOrigin");
        }

        return ConfigUtil.remoteOrigin;
    }

    static getFontFamily() {
        if (!ConfigUtil.fontFamily) {
            ConfigUtil.fontFamily = config.get("fontFamily");
        }

        return ConfigUtil.fontFamily;
    }

    static getFontSize() {
        if (!ConfigUtil.fontSize) {
            ConfigUtil.fontSize = config.get("fontSize");
        }

        return ConfigUtil.fontSize;
    }

    static getAlwaysOpenInNewTab(): boolean {
        if (ConfigUtil.alwaysOpenInNewTab == null) {
            ConfigUtil.alwaysOpenInNewTab = config.get("alwaysOpenInNewTab");
        }

        return ConfigUtil.alwaysOpenInNewTab;
    }
}
