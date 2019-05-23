
import * as m from "Model";
import * as path from "path";
import * as React from "react";
import * as ReactDOM from "react-dom";
import * as Promise from "bluebird";
import AppBar from "material-ui/AppBar";
import TextField from "material-ui/TextField";
import RaisedButton from "material-ui/RaisedButton";
import { ipcRenderer, remote } from "electron";
import AutoComplete from "material-ui/AutoComplete";
import { ModelReader } from "../modelReader/modelReader";
import getMuiTheme from "material-ui/styles/getMuiTheme";
import MuiThemeProvider from "material-ui/styles/MuiThemeProvider";
import * as injectTapEventPluginExport from "react-tap-event-plugin";
import darkBaseTheme from "material-ui/styles/baseThemes/darkBaseTheme";
import { ConfigUtil } from "../config/configUtil";
import Chip from "material-ui/Chip";
import { ResourceProviderSelector } from "../extensions/resourceProviders/resourceProviderSelector";
const fs = require("fs");
const fsExtra = require("fs-extra");
const jsonfile = require("jsonfile");

const readJson: any = Promise.promisify(fsExtra.readJson);

class Props {
    theme: any;
}

class State {
    resourceJson: string;
    namespaceDataSrc: string[];
    pathDataSrc: string[];
    connectionProfileDataSrc: string[];
    connectionProfile: string;
    hint: any;
    namespace: string;
    path: string;
    filePathSrc: string[];
    filePath: string;
    resourceTypeSrc: string[];
    allowTypeSelection: boolean;
    resourceType: string;
}

class TrieNode {
    public val: string;
    public index: number;
    public child: { [key: string]: TrieNode };

    constructor(val: string, index: number) {
        this.val = val;
        this.index = index;
        this.child = {};
    }
}

class Trie {

    private root: TrieNode;

    constructor() {
        this.root = new TrieNode(" ", -1);
    }

    public insertString(val: string, index: number): void {
        let node: TrieNode = this.root;
        for (let i = 0; i < val.length; i++) {
            let candidate = val.charAt(i);
            if (!node.child[candidate]) {
                node.child[candidate] = new TrieNode(candidate, index);
            }

            node = node.child[candidate];
        }
    }

    public getIndex(val: string): number {
        let node: TrieNode = this.root;
        let index: number = 0;
        while (Object.keys(node.child).length != 0 && index < val.length) {
            let ch = val.charAt(index++);
            if (!node.child[ch]) {
                return node.index + 1;
            }

            node = node.child[ch];
        }

        return node.index + 1;
    }
}

export class ResourceEditor extends React.Component<Props, State> {

    contextHint: any;
    modelDir: string
    objectProps;
    addNewResource: boolean;
    originalRelativePath: string;
    originalResourceScript: string;

    constructor(props) {
        super(props);
        this.handleSaveClick = this.handleSaveClick.bind(this);
        this.handleChipClick = this.handleChipClick.bind(this);
        this.handleTextFieldChange = this.handleTextFieldChange.bind(this);
        this.renderResourceType = this.renderResourceType.bind(this);
        this.state = {
            resourceJson: null,
            namespaceDataSrc: [],
            pathDataSrc: [],
            connectionProfileDataSrc: [],
            connectionProfile: "",
            hint: null,
            namespace: "",
            path: "",
            filePathSrc: [],
            filePath: "",
            resourceTypeSrc: [],
            resourceType: "",
            allowTypeSelection: false,
        }

        this.contextHint = null;
        this.objectProps = [];
        this.modelDir = ConfigUtil.GetSetting("modelRepoDir").replace(/\\/g, "/") + "/";
        document.title = "Resource Editor";
        ipcRenderer.on("context-received", (event, arg: {
            fromClipboard: boolean,
            resourceInfo: any,
            addNewResource: boolean
        }) => {
            if (arg) {
                let allowTypeSelection = arg.fromClipboard;

                ModelReader.getNameSpaces().then((namespaceConfigArray) => {
                    let namespaceDataSrc = [];

                    namespaceConfigArray.forEach((namespaceConfig) => {
                        namespaceDataSrc.push(namespaceConfig.name);
                    });

                    this.handleNamespaceChangeInternal(arg.resourceInfo.namespace, false).then(() => {
                        this.handlePathChange(arg.resourceInfo.path, arg.resourceInfo.namespace);
                    });

                    let resource = arg.resourceInfo.resource;
                    if (arg.fromClipboard) {
                        this.originalResourceScript = resource;
                        resource = this.generateResourceFromClipboard(resource);
                    }

                    let resourceObj = JSON.parse(resource);
                    const hint = <p style={{
                        color: "white",
                        fontSize: 13.5,
                        fontFamily: "Roboto, sans-serif",
                        fontWeight: "normal"
                    }}>We have pre-populated the object, modifying it if this is not the place you want to place your resource.</p>;

                    this.addNewResource = arg.addNewResource;
                    this.originalRelativePath = resourceObj.relativePath;

                    this.setState({
                        namespaceDataSrc: namespaceDataSrc,
                        resourceJson: JSON.stringify(resourceObj, null, "    "),
                        namespace: arg.resourceInfo.namespace,
                        path: arg.resourceInfo.path,
                        allowTypeSelection: allowTypeSelection,
                        resourceType: resourceObj.type,
                        hint: hint,
                        connectionProfile: resourceObj.connectionProfile
                    });
                });
            }
        })
    }

