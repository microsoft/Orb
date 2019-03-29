import * as m from "Model";
import * as path from "path";
import {
    IResourceProvider,
    BaseResourceProvider,
    IResourceHandleContext,
    ContentManagerSetUrl,
    HandleResourceResult
} from "./resourceProviders/ResourceProvider";
import { IResourceExternalContext, ExtensionState, ExtensionPoints } from "./commonInterfaces";
import * as Promise from "bluebird";
import { ResourceProviderHelper } from "./resourceProviders/helper";
import { Util } from "../util/util";
import { Constants } from "../state/state";

export class ExtensionResourceProvider extends BaseResourceProvider {

    extensionState: ExtensionState;
    action: ExtensionPoints;
    extensionDirectory: string;

    constructor(extensionState: ExtensionState) {
        super(extensionState);
        let action = extensionState.extensionPoints.filter((action) => action.type === "resourceProvider")[0];
        this.extensionState = extensionState;
        let extensionDirectory = path.join(Constants.extensionApps, extensionState.folder);

    }

    handleResource(
        contextualizedResource: string,
        resource: m.Resource,
        objectDefintion: m.ParsedObjectDefinition,
        handleContext: IResourceHandleContext,
        contentManagerSetUrl: ContentManagerSetUrl): HandleResourceResult {
        contentManagerSetUrl(path.join("file:", this.extensionDirectory), null, true);

        return {};
    }
}

