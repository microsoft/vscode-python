// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as getos from 'getos';
import * as os from 'os';
import * as semver from 'semver';
import { NON_WINDOWS_PATH_VARIABLE_NAME, WINDOWS_PATH_VARIABLE_NAME } from './constants';
import { IOSInfo, OSDistro, OSType } from './types';

let local: OSInfo;

function getLocal(): OSInfo {
    if (!local) {
        local = getOSInfo();
    }
    return local;
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

export class OSInfo implements IOSInfo {
    constructor(
        public readonly type: OSType,
        public readonly arch: string = os.arch(),
        // See:
        //  https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/semver/index.d.ts#L152
        public readonly version: semver.SemVer = new semver.SemVer('0.0.0'),
        public readonly distro: OSDistro = OSDistro.Unknown
    ) {}

    public get is64bit(): boolean {
        return this.arch === 'x64';
    }
}

export function getOSInfo(
    getArch: () => string = os.arch,
    getRelease: () => string = os.release,
    getDistro: () => [OSDistro, semver.SemVer] = getLinuxDistro,
    platform?: string
): OSInfo {
    const osType = getOSType(platform);
    const arch = getArch();
    switch (osType) {
        case OSType.Windows:
            return getDefaultOSInfo(osType, arch, getRelease);
        case OSType.OSX:
            return getDefaultOSInfo(osType, arch, getRelease);
        case OSType.Linux:
            return getLinuxInfo(arch, getDistro);
        default:
            return new OSInfo(OSType.Unknown, arch);
    }
}

function getDefaultOSInfo(osType: OSType, arch: string, getRelease: () => string): OSInfo {
    const version = parseVersion(getRelease());
    return new OSInfo(osType, arch, version);
}

function getLinuxInfo(arch: string, getDistro: () => [OSDistro, semver.SemVer]): OSInfo {
    const [distro, version] = getDistro();
    return new OSInfo(OSType.Linux, arch, version, distro);
}

function getLinuxDistro(): [OSDistro, semver.SemVer] {
    let distro: OSDistro = OSDistro.Unknown;
    let version: semver.SemVer = new semver.SemVer('0.0.0');
    getos((exc, info) => {
        if (exc) {
            throw exc;
        }
        distro = getLinuxDistroFromName(info.dist);
        version = parseVersion(info.release);
    });
    return [distro, version];
}

function getLinuxDistroFromName(name: string): OSDistro {
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

// helpers

export function isWindows(info?: IOSInfo): boolean {
    if (!info) {
        info = getLocal();
    }
    return info.type === OSType.Windows;
}

export function isMac(info?: IOSInfo): boolean {
    if (!info) {
        info = getLocal();
    }
    return info.type === OSType.OSX;
}

export function isLinux(info?: IOSInfo): boolean {
    if (!info) {
        info = getLocal();
    }
    return info.type === OSType.Linux;
}

export function is64bit(info?: IOSInfo): boolean {
    if (!info) {
        info = getLocal();
    }
    return info.arch === 'x64';
}

export function getPathVariableName(info: IOSInfo) {
    return isWindows(info) ? WINDOWS_PATH_VARIABLE_NAME : NON_WINDOWS_PATH_VARIABLE_NAME;
}

export function getVirtualEnvBinName(info: IOSInfo) {
    return isWindows(info) ? 'scripts' : 'bin';
}

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