    generateResourceFromClipboard(resource, resourceType = "link") {
        let kustoRegex = /.\|/gi;

        if (resource.indexOf("jarvis-west.dc.ad.msft.net") != -1) {
            resourceType = "dgrep";
            if (resource.indexOf("dashboard") != -1) {
                resourceType = "jarvis";
                if (resource.indexOf("overrides=") == -1) {
                    alert("If you need dashboard overrides replaced, make sure you add the override on the jarvis dashboard with any value.");
                }
            }
        } else if (kustoRegex.test(resource)) {
            resourceType = "kusto";
        }

        return this.handleResourceTypeUpdate(resource, resourceType);
    }

    handleResourceTypeUpdate(resource, resourceType): string {
        const resourceProvider = ResourceProviderSelector.getResourceProvider({ type: resourceType } as any);
        return resourceProvider.createResource(resource);
    }

    componentWillMount() {
        ResourceProviderSelector.getResourceTypes().then((types) => {
            this.setState({
                resourceTypeSrc: types,
            })
        })
    }

    validateResource(resource: string, filePath: string): { result: boolean, message: string } {
        let res = {
            result: false,
            message: ""
        }

        let json: m.Resource;
        try {
            json = JSON.parse(resource) as m.Resource;
            ModelReader.validateResourceProtection(json, filePath);
        } catch (e) {
            res.message = e;
            return res;
        }

        if (!json.relativePath) {
            res.message = "Please specify the relative path.";
        } else {
            res.result = true;
        }

        return res;
    }

    handleTextFieldChange(e: React.FormEvent<any>, newValue: string) {
        this.setState({
            resourceJson: newValue,
            hint: this.contextHint
        })
    }

    handleNamespaceChange(text: string) {
        if (this.state.namespaceDataSrc.length > 0 && this.state.namespaceDataSrc.indexOf(text) != -1) {
            this.handleNamespaceChangeInternal(text);
        }
    }

    handleNamespaceChangeInternal(text: string, setDefaultConnectionProfile = true): Promise<any> {
        this.setState({
            namespace: text,
        });

        return ModelReader.getNameSpace(text).then((namespaceConfig) => {
            const connectionProfileDataSrc = [];
            namespaceConfig.resourceProfiles.forEach((resourceProfile) => {
                if (resourceProfile.type === this.state.resourceType) {
                    connectionProfileDataSrc.push(resourceProfile.name);
                }
            });

            return ModelReader.getObjectDefinitions(text).then((objectDefinitionMap) => {
                let pathDataSrc = Object.keys(objectDefinitionMap);
                this.setState({
                    pathDataSrc: pathDataSrc,
                    path: pathDataSrc[0],
                    connectionProfileDataSrc: connectionProfileDataSrc,
                });

                if (setDefaultConnectionProfile && connectionProfileDataSrc.length > 0) {
                    this.handleConnectionProfileChange(connectionProfileDataSrc[0]);
                }
            });
        }).catch((e) => {
            alert(e);
        })
    }

    handleChipClick(text: string) {
        const input = (this.refs["TextField"] as any).input.refs.input;
        const value = input.value;
        if (input.selectionStart && input.selectionEnd) {
            const newResourceJson = value.slice(0, input.selectionStart) + "{" + text + "}" + value.slice(input.selectionEnd);
            if (newResourceJson) {
                this.setState({
                    resourceJson: newResourceJson,
                });
            }
        }
    }

