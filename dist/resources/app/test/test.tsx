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
    });
})

describe("ModelReader - validateObjectToBeMerged", () => {
    beforeEach(() => {
        ModelReader.getOrbSetting = (settingName: string) => {
            return Promise.resolve(true);
        };

        ConfigUtil.Settings.modelRepoDir = path.join(remote.app.getPath("userData"), "OrbModels");
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

        return ModelReader.validateObjectProtectionBeforeMerge(namespaceConfig as any, "test").then((res) => {
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

        return ModelReader.validateObjectProtectionBeforeMerge(namespaceConfig as any, "test").then((res) => {
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

        return ModelReader.validateObjectProtectionBeforeMerge(obj as any, "test").then((res) => {
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

        return ModelReader.validateObjectProtectionBeforeMerge(obj as any, "test").then((res) => {
            assert(!res.result);
            assert(res.errorMessage == "The additional prop: gf for object: testPath needs to be moved to a protected model.The additional prop: TestVar for object: testPath needs to be moved to a protected model");
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
                    "powershellProfile": "CustomizedShell",
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
                    "powershellProfile": "CustomizedShell",
                    "script": "script"
                }
            ]
        }

        return ModelReader.validateObjectProtectionBeforeMerge(obj as any, "test").then((res) => {
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
                "connectionProfile": "Orb",
                "query": "VMSnapshot | where {timeRange} | where Region != \"\" and Region =~ \"{Region}\" | take 1 | project Region",
                "wildcardQuery": "VMSnapshot | where {timeRange} | where Region != \"\" and Region matches regex \"{Region}\" | summarize by Region",
                "minimumResolutionInMinutes": 120
            },
            "resources": [
                {
                    "type": "link",
                    "relativePath": "Health\\Dummy",
                    "description": "",
                    "link": "http:\\dummyLink"
                }
            ],
            "associations": [
                {
                    "type": "kusto",
                    "relativePath": "Cloud\\All",
                    "associatedObjectPath": "Compute\\VM",
                    "description": "",
                    "connectionProfile": "Orb",
                    "query": "VMSnapshot | where {timeRange} | where Region != \"\" and Region =~ \"{Region}\" | summarize by VMId",
                    "minimumResolutionInMinutes": 120
                },
                {
                    "type": "kusto",
                    "relativePath": "Cloud\\Production",
                    "associatedObjectPath": "Compute\\Host",
                    "description": "",
                    "connectionProfile": "ACMKusto",
                    "query": "HostSnapshot | where {timeRange} | where Region != \"\" and Region =~ \"{Region}\" | summarize by HostId",
                    "minimumResolutionInMinutes": 120
                }
            ]
        }

        return ModelReader.validateObjectProtectionBeforeMerge(obj as any, "test").then((res) => {
            assert(res.result);
            assert(res.errorMessage == "");
        })
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