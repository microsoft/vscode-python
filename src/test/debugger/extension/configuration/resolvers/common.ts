// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as TypeMoq from 'typemoq';
import { IPlatformService } from '../../../../../client/common/platform/types';
import { OSType } from '../../../../../client/common/utils/platform';

export function emulateOS(
    osType: OSType,
    platformService: TypeMoq.IMock<IPlatformService>
) {
    platformService.setup(p => p.isWindows)
        .returns(() => osType === OSType.Windows);
    platformService.setup(p => p.isMac)
        .returns(() => osType === OSType.OSX);
    platformService.setup(p => p.isLinux)
        .returns(() => osType === OSType.Linux);
}