    handlePathChange(text: string, namespace: string) {
        if (this.state.pathDataSrc.length > 0 && this.state.pathDataSrc.indexOf(text) != -1) {
            let requiredBaseProps = [];
            let additionalProps = [];
            let requiredProps = [];

            this.setState({
                path: text,
            });

            ModelReader.getNameSpace(namespace).then((namespaceConfig) => {
                if (namespaceConfig.requiredBaseProps && namespaceConfig.requiredBaseProps.length > 0) {
                    namespaceConfig.requiredBaseProps.forEach((requiredBaseProp) => {
                        requiredBaseProps.push(requiredBaseProp.name);
                    })
                }

                return ModelReader.getObjectDefinition(namespace, text).then((objectDefinition) => {
                    let filePathSrc = [];
                    objectDefinition.filePaths.forEach((filePath) => {
                        filePathSrc.push(filePath.replace(this.modelDir, ""));
                    })

                    this.setState({
                        filePathSrc: filePathSrc,
                        filePath: filePathSrc[0]
                    })

                    if (objectDefinition.original.additionalProps && objectDefinition.original.additionalProps.length > 0) {
                        objectDefinition.original.additionalProps.forEach((additionalProp) => {
                            if (Array.isArray(additionalProp.name)) {
                                additionalProps = additionalProps.concat(additionalProp.name);
                            } else {
                                additionalProps.push(additionalProp.name)
                            }
                        })
                    }

                    if (Array.isArray(objectDefinition.original.requiredProps)) {
                        requiredProps = requiredProps.concat(objectDefinition.original.requiredProps);
                    }

                    let globalContextVariables = [];
                    if (this.state.resourceType === "kusto") {
                        globalContextVariables = globalContextVariables.concat(["startTime", "endTime", "timeRange"]);
                    }

                    this.contextHint = (
                        <div>
                            <p style={{
                                color: "white",
                                fontSize: 13.5,
                                fontFamily: "Roboto, sans-serif",
                                fontWeight: "normal"
                            }}>Props available for use (Click Prop to replace selected text): </p>
                            <div style={
                                {
                                    display: 'flex',
                                    flexWrap: 'wrap'
                                }
                            }>
                                {
                                    requiredProps.map((prop, key) =>
                                        <Chip
                                            className={"chip"}
                                            onClick={() => this.handleChipClick(prop)}
                                            style={{ margin: 4 }}
                                            key={key}
                                        >
                                            {prop}
                                        </Chip>)
                                }
                                {
                                    globalContextVariables.map((prop, key) =>
                                        <Chip
                                            className={"chip"}
                                            onClick={() => this.handleChipClick(prop)}
                                            style={{ margin: 4 }}
                                            key={key}
                                        >
                                            {prop}
                                        </Chip>
                                    )
                                }
                                {
                                    requiredBaseProps.map((prop, key) =>
                                        <Chip
                                            className={"chip"}
                                            onClick={() => this.handleChipClick(prop)}
                                            style={{ margin: 4 }}
                                            key={key}
                                        >
                                            {prop}
                                        </Chip>)
                                }
                                {
                                    additionalProps.map((prop, key) =>
                                        <Chip
                                            className={"chip"}
                                            onClick={() => this.handleChipClick(prop)}
                                            style={{ margin: 4 }}
                                            key={key}
                                        >
                                            {prop}
                                        </Chip>
                                    )
                                }

                            </div>
                        </div>)

                    this.setState({
                        hint: this.contextHint,
                    });

                    this.objectProps = this.objectProps.concat(requiredBaseProps);
                    this.objectProps = this.objectProps.concat(additionalProps);
                    this.objectProps = this.objectProps.concat(requiredProps);
                    this.objectProps = this.objectProps.concat(globalContextVariables);
                });
            }).catch((e) => {
                alert(e);
            })
        }
    }

