// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as fs from 'fs';
import * as os from 'os';
import * as semver from 'semver';
import { LINUX_OS_RELEASE_FILE } from './constants';
import { OSDistro, OSInfo, OSType } from './types';

export function getOSType(platform: string = process.platform): OSType {
    if (/^win/.test(platform)) {
        return OSType.Windows;
    } else if (/^darwin/.test(platform)) {
        return OSType.OSX;
    } else if (/^linux/.test(platform)) {
        return OSType.Linux;
    } else {
        return OSType.Unknown;
    }
}

export function getOSInfo(
    getArch: () => string = os.arch
): OSInfo {
    const osType = getOSType();
    const arch = getArch();
    switch (osType) {
        case OSType.Windows:
            return defaultOSInfo(osType, arch);
        case OSType.OSX:
            return defaultOSInfo(osType, arch);
        case OSType.Linux:
            return linuxInfoFromFile(arch);
        default:
            return new OSInfo(OSType.Unknown, arch);
    }
}

function defaultOSInfo(osType: OSType, arch: string): OSInfo {
    const version = parseVersion(os.release());
    return new OSInfo(osType, arch, version);
}

// Inspired in part by: https://github.com/juju/os
function linuxInfoFromFile(arch: string, filename: string = LINUX_OS_RELEASE_FILE): OSInfo {
    if (!fs.existsSync(filename)) {
        return new OSInfo(OSType.Linux, arch);
    }

    let distroName = '';
    let distroLike: string[] = [];
    let rawVer = '';
    const data = fs.readFileSync(filename, 'utf-8');
    for (const line of data.split(/\n/)) {
        const parts = line.split('=', 2);
        switch (parts[0]) {
            case 'ID':
                distroName = parts[1];
                break;
            case 'VERSION_ID':
                rawVer = parts[1];
                break;

            // fallbacks
            case 'NAME':
                if (distroName === '') {
                    distroName = parts[1];
                }
                break;
            case 'ID_LIKE':
                const names = parts[1].split(/ /);
                if (names) {
                    distroLike = names;
                }
                break;
            case 'VERSION':
                if (rawVer === '') {
                    rawVer = parts[1];
                }
                break;
            default:
        }
    }
    const version = parseVersion(rawVer);
    let distro = linuxDistroFromName(distroName);
    while (distro === OSDistro.Unknown && distroLike.length > 0) {
        const name = distroLike.pop();
        if (name) {
            distro = linuxDistroFromName(name);
        }
    }
    return new OSInfo(OSType.Linux, arch, version, distro);
}

function linuxDistroFromName(name: string): OSDistro {
    name = name.toLowerCase();
    // See https://github.com/zyga/os-release-zoo.
    if (/ubuntu/.test(name)) {
        return OSDistro.Ubuntu;
    } else if (/debian/.test(name)) {
        return OSDistro.Debian;
    } else if (/rhel/.test(name) || /red hat/.test(name)) {
        return OSDistro.RHEL;
    } else if (/fedora/.test(name)) {
        return OSDistro.Fedora;
    } else if (/centos/.test(name)) {
        return OSDistro.CentOS;
    }

    // The remainder aren't officially supported by VS Code.
    if (/suse/.test(name)) {
        return OSDistro.Suse;
    } else if (/gentoo/.test(name)) {
        return OSDistro.Suse;
    } else if (/arch/.test(name)) {
        return OSDistro.Arch;
    } else {
        return OSDistro.Unknown;
    }
}

function parseVersion(raw: string): semver.SemVer {
    const ver = semver.coerce(raw);
    if (ver === null || !semver.valid(ver)) {
        // tslint:disable-next-line: no-suspicious-comment
        // TODO: Raise an exception instead?
        return new semver.SemVer('0.0.0');
    }
    return ver;
}
