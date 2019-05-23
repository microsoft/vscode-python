// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

"use strict";

import { expect } from "chai";
import { instance, mock, when } from "ts-mockito";
import { LinuxDotNetCompatibilityService } from "../../../../client/common/dotnet/services/linuxCompatibilityService";
import { PlatformService } from "../../../../client/common/platform/platformService";

suite("DOT.NET", () => {
    suite("Linux", () => {
        async function testSupport(
            expectedValueForIsSupported: boolean,
            is64Bit: boolean
        ) {
            const platformService = mock(PlatformService);
            const service = new LinuxDotNetCompatibilityService(
                instance(platformService)
            );

            when(platformService.is64bit).thenReturn(is64Bit);

            const result = await service.isSupported();
            expect(result).to.be.equal(
                expectedValueForIsSupported,
                "Invalid value"
            );
        }
        test("Linux 64 bit is supported", async () => {
            await testSupport(true, true);
        });
        test("Linux 64 bit is not supported", async () => {
            await testSupport(false, false);
        });
    });
});
