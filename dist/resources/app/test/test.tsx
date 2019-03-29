import * as React from "react";
import { should, expect, assert } from "chai";
import { mount, shallow, render } from "enzyme";
import * as sinon from "sinon";
import { Toast } from "../toast/toast";
import { OrbState, StateManager } from "../state/state";
import { TerminalConfigManager } from "../config/terminalConfig";
import { AddressBar } from "../addressBar/addressBar";
import MuiThemeProvider from "material-ui/styles/MuiThemeProvider";
import { Util } from "../util/util";
import { LinkManager } from "../linkManager/linkManager";
import { PersistedState, FileFormatState } from "../state/state";
import { ModelReader } from "../modelReader/modelReader";
import { describe, it } from "mocha";
import * as Promise from "bluebird";
import { ConfigUtil } from "../config/configUtil";
import { remote } from "electron";
import * as path from "path";

const Application = require("spectron").Application;

// Example test case for functional testing.
describe("Array", function () {
    describe("#indexOf()", function () {
        it("should return -1 when the value is not present", function () {
            assert.equal(-1, [1, 2, 3].indexOf(4));
        });
    });
});

describe("UtilTest", function () {
    describe("getParameters", function () {
        it("should return empty", () => {
            let result = Util.getParameters("test string with no parameters");
            assert.equal(0, Object.keys(result).length);
        });

        it("should return 1 parameter", () => {
            let result = Util.getParameters("test string with {one} parameter");
            console.log(result);
            assert.equal(1, Object.keys(result).length);
            assert.isTrue(result["one"]);
        });

        it("should return 5 parameters", () => {
            let result = Util.getParameters("test string with {one} {2} {three} {4} {five} parameters");
            console.log(result);
            assert.equal(5, Object.keys(result).length);
        });
    });
});


// Example test case for component testing.
describe("<Toast>", () => {
    beforeEach(() => {
        this.mockState = {
            open: true,
            message: "test",
            level: "info",
            autoHideDuration: 4000,
            setNotificationRef(notification) { },
            showToast(message: string, level: "success" | "error" | "warning" | "info") { },
            hideToast() { }
        }

        StateManager.getStore();
    })

    it("test componentDidMount called once", () => {
        sinon.spy(Toast.prototype, "componentDidMount");
        const componentWrapper = mount(<Toast inner={this.mockState} />);
        expect((Toast.prototype.componentDidMount as any).calledOnce).to.equal(true);
    });

    it("test notification open", () => {
        const componentWrapper = mount(<Toast inner={this.mockState} />);
        assert.equal((componentWrapper as any).ref("notificationSystem").props().open, true);
    });
})

describe("TerminalConfigManager", () => {
    it("test convertStyleObjectToStr", () => {
        let styleObj1 = {
            "fontSize": "15px",
            "backgroundColor": "rgb(57, 56, 62)",
            "textColor": "rgb(238,237,240)"
        }

        let expectedTerminalStyle = ".terminal {font-size:15px;color:rgb(238,237,240);background-color:rgb(57, 56, 62);}";
        let expectedBodyStyle = "body {font-size:15px;color:rgb(238,237,240);background-color:rgb(57, 56, 62);}";
        let expectedViewportStyle = ".terminal .xterm-viewport {font-size:15px;color:rgb(238,237,240);background-color:rgb(57, 56, 62);}"

        let actualStyle = TerminalConfigManager.convertStyleObjectToCSS(styleObj1);
        assert.equal(actualStyle.length, 3);
        assert.equal(actualStyle[0], expectedTerminalStyle);
        assert.equal(actualStyle[1], expectedBodyStyle);
        assert.equal(actualStyle[2], expectedViewportStyle);
    })
})

describe("<AddressBar>", () => {
    beforeEach(() => {
        this.mockProps = {
            tab: {
                url: "https://test.com",
                icon: "test.png"
            },
            onBackButtonClick: () => { },
            onForwardButtonClick: () => { },
            onRefreshButtonClick: () => { },
            onChange: () => { }
        }
    })

    it("test componentDidMount called once", () => {
        sinon.spy(AddressBar.prototype, "componentDidMount");
        const componentWrapper = mount(<MuiThemeProvider><AddressBar {...this.mockProps} /></MuiThemeProvider>);
        expect((AddressBar.prototype.componentDidMount as any).calledOnce).to.equal(true);
        expect(componentWrapper.find("AddressBar")).to.have.length(1);
    })
})

