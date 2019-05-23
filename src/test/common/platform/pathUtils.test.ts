// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

"use strict";
import { expect } from "chai";
import * as path from "path";
import { PathUtils } from "../../../client/common/platform/pathUtils";
import { getOSType, OSType } from "../../common";

suite("PathUtils", () => {
    let utils: PathUtils;
    suiteSetup(() => {
        utils = new PathUtils(getOSType() === OSType.Windows);
    });
    test("Path Separator", () => {
        expect(utils.separator).to.be.equal(path.sep);
    });
});