    removeOriginalResourceIfNeeded(): Promise<void> {
        if (this.addNewResource) {
            return Promise.resolve();
        }

        let fullPath = "";
        let newFileContent = null;

        for (let i = 0; i < this.state.filePathSrc.length; i++) {
            const filePath = path.join(this.modelDir, this.state.filePathSrc[i]);
            const fileContent = fsExtra.readJsonSync(filePath);
            let resources = fileContent.resources;
            let indexToRemove = -1;

            for (let j = 0; j < resources.length; j++) {
                if (resources[j].relativePath == this.originalRelativePath) {
                    indexToRemove = j;
                    break;
                }
            }

            if (indexToRemove > -1) {
                resources.splice(indexToRemove, 1);
                fileContent.resources = resources;
                newFileContent = fileContent;
                fullPath = filePath;
                break;
            }
        }

        if (!fullPath || !newFileContent) {
            return Promise.resolve();
        }

        return new Promise<void>((resolve, reject) => {
            jsonfile.writeFile(fullPath, newFileContent, { spaces: 4 }, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        })
    }

    handleSaveClick(): Promise<any> {
        if (!this.state.filePath) {
            alert("Please select a file to save");
            return Promise.resolve(false);
        }

        let fullPath = path.join(this.modelDir, this.state.filePath);
        let res = this.validateResource(this.state.resourceJson, fullPath);
        if (!res.result) {
            alert(res.message);
            return Promise.resolve(false);
        }

        return new Promise<any>((resolve, reject) => {
            let shouldToastWarning = true;
            for (let i = 0; i < this.objectProps.length; i++) {
                if (this.state.resourceJson.indexOf("{{0}}".format(this.objectProps[i])) != -1) {
                    shouldToastWarning = false;
                }
            }

            if (shouldToastWarning) {
                remote.dialog.showMessageBox({
                    message: "Do you want to continue without consuming any props?",
                    buttons: ["Yes", "No"]
                }, (buttonIndex) => {
                    switch (buttonIndex) {
                        case 0:
                            resolve(true);
                            break;
                        case 1:
                        default:
                            resolve(false);
                    }
                });
            } else {
                resolve(true);
            }
        }).then((shouldSave) => {
            if (shouldSave) {
                return this.removeOriginalResourceIfNeeded().then(() => {
                    return readJson(fullPath).then((fileContent) => {
                        let newResource;

                        try {
                            let newResource: m.Resource = JSON.parse(this.state.resourceJson);
                            let trie: Trie = new Trie();
                            fileContent.resources.forEach((resource: m.Resource, index: number) => {
                                if (resource && resource.relativePath) {
                                    trie.insertString(resource.relativePath.toLocaleLowerCase(), index);
                                }
                            })

                            let index: number = trie.getIndex(newResource.relativePath.toLocaleLowerCase());
                            fileContent.resources.splice(index, 0, newResource);
                            return new Promise<boolean>((resolve, reject) => {
                                jsonfile.writeFile(fullPath, fileContent, { spaces: 4 }, (err) => {
                                    if (err) {
                                        reject(err);
                                    } else {
                                        resolve(true);
                                    }
                                });
                            })
                        } catch (e) {
                            throw "Invalid json format: " + e.toString();
                        }
                    })
                }).catch(e => {
                    alert(e);
                });
            } else {
                return false;
            }
        });
    }

    handleConnectionProfileChange(text) {
        if (text) {
            let resourceObj;
            try {
                resourceObj = JSON.parse(this.state.resourceJson);
            } catch (e) {
                alert(e);
                throw e;
            }

            resourceObj.connectionProfile = text;
            this.setState({
                resourceJson: JSON.stringify(resourceObj, null, "    "),
                connectionProfile: text
            });
        }
    }

    renderConnectionProfile() {
        if (this.state.connectionProfileDataSrc.length == 0) {
            return null;
        }

        return (
            <AutoComplete
                hintText="Connection Profile"
                menuStyle={{ overflowY: "auto", maxHeight: "30vh" }}
                filter={AutoComplete.noFilter}
                dataSource={this.state.connectionProfileDataSrc}
                onUpdateInput={(text: string) => {
                    this.handleConnectionProfileChange(text);
                }}
                floatingLabelText="Connection Profile"
                searchText={this.state.connectionProfile}
                openOnFocus={true}
                fullWidth={true}
            />);
    }

    renderResourceType() {
        return (
            <AutoComplete
                hintText="Select Resource Type"
                menuStyle={{ overflowY: "auto", maxHeight: "30vh" }}
                filter={AutoComplete.noFilter}
                disabled={!this.state.allowTypeSelection}
                dataSource={this.state.resourceTypeSrc}
                onUpdateInput={(text: string) => {
                    if (this.state.resourceTypeSrc.indexOf(text) != -1) {
                        const resource = this.handleResourceTypeUpdate(this.originalResourceScript, text);
                        this.setState({
                            resourceJson: JSON.stringify(JSON.parse(resource), null, "    "),
                            resourceType: text
                        });

                        this.handleNamespaceChangeInternal(this.state.namespace);
                    }
                }}
                floatingLabelText="Select ResourceType"
                openOnFocus={true}
                searchText={this.state.resourceType}
                fullWidth={true}
            />);
    }

    renderFileSelection() {
        if (this.state.filePathSrc.length == 0) {
            return null;
        }

        return (
            <AutoComplete
                hintText="Select File"
                menuStyle={{ overflowY: "auto", maxHeight: "30vh" }}
                filter={AutoComplete.noFilter}
                dataSource={this.state.filePathSrc}
                searchText={this.state.filePath}
                onUpdateInput={(text: string) => {
                    if (this.state.filePathSrc.indexOf(text) != -1) {
                        this.setState({
                            filePath: text
                        });
                    }
                }}
                floatingLabelText="Select File"
                openOnFocus={true}
                fullWidth={true}
            />);
    }

    render() {
        return (
            <MuiThemeProvider muiTheme={this.props.theme}>
                <div>
                    <div style={{ paddingLeft: 20, paddingRight: 20, maxHeight: 800, minHeight: 800, overflow: 'auto' }}>
                        <AutoComplete
                            hintText="Namespace"
                            floatingLabelText="Namespace"
                            menuStyle={{ overflowY: "auto", maxHeight: "75vh" }}
                            filter={AutoComplete.noFilter}
                            dataSource={this.state.namespaceDataSrc}
                            onUpdateInput={(text: string) => {
                                this.handleNamespaceChange(text);
                            }}
                            searchText={this.state.namespace}
                            openOnFocus={true}
                            fullWidth={true}
                        />
                        <AutoComplete
                            hintText="Object Path"
                            menuStyle={{ overflowY: "auto", maxHeight: "30vh" }}
                            filter={AutoComplete.noFilter}
                            dataSource={this.state.pathDataSrc}
                            onUpdateInput={(text: string) => {
                                this.handlePathChange(text, this.state.namespace);
                            }}
                            floatingLabelText="Object Path"
                            searchText={this.state.path}
                            openOnFocus={true}
                            fullWidth={true}
                        />
                        {this.renderConnectionProfile()}
                        {this.renderResourceType()}
                        {this.renderFileSelection()}
                        <div style={{ height: 20 }} />
                        <label style={{
                            color: "white",
                            fontSize: 13.5,
                            fontFamily: "Roboto, sans-serif",
                            fontWeight: "normal"
                        }}>Resource JSON:</label>
                        <TextField
                            id={"ResourceJSON"}
                            ref={"TextField"}
                            rows={8}
                            fullWidth={true}
                            multiLine={true}
                            value={this.state.resourceJson}
                            textareaStyle={{
                                overflowWrap: "normal",
                                background: "rgb(30,30,30)",
                                color: "white"
                            }}
                            underlineShow={false}
                            onChange={this.handleTextFieldChange}
                        />
                        {this.state.hint}

                    </div>
                    <div style={{
                        left: 10,
                        bottom: 30,
                        height: 30,
                        paddingTop: 10,
                        width: "100%",
                        textAlign: "right",
                    }}>
                        <RaisedButton
                            buttonStyle={{ backgroundColor: "rgb(109, 109, 109)" }}
                            onClick={() => this.handleSaveClick().then((shouldClose) => {
                                if (shouldClose) {
                                    ipcRenderer.send("resourceEditor-saved-callback");
                                    window.close();
                                }
                            })}
                            style={{ marginLeft: 10, float: "right" }}
                            labelStyle={{ color: "white" }}
                            label="Save" />
                        <RaisedButton
                            style={{ float: "right" }}
                            onClick={() => {
                                window.close();
                            }}
                            labelStyle={{ color: "white" }}
                            label="Cancel"
                            backgroundColor={"rgb(109, 109, 109)"} />
                    </div>
                </div >
            </MuiThemeProvider >
        )
    }
}

injectTapEventPluginExport();
Promise.config({ cancellation: true });
let theme = getMuiTheme(darkBaseTheme);
theme.textField.focusColor = "rgb(255,255,255)";
ReactDOM.render(<ResourceEditor theme={theme} />, document.getElementById("react-app"));