describe("LinkManager", () => {
    describe("Testing Link Generation", () => {
        it("empty state test ", () => {
            let emptyState: PersistedState = {
                instance: "",
                sideBarWidth: 200,
                searchNamespace: "",
                explorerTrees: [] as any[],
                openTabs: [] as any[],
                explorerTime: {
                    type: "relative",
                    ago: "30d",
                    startTime: "",
                    endTime: ""
                }
            };

            let generationResult = LinkManager.generateLinkData(emptyState);

            // Result should be the same
            assert.deepEqual(generationResult.state, emptyState);

            // No override data
            assert.equal(generationResult.overrideString, "{}");
        });

        it("regular state test", () => {
            let regularState: PersistedState = {
                instance: "",
                sideBarWidth: 200,
                searchNamespace: "",
                explorerTrees: [
                    {
                        objectId: "Networking\\NetMon\\tor\\AMS04-0101-0305-01T0",
                        namespace: "Networking",
                        objectPath: "NetMon\\tor",
                        requiredProps: {
                            "tor": "AMS04-0101-0305-01T0",
                            "Cluster": "AM2PrdApp01"
                        }
                    },
                    {
                        objectId: "Networking\\NetMon\\tor\\AMS04-0101-0305-02T0",
                        namespace: "Networking",
                        objectPath: "NetMon\\tor",
                        requiredProps: {
                            tor: "AMS04-0101-0305-02T0",
                            Cluster: "AM2PrdApp01"
                        }
                    },
                    {
                        objectId: "Networking\\NetMon\\Cluster\\AM2PrdApp01",
                        namespace: "Networking",
                        objectPath: "NetMon\\Cluster",
                        requiredProps: {
                            Cluster: "AM2PrdApp01"
                        },
                        requiredBaseProps: {}
                    }
                ] as any[],
                openTabs: [
                    {
                        type: "explorerResource",
                        objectId: "Networking\\NetMon\\tor\\AMS04-0101-0305-01T0",
                        relativePath: "HighCpuNodes.kusto"
                    },
                    {
                        type: "explorerResource",
                        objectId: "Networking\\NetMon\\tor\\AMS04-0101-0305-02T0",
                        relativePath: "Syslog.kusto"
                    },
                    {
                        type: "explorerResource",
                        objectId: "Networking\\NetMon\\tor\\AMS04-0101-0305-02T0",
                        relativePath: "HighCpuNodes.kusto"
                    },
                    {
                        type: "explorerResource",
                        objectId: "Networking\\NetMon\\Cluster\\AM2PrdApp01",
                        relativePath: "DHCP Rehydration Failure Event.jarvis"
                    }
                ] as any[],
                explorerTime: {
                    type: "relative",
                    ago: "30d",
                    startTime: "",
                    endTime: ""
                }
            }

            let generationResult = LinkManager.generateLinkData(regularState);

            let expectedResult: PersistedState = {
                instance: "",
                sideBarWidth: 200,
                searchNamespace: "",
                explorerTrees: [
                    {
                        objectId: "Networking\\NetMon\\tor\\AMS04-0101-0305-01T0",
                        namespace: "Networking",
                        objectPath: "NetMon\\tor",
                        requiredProps: {
                            "tor": "{tor0}",
                            "Cluster": "{Cluster}"
                        }
                    },
                    {
                        objectId: "Networking\\NetMon\\tor\\AMS04-0101-0305-02T0",
                        namespace: "Networking",
                        objectPath: "NetMon\\tor",
                        requiredProps: {
                            tor: "{tor1}",
                            Cluster: "{Cluster}"
                        }
                    },
                    {
                        objectId: "Networking\\NetMon\\Cluster\\AM2PrdApp01",
                        namespace: "Networking",
                        objectPath: "NetMon\\Cluster",
                        requiredProps: {
                            Cluster: "{Cluster}"
                        },
                        requiredBaseProps: {}
                    }
                ] as any[],
                openTabs: [
                    {
                        type: "explorerResource",
                        objectId: "Networking\\NetMon\\tor\\AMS04-0101-0305-01T0",
                        relativePath: "HighCpuNodes.kusto"
                    },
                    {
                        type: "explorerResource",
                        objectId: "Networking\\NetMon\\tor\\AMS04-0101-0305-02T0",
                        relativePath: "Syslog.kusto"
                    },
                    {
                        type: "explorerResource",
                        objectId: "Networking\\NetMon\\tor\\AMS04-0101-0305-02T0",
                        relativePath: "HighCpuNodes.kusto"
                    },
                    {
                        type: "explorerResource",
                        objectId: "Networking\\NetMon\\Cluster\\AM2PrdApp01",
                        relativePath: "DHCP Rehydration Failure Event.jarvis"
                    }
                ] as any[],
                explorerTime: {
                    type: "relative",
                    ago: "30d",
                    startTime: "",
                    endTime: ""
                }
            }

            assert.deepEqual(generationResult.state, expectedResult);
            assert.equal(generationResult.overrideString, "{'tor0':'AMS04-0101-0305-01T0','Cluster':'AM2PrdApp01','tor1':'AMS04-0101-0305-02T0'}");
        });
    });

    describe("Testing Link Parsing", () => {
        it("link parsing test", () => {
            let linkData: string = "H4sIAAAAAAAAA9VVwW6CQBS8%2BxVkz2oWbS%2B9WdvGHjREvZUeVnnBVWS3bxdbQvj3LiBEiBqb2NjuhccyO2%2FewISkZZlF4EsGAgHnCKDIg%2FWWb2crqaocKBZrWOpXz2DIBPSnwA0Pfdc19ViErqsFuu5gPKN3HWpTu0P79N5Uc0radaKQbUFJtoQ6UxNW9HOYXu1xZZcmEOEj4gieg0JmE9R155DslCFJzJWmjfM5YBhESkMB2tcpqcHS6i5tX9ei3l%2BzyL6hRXvmzKaeg95ASmpf1Z1yjJ87dIEBJ0gfmYKK%2BMClvHovDhEhIZyzxdkM6ljmQ5ehnYISERojjo5%2BhawiBEzzHZQujri%2FGspoIjxQ3Y3xQJALXvrvyj6Sn6bsWawC4f8jwbf1%2BZIQNhU%2FjYaONYVV7KHZF6H1wngQIVjPOwh1d81wxxU58e1XPyG%2BhVr4qpHKdgcyCPNF9qhPvYI3baXfqpjtcdUGAAA%3D?overrides={'tor0':'AMS04-0101-0305-01T0','Cluster':'AM2PrdApp01','tor1':'AMS04-0101-0305-02T0'}";

            let parsedState: FileFormatState = LinkManager.parseLinkString(linkData);

            let expectedResult: FileFormatState = {
                instance: null,
                explorerTrees: [
                    {
                        "objectId": "Networking\\NetMon\\tor\\AMS04-0101-0305-01T0",
                        "namespace": "Networking",
                        "objectPath": "NetMon\\tor",
                        "requiredProps": {
                            "tor": "AMS04-0101-0305-01T0",
                            "Cluster": "AM2PrdApp01"
                        }
                    },
                    {
                        "objectId": "Networking\\NetMon\\tor\\AMS04-0101-0305-02T0",
                        "namespace": "Networking",
                        "objectPath": "NetMon\\tor",
                        "requiredProps": {
                            "tor": "AMS04-0101-0305-02T0",
                            "Cluster": "AM2PrdApp01"
                        }
                    },
                    {
                        "objectId": "Networking\\NetMon\\Cluster\\AM2PrdApp01",
                        "namespace": "Networking",
                        "objectPath": "NetMon\\Cluster",
                        "requiredProps": {
                            "Cluster": "AM2PrdApp01"
                        },
                        "requiredBaseProps": {}
                    }
                ] as any[],
                openTabs: [
                    {
                        type: "explorerResource",
                        objectId: "Networking\\NetMon\\tor\\AMS04-0101-0305-01T0",
                        relativePath: "HighCpuNodes.kusto"
                    },
                    {
                        type: "explorerResource",
                        objectId: "Networking\\NetMon\\tor\\AMS04-0101-0305-02T0",
                        relativePath: "Syslog.kusto"
                    },
                    {
                        type: "explorerResource",
                        objectId: "Networking\\NetMon\\tor\\AMS04-0101-0305-02T0",
                        relativePath: "HighCpuNodes.kusto"
                    },
                    {
                        type: "explorerResource",
                        objectId: "Networking\\NetMon\\Cluster\\AM2PrdApp01",
                        relativePath: "DHCP Rehydration Failure Event.jarvis"
                    }
                ] as any[],
                explorerTime: {
                    type: "relative",
                    ago: "30d",
                    startTime: "",
                    endTime: ""
                }
            };
            delete expectedResult.instance;
            delete expectedResult.explorerTime.startTime;
            delete expectedResult.explorerTime.endTime;

            assert.deepEqual(parsedState, expectedResult);
        });

        it("old link parsing test simple", () => {
            let linkData: string = "H4sIAAAAAAAAA6vmUgACpdSKgpz8otSikKLU1GIlK4XoWB2IRH5Bal5IYhKKGFxxZm4qULwaLAqWKaksAIkoFaXmJJZklqUq6SDkEtPzQVKGGUpgsVquWgDEODU0fAAAAA%3D%3D";

            let parsedState: FileFormatState = LinkManager.parseLinkString(linkData);

            let expectedResult: FileFormatState = {
                instance: null,
                explorerTrees: [] as any[],
                openTabs: [] as any[],
                explorerTime: {
                    type: "relative",
                    ago: "1h",
                    startTime: "",
                    endTime: ""
                }
            };
            delete expectedResult.instance;
            delete expectedResult.explorerTime.startTime;
            delete expectedResult.explorerTime.endTime;

            assert.deepEqual(parsedState, expectedResult);
        });

        it("old link parsing test complex", () => {
            let linkData: string = "H4sIAAAAAAAAA9VVTXOCMBS8%2ByuYnNUJ2l56s7Yde9Bh1FvpIcobiCJJX4Kt4%2FDfG1BQqHXo1OlHTo%2Bw2be7kwfbhmUWgTcZCgScIoAiN9ZTtp2ubVFlQDFbwFw%2FegZDRqBfBS555LuuqYcicl0t0HV7wwm9alGb2i3apdct2plS0iwTRWwFSrI5lJmqsF0%2Fh%2Blgj8u7VIEILzFH8BwUMnVQ1p1B0lOGpIa6DN4PY6Vhf6TjoNeTktqkBEyKp6R52cjsPx3ZR3U%2FGtm%2BTxrbocsl08qNfD2xWhF8QnvLFBTURzll1fPuEBESoimbnZ1SvZGZ7Xysx6BEjCaKk%2Ba%2FlzNCyDRfQx7h3aDvWGMINh6afRFZD4yHMYJ1v4ZItxcM11yRGpfgUiZqz1fVyYD7QV%2FGI%2BGBai9NEuL3ZZ%2F4klZlTzYqFP4%2FEnw259LdL35TfAWl8StM5NxHPQnzRfqqS70db9JI3gH78iPj9wYAAA%3D%3D";

            let parsedState: FileFormatState = LinkManager.parseLinkString(linkData);

            let expectedResult: FileFormatState = {
                instance: null,
                explorerTrees: [
                    {
                        objectId: "Networking\\NetMon\\tor\\AMS04-0101-0305-02T0",
                        namespace: "Networking",
                        objectPath: "NetMon\\tor",
                        requiredProps: {
                            "tor": "AMS04-0101-0305-02T0",
                            "Cluster": "AM2PrdApp01"
                        }
                    },
                    {
                        objectId: "Networking\\NetMon\\tor\\AMS04-0101-0305-01T0",
                        namespace: "Networking",
                        objectPath: "NetMon\\tor",
                        requiredProps: {
                            tor: "AMS04-0101-0305-01T0",
                            Cluster: "AM2PrdApp01"
                        }
                    },
                    {
                        objectId: "Networking\\NetMon\\Cluster\\AM2PrdApp01",
                        namespace: "Networking",
                        objectPath: "NetMon\\Cluster",
                        requiredProps: {
                            Cluster: "AM2PrdApp01"
                        },
                        requiredBaseProps: {}
                    }
                ] as any[],
                openTabs: [
                    {
                        type: "explorerResource",
                        objectId: "Networking\\NetMon\\Cluster\\AM2PrdApp01",
                        relativePath: "DHCP Rehydration Failure Event.jarvis"
                    },
                    {
                        type: "explorerResource",
                        objectId: "Networking\\NetMon\\tor\\AMS04-0101-0305-01T0",
                        relativePath: "HighCpuNodes.kusto"
                    },
                    {
                        type: "explorerResource",
                        objectId: "Networking\\NetMon\\tor\\AMS04-0101-0305-02T0",
                        relativePath: "Syslog.kusto"
                    },
                    {
                        type: "explorerResource",
                        objectId: "Networking\\NetMon\\tor\\AMS04-0101-0305-02T0",
                        relativePath: "HighCpuNodes.kusto"
                    }
                ] as any[],
                explorerTime: {
                    type: "relative",
                    ago: "30d",
                    startTime: "",
                    endTime: ""
                }
            }
            delete expectedResult.instance;
            delete expectedResult.explorerTime.startTime;
            delete expectedResult.explorerTime.endTime;

            assert.deepEqual(parsedState, expectedResult);
        });
    });
})

