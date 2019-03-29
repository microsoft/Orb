import * as m from "Model";
import { remote, ipcRenderer } from "electron";
import { StateManager, Constants, TabRequest } from '../state/state';
import { TerminalResourceProvider } from '../extensions/resourceProviders/resources/terminal';
import { ModelReader } from "../modelReader/modelReader";
import { TreeGenerator } from "../Explorer/TreeGenerator";
import { EditorCtrl } from "../editor/editorCtrl";

const Config = require('electron-config');
const config = new Config();

let log = require("loglevel");

interface TerminalConfig {
    default: string;
    resources: m.PowershellResource[]
}

interface TerminalStyle {
    fontSize?: string;
    backgroundColor?: string;
    textColor?: string;
}

export class TerminalConfigManager {
    private static cachedTerminalConfig: TerminalConfig;
    private static defaultTerminalResource: m.PowershellResource;
    private static rp: TerminalResourceProvider;
    private static terminalMenu: Electron.Menu
    private static editorUrl;

    static initialize() {

        TerminalConfigManager.editorUrl = Constants.editorUrl.format("", "", config.path, "", "", "");

        // TODO: Move this outside the terminal config editor if more config gets added.
        ipcRenderer.on("config-open-editor", (event, arg) => {
            let editorUrl = Constants.editorUrl.format("", "", config.path, "", "", "");

            EditorCtrl.instance().openEditor({
                title: "config.json",
                url: TerminalConfigManager.editorUrl,
                onSavedChangesCallback: () => {
                    TerminalConfigManager.clearCache();
                }
            });
        });

        TerminalConfigManager.getConfig();
    }

    static getTerminalMenu(): Electron.Menu {
        if (!TerminalConfigManager.terminalMenu) {
            let menu = remote.Menu.buildFromTemplate([]);

            EditorCtrl.instance().appendEditorOption(menu, TerminalConfigManager.editorUrl, 'config.json', 'Edit', null, () => {
                TerminalConfigManager.clearCache();
            })

            let terminalConfig = TerminalConfigManager.getConfig();

            TreeGenerator.addResourcesToContextMenu(
                menu,
                terminalConfig.resources,
                r => {
                    let psResource = r as m.PowershellResource;
                    TerminalConfigManager.openTerminalForResource(psResource);
                },
                r => {
                    if (r.relativePath === terminalConfig.default) {
                        return "Default";
                    }
                    return null;
                }
            );

            TerminalConfigManager.terminalMenu = menu;
        }

        return TerminalConfigManager.terminalMenu;
    }

    static launchTerminal(relativePath) {
        let terminalConfig = TerminalConfigManager.getConfig();
        if (terminalConfig.resources) {
            let matchingResource = terminalConfig.resources.find(r => r.relativePath.toLowerCase() === relativePath.toLowerCase());
            if (!matchingResource) {
                log.error("Could not find terminal resource with path " + relativePath);
            } else {
                TerminalConfigManager.openTerminalForResource(matchingResource);
            }
        }
    }

    static launchDefaultTerminal() {
        let terminalConfig = TerminalConfigManager.getConfig();

        if (TerminalConfigManager.defaultTerminalResource) {
            TerminalConfigManager.openTerminalForResource(TerminalConfigManager.defaultTerminalResource);
        } else {
            TerminalConfigManager.openTerminal(Constants.terminalUrl);
        }
    }

    static getStyle(relativePath): string[] {
        let terminalConfig = TerminalConfigManager.getConfig();
        let style = {};
        terminalConfig.resources.some(resource => {
            if (resource.relativePath === relativePath) {
                style = resource.style;
                return true;
            }

            return false;
        })

        return TerminalConfigManager.convertStyleObjectToCSS(style);
    }

    static getLaunchParameters(relativePath): string {
        let terminalConfig = TerminalConfigManager.getConfig();
        let launchParameters: string = "";
        terminalConfig.resources.some(resource => {
            if (resource.relativePath === relativePath) {
                if (resource.launchParameters) {
                    launchParameters = resource.launchParameters;
                    return true;
                }
            }

            return false;
        })

        return launchParameters;
    }

