// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

"use strict";

import { expect } from "chai";
import { UnknownOSDotNetCompatibilityService } from "../../../../client/common/dotnet/services/unknownOsCompatibilityService";

suite("DOT.NET", () => {
    suite("Unknown", () => {
        test("Not supported", async () => {
            const service = new UnknownOSDotNetCompatibilityService();
            const result = await service.isSupported();
            expect(result).to.be.equal(false, "Invalid value");
        });
    });
});
