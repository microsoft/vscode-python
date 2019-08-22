// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { IPlatformService } from '../../../../../client/common/platform/types';
import { getNamesAndValues } from '../../../../../client/common/utils/enum';
import { getOSType, OSType } from '../../../../../client/common/utils/platform';

const OS_TYPE = getOSType();

interface IPathModule {
    sep: string;
    dirname(path: string): string;
    join(...paths: string[]): string;
}

// The set of helpers, related to a target OS, that are available to
// tests.  The target OS is not necessarily the native OS.
type OSTestHelpers = [
    string,  // OS name
    OSType,
    IPathModule,
    // setUpMocks()
    (
        platformService: TypeMoq.IMock<IPlatformService>
    ) => void
];

// For each supported OS, provide a set of helpers to use in tests.
export function iterOSes(): OSTestHelpers[] {
    return getNamesAndValues(OSType)
        .map(os => {
            const osType = os.value as OSType;

            // Decide which "path" module to use.
            // By default we use the regular module.
            let pathMod: IPathModule = path;
            if (osType !== OS_TYPE) {
                // We are testing a different OS from the native one.
                // So use a "path" module matching the target OS.
                pathMod = osType === OSType.Windows
                    ? path.win32
                    : path.posix;
            }

            // Generate the function to use for populating the
            // relevant mocks relative to the target OS.
            function setUpMocks(
                platformService: TypeMoq.IMock<IPlatformService>
            ) {
                platformService.setup(p => p.isWindows)
                    .returns(() => osType === OSType.Windows);
                platformService.setup(p => p.isMac)
                    .returns(() => osType === OSType.OSX);
                platformService.setup(p => p.isLinux)
                    .returns(() => osType === OSType.Linux);
            }

            return [
                os.name,
                osType,
                pathMod,
                setUpMocks
            ];
        });
}