    static convertStyleObjectToCSS(styleObj: TerminalStyle): string[] {
        let styles = [];

        let tempStyle = "";
        if (styleObj.fontSize) {
            tempStyle += "font-size:" + styleObj.fontSize + ";";
        }

        if (styleObj.textColor) {
            tempStyle += "color:" + styleObj.textColor + ";";
        }

        if (styleObj.backgroundColor) {
            tempStyle += "background-color:" + styleObj.backgroundColor + ";";
        }

        if (tempStyle) {
            styles.push(".terminal {" + tempStyle + "}");
            styles.push("body {" + tempStyle + "}");
            styles.push(".terminal .xterm-viewport {" + tempStyle + "}");
        }

        return styles;
    }

    private static clearCache() {
        TerminalConfigManager.defaultTerminalResource = null;
        TerminalConfigManager.cachedTerminalConfig = null;
        TerminalConfigManager.terminalMenu = null;
    }

    private static openTerminalForResource(resource: m.PowershellResource) {
        let termUrl = Constants.terminalUrl;
        let params = "relativePath={0}".format(resource.relativePath);

        if (resource.powershellProfile) {
            ModelReader.getResourceProfile(resource.namespace, resource.powershellProfile)
                .then(profile => {
                    let psProfile = profile as m.PowershellProfile;
                    termUrl = TerminalConfigManager.rp.getTerminalUrl(resource.script, psProfile, params);
                    TerminalConfigManager.openTerminal(termUrl, resource.relativePath, "Terminal\\" + resource.relativePath);
                });
        } else {
            termUrl = TerminalConfigManager.rp.getTerminalUrl(resource.script, null, params);
            TerminalConfigManager.openTerminal(termUrl, resource.relativePath, "Terminal\\" + resource.relativePath);
        }
    }

    private static openTerminal(url: string, title?: string, tooltip?: string) {
        let store = StateManager.getStore();
        let tab: TabRequest = {
            url: url,
            title: title ? title : "Terminal",
            openInNew: true,
            icon: "./extensions/resourceProviders/img/terminal.png",
            tooltip: tooltip ? tooltip : "Terminal",
            isForegroundTab: true
        }
        store.tabManager.inner.openTab(tab);
    }

    private static getConfig(): TerminalConfig {
        if (!TerminalConfigManager.cachedTerminalConfig) {
            TerminalConfigManager.cachedTerminalConfig = config.get("terminalConfig");
            if (!TerminalConfigManager.cachedTerminalConfig || !TerminalConfigManager.cachedTerminalConfig.resources || TerminalConfigManager.cachedTerminalConfig.resources.length === 0) {
                TerminalConfigManager.cachedTerminalConfig = <TerminalConfig>{
                    default: "PowerShell",
                    resources: [{ relativePath: "PowerShell", namespace: "", powershellProfile: "", script: "" }]
                };
                config.set("terminalConfig", TerminalConfigManager.cachedTerminalConfig);
            }
        }

        let setConfig = false;

        TerminalConfigManager.cachedTerminalConfig.resources.forEach((resource) => {
            if (!resource.style) {
                setConfig = true;
                resource.style = {
                    "fontSize": "15px",
                    "backgroundColor": "rgb(57, 56, 62)",
                    "textColor": "rgb(238,237,240)"
                }
            }
        })

        if (setConfig) {
            config.set("terminalConfig", TerminalConfigManager.cachedTerminalConfig);
        }

        TerminalConfigManager.rp = new TerminalResourceProvider("terminal");

        if (TerminalConfigManager.cachedTerminalConfig.resources && TerminalConfigManager.cachedTerminalConfig.default) {
            TerminalConfigManager.defaultTerminalResource = TerminalConfigManager.cachedTerminalConfig.resources.find(r => r.relativePath === TerminalConfigManager.cachedTerminalConfig.default);
        }

        return TerminalConfigManager.cachedTerminalConfig;
    }
}