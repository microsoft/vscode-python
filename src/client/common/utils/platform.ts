// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as getos from 'getos';
import * as os from 'os';
import * as semver from 'semver';
import { IPlatformInfo } from '../platform/types';
import { parseVersion } from './version';

export enum Architecture {
    Unknown = 1,
    x86 = 2,
    x64 = 3
}
export enum OSType {
    Unknown,
    Windows,
    OSX,
    Linux
}
export enum OSDistro {
    Unknown,
    // linux:
    Ubuntu,
    Debian,
    RHEL,
    Fedora,
    CentOS,
    // The remainder aren't officially supported.
    // See: https://code.visualstudio.com/docs/supporting/requirements
    Suse,
    Gentoo,
    Arch
}

let local: Info;

function getLocal(): Info {
    if (!local) {
        local = getInfo();
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

export class Info implements IPlatformInfo {
    constructor(
        public readonly type: OSType,
        private readonly arch: string = os.arch(),
        // See:
        //  https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/semver/index.d.ts#L152
        public readonly version: semver.SemVer = new semver.SemVer('0.0.0'),
        public readonly distro: OSDistro = OSDistro.Unknown
    ) { }

    public get architecture(): Architecture {
        return this.arch === 'x64' ? Architecture.x64 : Architecture.x86;
    }

    public matchPlatform(names: string): boolean {
        return matchPlatform(names, this);
    }
}

export function getInfo(
    getArch: () => string = os.arch,
    getRelease: () => string = os.release,
    getDistro: () => [OSDistro, semver.SemVer] = getLinuxDistro,
    platform?: string
): Info {
    const osType = getOSType(platform);
    const arch = getArch();
    switch (osType) {
        case OSType.Windows:
            return getDefaultInfo(osType, arch, getRelease);
        case OSType.OSX:
            return getDefaultInfo(osType, arch, getRelease);
        case OSType.Linux:
            return getLinuxInfo(arch, getDistro);
        default:
            return new Info(OSType.Unknown, arch);
    }
}

function getDefaultInfo(osType: OSType, arch: string, getRelease: () => string): Info {
    const version = parseVersion(getRelease());
    return new Info(osType, arch, version);
}

function getLinuxInfo(arch: string, getDistro: () => [OSDistro, semver.SemVer]): Info {
    const [distro, version] = getDistro();
    return new Info(OSType.Linux, arch, version, distro);
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

export function isWindows(info?: Info): boolean {
    if (!info) {
        info = getLocal();
    }
    return info.type === OSType.Windows;
}

export function isMac(info?: Info): boolean {
    if (!info) {
        info = getLocal();
    }
    return info.type === OSType.OSX;
}

export function isLinux(info?: Info): boolean {
    if (!info) {
        info = getLocal();
    }
    return info.type === OSType.Linux;
}

export function is64bit(info?: Info): boolean {
    if (!info) {
        info = getLocal();
    }
    return info.architecture === Architecture.x64;
}

// Match the platform string to the given OS info.
export function matchPlatform(names: string, info: Info = getInfo()): boolean {
    if (info.type === OSType.Unknown) {
        return false;
    }
    names = names.trim();
    if (names === '') {
        return true;
    }
    for (let name of names.split('|')) {
        name = name.trim();
        if (matchOnePlatform(name, info)) {
            return true;
        }
    }
    return false;
}

function matchOnePlatform(name: string, info: Info): boolean {
    if (name === '' || name === '-') {
        return false;
    }
    const negate = name[0] === '-';
    if (negate) {
        name = name.replace(/^-/, '');
    }

    const [osType, distro] = identifyOS(name);
    if (osType === OSType.Unknown) {
        return false;
    }

    let result = false;
    if (osType === info.type) {
        result = true;
        if (osType === OSType.Linux) {
            if (distro !== OSDistro.Unknown) {
                result = distro === info.distro;
            }
        }
    }
    return negate ? !result : result;
}

function identifyOS(name: string): [OSType, OSDistro] {
    name = name.toLowerCase();
    if (/win/.test(name)) {
        return [OSType.Windows, OSDistro.Unknown];
    } else if (/darwin|mac|osx/.test(name)) {
        return [OSType.OSX, OSDistro.Unknown];
    } else if (/linux/.test(name)) {
        return [OSType.Linux, OSDistro.Unknown];
    }

    // Try linux distros.
    const distro = getLinuxDistroFromName(name);
    if (distro !== OSDistro.Unknown) {
        return [OSType.Linux, distro];
    } else {
        return [OSType.Unknown, OSDistro.Unknown];
    }
}
