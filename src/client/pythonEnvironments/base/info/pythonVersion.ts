// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { PythonReleaseLevel, PythonVersion } from '.';
import { EMPTY_VERSION, parseBasicVersionInfo } from '../../../common/utils/version';

export function parseVersion(versionStr: string): PythonVersion {
    const parsed = parseBasicVersionInfo<PythonVersion>(versionStr);
    if (!parsed) {
        if (versionStr === '') {
            return EMPTY_VERSION as PythonVersion;
        }
        throw Error(`invalid version ${versionStr}`);
    }
    const { version, after } = parsed;
    const match = after.match(/^(a|b|rc)(\d+)$/);
    if (match) {
        const [, levelStr, serialStr] = match;
        let level: PythonReleaseLevel;
        if (levelStr === 'a') {
            level = PythonReleaseLevel.Alpha;
        } else if (levelStr === 'b') {
            level = PythonReleaseLevel.Beta;
        } else if (levelStr === 'rc') {
            level = PythonReleaseLevel.Candidate;
        } else {
            throw Error('unreachable!');
        }
        version.release = {
            level,
            serial: parseInt(serialStr, 10),
        };
    }
    return version;
}
