// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as fs from 'fs-extra';
import * as os from 'os';
import * as semver from 'semver';
import { LINUX_OS_RELEASE_FILE } from './constants';
import { OSDistro, OSInfo, OSType } from './types';

let local: OSInfo;

function getLocal(): OSInfo {
    if (!local) {
        local = getOSInfo();
    }
    return local;
}

export function isWindows(info?: OSInfo): boolean {
    if (!info) {
        info = getLocal();
    }
    return info.type === OSType.Windows;
}

export function isMac(info?: OSInfo): boolean {
    if (!info) {
        info = getLocal();
    }
    return info.type === OSType.OSX;
}

export function isLinux(info?: OSInfo): boolean {
    if (!info) {
        info = getLocal();
    }
    return info.type === OSType.Linux;
}

export function is64bit(info?: OSInfo): boolean {
    if (!info) {
        info = getLocal();
    }
    return info.arch === 'x64';
}

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
    readFile: (string) => string = (filename) => {
        return fs.readFileSync(filename, 'utf8');
    },
    getArch: () => string = os.arch,
    platform?: string
): OSInfo {
    const osType = getOSType(platform);
    const arch = getArch();
    switch (osType) {
        case OSType.Windows:
            return defaultOSInfo(osType, arch);
        case OSType.OSX:
            return defaultOSInfo(osType, arch);
        case OSType.Linux:
            return linuxInfoFromFile(arch, readFile);
        default:
            return new OSInfo(OSType.Unknown, arch);
    }
}

function defaultOSInfo(osType: OSType, arch: string): OSInfo {
    const version = parseVersion(os.release());
    return new OSInfo(osType, arch, version);
}

// Inspired in part by: https://github.com/juju/os
function linuxInfoFromFile(
    arch: string,
    readFile: (string) => string
): OSInfo {
    let distroNames: string[];
    let rawVer: string;
    try {
        [distroNames, rawVer] = readOSReleaseFile(readFile);
    } catch (exc) {
        // tslint:disable-next-line: no-suspicious-comment
        // TODO: Only mask exception if file not found?
        return new OSInfo(OSType.Linux, arch);
    }

    const version = parseVersion(rawVer);
    let distro = OSDistro.Unknown;
    for (const name of distroNames) {
        if (distro !== OSDistro.Unknown) {
            break;
        }
        if (name !== '') {
            distro = linuxDistroFromName(name);
        }
    }

    return new OSInfo(OSType.Linux, arch, version, distro);
}

function readOSReleaseFile(
    readFile: (string) => string
): [string[], string] {
    const filename = LINUX_OS_RELEASE_FILE;
    const data = readFile(filename);

    let distroName = '';
    let distroNames: string[] = [];
    let rawVer = '';
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
                    distroNames = names;
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
    // Insert at the front.  This guarantees that there is always at
    // least one item in the array.  If no name was found then the empty
    // string will indicate that to the caller.
    distroNames.splice(0, 0, distroName);

    return [distroNames, rawVer];
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
