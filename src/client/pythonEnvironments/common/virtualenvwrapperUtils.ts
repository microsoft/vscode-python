// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as path from 'path';
import { getOSType, getUserHomeDir, OSType } from '../../common/utils/platform';

export function getDefaultVirtualenvwrapperDir(): string {
    const homeDir = getUserHomeDir() || '';

    // In Windows, the default path for WORKON_HOME is %USERPROFILE%\Envs.
    if (getOSType() === OSType.Windows) {
        return path.join(homeDir, 'Envs');
    }
    return path.join(homeDir, '.virtualenvs');
}
