// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as fs from 'fs';
import { injectable } from 'inversify';
import * as os from 'os';
import * as semver from 'semver';
import { LINUX_INFO_FILE, NON_WINDOWS_PATH_VARIABLE_NAME, WINDOWS_PATH_VARIABLE_NAME } from './constants';
import { IPlatformService, OSDistro, OSInfo, OSType } from './types';

@injectable()
export class PlatformService implements IPlatformService {
    public readonly os: OSInfo;

    constructor() {
        this.os = getOSInfo();
    }

    public get pathVariableName() {
        return this.isWindows ? WINDOWS_PATH_VARIABLE_NAME : NON_WINDOWS_PATH_VARIABLE_NAME;
    }
    public get virtualEnvBinName() {
        return this.isWindows ? 'scripts' : 'bin';
    }

    // tslint:disable-next-line: no-suspicious-comment
    // TODO: Drop the following (in favor of osType).
    public get isWindows(): boolean {
        return this.os.type === OSType.Windows;
    }
    public get isMac(): boolean {
        return this.os.type === OSType.OSX;
    }
    public get isLinux(): boolean {
        return this.os.type === OSType.Linux;
    }
    public get is64bit(): boolean {
        return this.os.arch === 'x64';
    }
}

function getOSInfo(): OSInfo {
    if (/^win/.test(process.platform)) {
        const osType = OSType.Windows;
        return defaultOSInfo(osType);
    } else if (/^darwin/.test(process.platform)) {
        const osType = OSType.OSX;
        return defaultOSInfo(osType);
    } else if (/^linux/.test(process.platform)) {
        return linuxInfoFromFile();
    } else {
        return new OSInfo(OSType.Unsupported);
    }
}

function defaultOSInfo(osType: OSType): OSInfo {
    const version = parseVersion(os.release());
    return new OSInfo(osType, version);
}

// Inspired in part by: https://github.com/juju/os
function linuxInfoFromFile(filename: string = LINUX_INFO_FILE): OSInfo {
    if (!fs.existsSync(filename)) {
        return new OSInfo(OSType.Linux);
    }

    let distroName = '';
    let rawVer = '';
    const data = fs.readFileSync(filename, 'utf-8');
    for (const line of data.split(/\n/)) {
        const parts = line.split('=', 2);
        switch (parts[0]) {
            case 'NAME':
                distroName = parts[1];
                break;
            case 'VERSION_ID':
                rawVer = parts[1];
                break;
            default:
        }
    }
    const version = parseVersion(rawVer);
    const distro = distroFromName(distroName);
    return new OSInfo(OSType.Linux, version, distro);
}

function distroFromName(name: string): OSDistro {
    // tslint:disable-next-line: no-suspicious-comment
    // TODO: finish!
    return OSDistro.Unknown;
}

function parseVersion(raw: string): semver.SemVer {
    const ver = semver.coerce(raw);
    if (ver === null || !semver.valid(ver)) {
        //throw Error(`invalid version (${raw})`);
        return new semver.SemVer('0.0.0');
    }
    return ver;
}
