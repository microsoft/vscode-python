// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as TypeMoq from 'typemoq';
import { IPlatformService } from '../../../../../client/common/platform/types';
import { getNamesAndValues } from '../../../../../client/common/utils/enum';
import { OSType } from '../../../../../client/common/utils/platform';

export function iterOSes(): [
    string,  // OS name
    OSType,
    // setUpMocks()
    (
        platformService: TypeMoq.IMock<IPlatformService>
    ) => void
][] {
    return getNamesAndValues(OSType)
        .map(os => {
            const osType = os.value as OSType;
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
                setUpMocks
            ];
        });
}