describe("ModelReader - validateObjectToBeMerged", () => {
    beforeEach(() => {
        ModelReader.getOrbSetting = (settingName: string) => {
            return Promise.resolve(true);
        };

        ConfigUtil.modelRepoDir = path.join(remote.app.getPath("userData"), "OrbModels");
    })

    it("Test validateObjectToBeMerged failed for namespaceConfig protected resource", () => {
        let namespaceConfig = {
            name: "testNamespace",
            resourceProfiles: [
                {
                    name: "testResource",
                    type: "powershell"
                }
            ]
        }

        ModelReader.validateObjectProtectionBeforeMerge(namespaceConfig as any, "test").then((res) => {
            assert(!res.result);
            assert(res.errorMessage == "The resource profile: testResource for namespace: testNamespace needs to be moved to a protected model")
        })
    })

    it("Test validateObjectToBeMerged succeed for namespaceConfig non-protected resource", () => {
        let namespaceConfig = {
            name: "testNamespace",
            resourceProfiles: [
                {
                    name: "testResource",
                    type: "kusto"
                }
            ]
        }

        ModelReader.validateObjectProtectionBeforeMerge(namespaceConfig as any, "test").then((res) => {
            assert(res.result);
            assert(res.errorMessage == "");
        })
    })

    it("Test validateObjectToBeMerged failed for protected constructor", () => {
        let obj = {
            path: "testPath",
            constructor: {
                "type": "powershell",
                "powershellProfile": "demops",
                "script": "test script"
            }
        }

        ModelReader.validateObjectProtectionBeforeMerge(obj as any, "test").then((res) => {
            assert(!res.result);
            assert(res.errorMessage == "The constructor for object: testPath needs to be moved to a protected model")
        })
    })

    it("Test validateObjectToBeMerged failed for protected additional props", () => {
        let obj = {
            "namespace": "testNamespace",
            "path": "testPath",
            "additionalProps": [
                {
                    "name": "gf",
                    "type": "constant",
                    "value": "testConstant"
                },
                {
                    "name": ["TestVar"],
                    "type": "powershell",
                    "script": "New-Object -TypeName PSObject -Prop (@{'LeastFavoriteNumber'=Get-Random})"
                },

            ]
        }

        ModelReader.validateObjectProtectionBeforeMerge(obj as any, "test").then((res) => {
            assert(!res.result);
            assert(res.errorMessage == "The additional prop: TestVar for object: testPath needs to be moved to a protected model")
        })
    })

    it("Test validateObjectToBeMerged failed for protected resources", () => {
        let obj = {
            "namespace": "testNamespace",
            "path": "testPath",
            "resources": [
                {
                    "type": "psmd",
                    "relativePath": "testPath1",
                    "powershellProfile": "FcShell",
                    "description": "",
                    "script": "script"
                },
                {
                    "type": "psx",
                    "relativePath": "testPath2",
                    "powershellProfile": "DebugBot",
                    "script": "script",
                    "showInContextMenu": "true"
                },
                {
                    "type": "terminal",
                    "relativePath": "testPath3",
                    "powershellProfile": "FcShellFull",
                    "script": "script"
                }
            ]
        }

        ModelReader.validateObjectProtectionBeforeMerge(obj as any, "test").then((res) => {
            assert(!res.result);
            const expectedErrorMessage = [
                "The resource: testPath1 for object: testPath needs to be moved to a protected model",
                "The resource: testPath2 for object: testPath needs to be moved to a protected model",
                "The resource: testPath3 for object: testPath needs to be moved to a protected model"
            ]
            assert(res.errorMessage == expectedErrorMessage.join("."))
        })
    })

    it("Test validateObjectToBeMerged succeed", () => {
        let obj = {
            "namespace": "testNamespace",
            "path": "testPath",
            "requiredProps": [
                "Region"
            ],
            "key": "Region",
            "constructor": {
                "type": "kusto",
                "connectionProfile": "ACMKusto",
                "query": "LogClusterSnapshot | where {timeRange} | where Region != \"\" and Region =~ \"{Region}\" | take 1 | project Region",
                "wildcardQuery": "LogClusterSnapshot | where {timeRange} | where Region != \"\" and Region matches regex \"{Region}\" | summarize by Region",
                "minimumResolutionInMinutes": 120
            },
            "resources": [
                {
                    "type": "jarvis",
                    "relativePath": "Health\\Region EKG",
                    "description": "",
                    "link": "https://jarvis-west.dc.ad.msft.net/dashboard/AzureComputeManager/Fabricator/RegionEKG?overrides=[{\"query\":\"//*[id='Region']\",\"key\":\"value\",\"replacement\":\"{Region}\"}]%20"
                }
            ],
            "associations": [
                {
                    "type": "kusto",
                    "relativePath": "Fabrics\\All",
                    "associatedObjectPath": "FC\\Fabric",
                    "description": "",
                    "connectionProfile": "ACMKusto",
                    "query": "LogClusterSnapshot | where {timeRange} | where Region != \"\" and Region =~ \"{Region}\" | summarize by Tenant",
                    "minimumResolutionInMinutes": 120
                },
                {
                    "type": "kusto",
                    "relativePath": "Fabrics\\PrdApp",
                    "associatedObjectPath": "FC\\Fabric",
                    "description": "",
                    "connectionProfile": "ACMKusto",
                    "query": "LogClusterSnapshot | where {timeRange} | where Region != \"\" and Region =~ \"{Region}\" and Tenant contains \"PrdApp\" | summarize by Tenant",
                    "minimumResolutionInMinutes": 120
                }
            ]
        }

        ModelReader.validateObjectProtectionBeforeMerge(obj as any, "test").then((res) => {
            assert(res.result);
            assert(res.errorMessage == "");
        })
    })
})

