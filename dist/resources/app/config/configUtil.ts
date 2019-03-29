const Config = require('electron-config');
const config = new Config();
import * as path from "path";
import { remote } from "electron";

export class ConfigUtil {
    private static modelRepoDir: string;
    private static remoteOrigin: string;
    private static fontFamily: string;
    private static fontSize: string;
    private static reuseSlbShell: boolean;
    private static alwaysOpenInNewTab: boolean;

    static getModelRepoDir(): string {
        if (!ConfigUtil.modelRepoDir) {
            if (!config.get("modelRepoDir")) {
                const modelRepoDir = path.join(remote.app.getPath("userData"), "OrbModels");
                config.set("modelRepoDir", modelRepoDir);
            }

            ConfigUtil.modelRepoDir = config.get("modelRepoDir");
        }

        return ConfigUtil.modelRepoDir;
    }

    static getRemoteOrigin() {
        if (!ConfigUtil.remoteOrigin) {
            if (!config.get("remoteOrigin")) {
                config.set("remoteOrigin", "https://msazure.visualstudio.com/One/_git/Azure-OrbModels/");
            }

            ConfigUtil.remoteOrigin = config.get("remoteOrigin");
        }

        return ConfigUtil.remoteOrigin;
    }

    static getFontFamily() {
        if (!ConfigUtil.fontFamily) {
            if (!config.get("fontFamily")) {
                config.set("fontFamily", "Roboto,sans-serif");
            }

            ConfigUtil.fontFamily = config.get("fontFamily");
        }

        return ConfigUtil.fontFamily;
    }

    static getFontSize() {
        if (!ConfigUtil.fontSize) {
            if (!config.get("fontSize")) {
                config.set("fontSize", "14px");
            }

            ConfigUtil.fontSize = config.get("fontSize");
        }

        return ConfigUtil.fontSize;
    }

    static getReuseSlbShell(): boolean {
        if (ConfigUtil.reuseSlbShell == null) {
            if (config.get("reuseSlbShell") == null) {
                config.set("reuseSlbShell", false);
            }

            ConfigUtil.reuseSlbShell = config.get("reuseSlbShell");
        }

        return ConfigUtil.reuseSlbShell;
    }

    static getAlwaysOpenInNewTab(): boolean {
        if (ConfigUtil.alwaysOpenInNewTab == null) {
            if (config.get("alwaysOpenInNewTab") == null) {
                config.set("alwaysOpenInNewTab", true);
            }

            ConfigUtil.alwaysOpenInNewTab = config.get("alwaysOpenInNewTab");
        }

        return ConfigUtil.alwaysOpenInNewTab;
    }
}
