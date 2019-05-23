// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

"use strict";

import { expect } from "chai";
import { WindowsDotNetCompatibilityService } from "../../../../client/common/dotnet/services/windowsCompatibilityService";

suite("DOT.NET", () => {
    suite("Windows", () => {
        test("Windows is Supported", async () => {
            const service = new WindowsDotNetCompatibilityService();
            const result = await service.isSupported();
            expect(result).to.be.equal(true, "Invalid value");
        });
    });
});