describe("ModelReader - mergeJsonObjects", () => {
    beforeEach(() => {
        ModelReader.getOrbSetting = (settingName: string) => {
            return Promise.resolve(true);
        };

        ConfigUtil.modelRepoDir = path.join(remote.app.getPath("userData"), "OrbModels");
    })

    it("Test mergeJsonObjects throws exception when namespace conflicted", () => {
        let a = {
            name: "testNamespace"
        }

        let b = {
            name: "testNamespace"
        }

        try {
            ModelReader.mergeJsonObjects(a, b);
        } catch (e) {
            assert(e == "Conflicting resource encountered on property: name");
        }
    })

    it("Test mergeJsonObjects throws exception when requiredProps conflicted", () => {
        let a = {
            "namespace": "Compute",
            "path": "FC\\Fabric",
            "requiredProps": [
                "Tenant"
            ]
        }

        let b = {
            "requiredProps": [
                "Tenant"
            ]
        }

        try {
            ModelReader.mergeJsonObjects(a, b);
        } catch (e) {
            assert(e == "Duplicated requiredProps found: Tenant");
        }
    })

    it("Test mergeJsonObjects throws exception when constructor conflicted", () => {
        let a = {
            "namespace": "Compute",
            "path": "FC\\Fabric",
            "requiredProps": [
                "Tenant"
            ],
            "constructor": {
                "type": "kusto",
                "connectionProfile": "ACMKusto",
                "query": "TMMgmtFabricSettingEtwTable  | where {timeRange} and Tenant =~ \"{Tenant}\" | take 1 | project Tenant",
                "wildcardQuery": "TMMgmtFabricSettingEtwTable  | where {timeRange} and Tenant matches regex \"{Tenant}\" | summarize by Tenant",
                "minimumResolutionInMinutes": 45
            }
        }

        let b = {
            "constructor": {
                "type": "kusto",
                "connectionProfile": "ACMKusto",
                "query": "TMMgmtFabricSettingEtwTable  | where {timeRange} and Tenant =~ \"{Tenant}\" | take 1 | project Tenant",
                "wildcardQuery": "TMMgmtFabricSettingEtwTable  | where {timeRange} and Tenant matches regex \"{Tenant}\" | summarize by Tenant",
                "minimumResolutionInMinutes": 45
            }
        }

        try {
            ModelReader.mergeJsonObjects(a, b);
        } catch (e) {
            assert(e == "Conflicting resource encountered on property: type");
        }
    })

    it("Test mergeJsonObjects throws exception when additional conflicted", () => {
        let a = {
            "namespace": "Compute",
            "path": "FC\\Fabric",
            "requiredProps": [
                "Tenant"
            ],
            "constructor": {
                "type": "kusto",
                "connectionProfile": "ACMKusto",
                "query": "TMMgmtFabricSettingEtwTable  | where {timeRange} and Tenant =~ \"{Tenant}\" | take 1 | project Tenant",
                "wildcardQuery": "TMMgmtFabricSettingEtwTable  | where {timeRange} and Tenant matches regex \"{Tenant}\" | summarize by Tenant",
                "minimumResolutionInMinutes": 45
            },
            "additionalProps": [
                {
                    "name": ["VfpAccount", "VNETAccount"],
                    "type": "kusto",
                    "connectionProfile": "ACMKusto",
                    "query": "LogNodeSnapshot  | where {timeRange} and Tenant =~ \"{Tenant}\" | sort by PreciseTimeStamp desc | take 1 | extend SnapshotTime= PreciseTimeStamp |   join kind= inner (cluster(\"https://aznw.kusto.windows.net:443/\").database(\"aznwmds\").MdmVfpVnetAccountMaps) on $left.Tenant==$right.Cluster  | project VfpAccount, VNETAccount",
                    "minimumResolutionInMinutes": 120
                }
            ]
        }

        let b = {
            "additionalProps": [
                {
                    "name": ["VfpAccount", "VNETAccount"],
                    "type": "kusto",
                    "connectionProfile": "ACMKusto",
                    "query": "LogNodeSnapshot  | where {timeRange} and Tenant =~ \"{Tenant}\" | sort by PreciseTimeStamp desc | take 1 | extend SnapshotTime= PreciseTimeStamp |   join kind= inner (cluster(\"https://aznw.kusto.windows.net:443/\").database(\"aznwmds\").MdmVfpVnetAccountMaps) on $left.Tenant==$right.Cluster  | project VfpAccount, VNETAccount",
                    "minimumResolutionInMinutes": 120
                }
            ]
        }

        try {
            ModelReader.mergeJsonObjects(a, b);
        } catch (e) {
            assert(e == "Duplicated additional props found: VfpAccount,VNETAccount");
        }
    })

    it("Test mergeJsonObjects throws exception when resource conflicted", () => {
        let a = {
            "namespace": "Compute",
            "path": "FC\\Fabric",
            "requiredProps": [
                "Tenant"
            ],
            "constructor": {
                "type": "kusto",
                "connectionProfile": "ACMKusto",
                "query": "TMMgmtFabricSettingEtwTable  | where {timeRange} and Tenant =~ \"{Tenant}\" | take 1 | project Tenant",
                "wildcardQuery": "TMMgmtFabricSettingEtwTable  | where {timeRange} and Tenant matches regex \"{Tenant}\" | summarize by Tenant",
                "minimumResolutionInMinutes": 45
            },
            "additionalProps": [
                {
                    "name": ["VfpAccount", "VNETAccount"],
                    "type": "kusto",
                    "connectionProfile": "ACMKusto",
                    "query": "LogNodeSnapshot  | where {timeRange} and Tenant =~ \"{Tenant}\" | sort by PreciseTimeStamp desc | take 1 | extend SnapshotTime= PreciseTimeStamp |   join kind= inner (cluster(\"https://aznw.kusto.windows.net:443/\").database(\"aznwmds\").MdmVfpVnetAccountMaps) on $left.Tenant==$right.Cluster  | project VfpAccount, VNETAccount",
                    "minimumResolutionInMinutes": 120
                }
            ],
            "resources": [
                {
                    "type": "jarvis",
                    "relativePath": "IDNS\\FrontEnd\\Dashboard",
                    "description": "",
                    "link": "https://jarvis-west.dc.ad.msft.net/dashboard/WaiiDns/PlatformMetrics/Control%2520Plane?overrides=[{%22query%22:%22//*[id=%27Tenant%27]%22,%22key%22:%22value%22,%22replacement%22:%22idns0-stage-CH1StageApp01%22},{%22query%22:%22//*[id=%27Datacenter%27]%22,%22key%22:%22value%22,%22replacement%22:%22CH1%22}]%20"
                }
            ]
        }

        let b = {
            "resources": [
                {
                    "type": "jarvis",
                    "relativePath": "IDNS\\FrontEnd\\Dashboard ",
                    "description": "",
                    "link": "https://jarvis-west.dc.ad.msft.net/dashboard/WaiiDns/PlatformMetrics/Control%2520Plane?overrides=[{%22query%22:%22//*[id=%27Tenant%27]%22,%22key%22:%22value%22,%22replacement%22:%22idns0-stage-CH1StageApp01%22},{%22query%22:%22//*[id=%27Datacenter%27]%22,%22key%22:%22value%22,%22replacement%22:%22CH1%22}]%20"
                }
            ]
        }

        try {
            ModelReader.mergeJsonObjects(a, b);
        } catch (e) {
            assert(e == "Duplicated resource or association found: IDNS\\FrontEnd\\Dashboard.jarvis");
        }
    })

    it("Test mergeJsonObjects throws exception when association conflicted", () => {
        let a = {
            "namespace": "Compute",
            "path": "FC\\Fabric",
            "requiredProps": [
                "Tenant"
            ],
            "constructor": {
                "type": "kusto",
                "connectionProfile": "ACMKusto",
                "query": "TMMgmtFabricSettingEtwTable  | where {timeRange} and Tenant =~ \"{Tenant}\" | take 1 | project Tenant",
                "wildcardQuery": "TMMgmtFabricSettingEtwTable  | where {timeRange} and Tenant matches regex \"{Tenant}\" | summarize by Tenant",
                "minimumResolutionInMinutes": 45
            },
            "additionalProps": [
                {
                    "name": ["VfpAccount", "VNETAccount"],
                    "type": "kusto",
                    "connectionProfile": "ACMKusto",
                    "query": "LogNodeSnapshot  | where {timeRange} and Tenant =~ \"{Tenant}\" | sort by PreciseTimeStamp desc | take 1 | extend SnapshotTime= PreciseTimeStamp |   join kind= inner (cluster(\"https://aznw.kusto.windows.net:443/\").database(\"aznwmds\").MdmVfpVnetAccountMaps) on $left.Tenant==$right.Cluster  | project VfpAccount, VNETAccount",
                    "minimumResolutionInMinutes": 120
                }
            ],
            "resources": [
                {
                    "type": "jarvis",
                    "relativePath": "IDNS\\FrontEnd\\Dashboard",
                    "description": "",
                    "link": "https://jarvis-west.dc.ad.msft.net/dashboard/WaiiDns/PlatformMetrics/Control%2520Plane?overrides=[{%22query%22:%22//*[id=%27Tenant%27]%22,%22key%22:%22value%22,%22replacement%22:%22idns0-stage-CH1StageApp01%22},{%22query%22:%22//*[id=%27Datacenter%27]%22,%22key%22:%22value%22,%22replacement%22:%22CH1%22}]%20"
                }
            ],
            "associations": [
                {
                    "type": "kusto",
                    "relativePath": "Tenants",
                    "associatedObjectPath": "FC\\Tenant",
                    "description": "",
                    "connectionProfile": "ACMKusto",
                    "query": "LogContainerSnapshot | where {timeRange} and tenantName != \"\" and Tenant =~ \"{Tenant}\" | summarize by tenantName, Tenant",
                    "minimumResolutionInMinutes": 120
                }
            ]
        }

        let b = {
            "associations": [
                {
                    "type": "kusto",
                    "relativePath": "Tenants",
                    "associatedObjectPath": "FC\\Tenant",
                    "description": "",
                    "connectionProfile": "ACMKusto",
                    "query": "LogContainerSnapshot | where {timeRange} and tenantName != \"\" and Tenant =~ \"{Tenant}\" | summarize by tenantName, Tenant",
                    "minimumResolutionInMinutes": 120
                }
            ]
        }

        try {
            ModelReader.mergeJsonObjects(a, b);
        } catch (e) {
            assert(e == "Duplicated resource or association found: Tenants.kusto");
        }
    })

    it("Test mergeJsonObjects succeed", () => {
        let a = {
            "namespace": "testNamespace",
            "path": "testPath",
            "requiredProps": [
                "testProps1"
            ],
            "additionalProps": [
                {
                    "name": ["VfpAccount"],
                    "type": "kusto",
                    "connectionProfile": "ACMKusto",
                    "query": "kusto1",
                    "minimumResolutionInMinutes": 120
                }
            ],
            "resources": [
                {
                    "type": "jarvis",
                    "relativePath": "test1",
                    "description": "",
                    "link": "link1"
                }
            ],
            "associations": [
                {
                    "type": "kusto",
                    "relativePath": "test1",
                    "associatedObjectPath": "FC\\Tenant",
                    "description": "",
                    "connectionProfile": "ACMKusto",
                    "query": "query1",
                    "minimumResolutionInMinutes": 120
                }
            ]
        }

        let b = {
            "constructor": {
                "type": "kusto",
                "connectionProfile": "ACMKusto",
                "query": "constructorQuery"
            },
            "requiredProps": [
                "testProps2"
            ],
            "additionalProps": [
                {
                    "name": ["VNETAccount"],
                    "type": "kusto",
                    "connectionProfile": "ACMKusto",
                    "query": "kusto2",
                    "minimumResolutionInMinutes": 120
                }
            ],
            "resources": [
                {
                    "type": "jarvis",
                    "relativePath": "test2",
                    "description": "",
                    "link": "link2"
                }
            ],
            "associations": [
                {
                    "type": "kusto",
                    "relativePath": "test2",
                    "associatedObjectPath": "FC\\Tenant",
                    "description": "",
                    "connectionProfile": "ACMKusto",
                    "query": "query2",
                    "minimumResolutionInMinutes": 120
                }
            ]
        }

        ModelReader.mergeJsonObjects(a, b);
        assert(a.namespace == "testNamespace");
        assert(a.path == "testPath");
        assert(a.requiredProps.length == 2);
        assert(a.requiredProps[0] = "testProps1");
        assert(a.requiredProps[1] = "testProps2");
        assert(a.additionalProps.length == 2);
        assert(a.additionalProps[0].name.toString() == "VfpAccount");
        assert(a.additionalProps[1].name.toString() == "VNETAccount");
        assert(a.resources.length == 2);
        assert(a.resources[0].relativePath == "test1");
        assert(a.resources[1].relativePath == "test2");
        assert(a.associations.length == 2);
        assert(a.associations[0].relativePath == "test1");
        assert(a.associations[1].relativePath == "test2");
    })
})

// Do not use arrow function if you want to change the default timeout.
// https://github.com/mochajs/mocha/issues/2018
// This test will throw timeoutsAsyncScript deprecated warning, the fix is on the way.
// https://github.com/electron/spectron/pull/184
// Currently, this is not working on build server.
// describe("<App>", function () {
//     it("test application launch within 60 seconds", function (done) {
//         this.timeout(60000);
//         let env = {
//             NODE_ENV: "test"
//         }

//         let dir = __dirname + "/../../../orb.exe";

//         let app = new Application({
//             path: dir,
//             env: env
//         });

//         console.log("Launch application", dir);

//         app.start().then(() => {
//             console.log("Application started");
//             return app.browserWindow.isVisible()
//         }).then((isVisible) => {
//             assert.equal(isVisible, true);
//         }).then(() => {
//             app.webContents.on("did-fail-load", (event, url) => {
//                 throw "Application failed to load" + event;
//             })
//         }).catch((e) => {
//             console.log(e);
//         }).then(() => {
//             return app.stop();
//         }).then(() => {
//             done();
//         })
//     })
// })