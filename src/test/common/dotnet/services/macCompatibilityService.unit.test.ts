// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

"use strict";

import { expect } from "chai";
import { SemVer } from "semver";
import { instance, mock, when } from "ts-mockito";
import { MacDotNetCompatibilityService } from "../../../../client/common/dotnet/services/macCompatibilityService";
import { PlatformService } from "../../../../client/common/platform/platformService";

suite("DOT.NET", () => {
    suite("Mac", () => {
        async function testSupport(
            version: string,
            expectedValueForIsSupported: boolean
        ) {
            const platformService = mock(PlatformService);
            const service = new MacDotNetCompatibilityService(
                instance(platformService)
            );

            when(platformService.getVersion()).thenResolve(new SemVer(version));

            const result = await service.isSupported();
            expect(result).to.be.equal(
                expectedValueForIsSupported,
                "Invalid value"
            );
        }
        test("Supported on 16.0.0", () => testSupport("16.0.0", true));
        test("Supported on 16.0.0", () => testSupport("16.0.1", true));
        test("Supported on 16.0.0", () => testSupport("16.1.0", true));
        test("Supported on 16.0.0", () => testSupport("17.0.0", true));

        test("Supported on 16.0.0", () => testSupport("15.0.0", false));
        test("Supported on 16.0.0", () => testSupport("15.9.9", false));
        test("Supported on 16.0.0", () => testSupport("14.0.0", false));
        test("Supported on 16.0.0", () => testSupport("10.12.0", false));
    });
});
