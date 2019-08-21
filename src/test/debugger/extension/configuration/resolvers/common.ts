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

export function iterOSes(): [
    string,  // OS name
    OSType,
    IPathModule,
    // setUpMocks()
    (
        platformService: TypeMoq.IMock<IPlatformService>
    ) => void
][] {
    return getNamesAndValues(OSType)
        .map(os => {
            const osType = os.value as OSType;

            let pathMod: IPathModule = path;
            if (osType !== OS_TYPE) {
                pathMod = osType === OSType.Windows
                    ? path.win32
                    : path.posix;
            }

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
