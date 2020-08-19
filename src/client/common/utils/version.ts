// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as semver from 'semver';

/**
 * basic version information
 */
export type VersionInfo = {
    major: number;
    minor: number;
    micro: number;
};

/**
 * basic version information
 *
 * @prop raw - the unparsed version string, if any
 */
export type Version = VersionInfo & {
    raw?: string;
};

export function parseVersion(raw: string): semver.SemVer {
    raw = raw.replace(/\.00*(?=[1-9]|0\.)/, '.');
    const ver = semver.coerce(raw);
    if (ver === null || !semver.valid(ver)) {
        // tslint:disable-next-line: no-suspicious-comment
        // TODO: Raise an exception instead?
        return new semver.SemVer('0.0.0');
    }
    return ver;
}
