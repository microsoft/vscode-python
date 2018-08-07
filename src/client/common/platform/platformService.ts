// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as fs from 'fs';
import { injectable } from 'inversify';
import * as os from 'os';
import * as semver from 'semver';
import { LINUX_INFO_FILE, NON_WINDOWS_PATH_VARIABLE_NAME, WINDOWS_PATH_VARIABLE_NAME } from './constants';
import { IPlatformService, OSType } from './types';

@injectable()
export class PlatformService implements IPlatformService {
    private _osType: OSType;
    private _osVersion: string;

    constructor() {
        this._osVersion = '';
        if (/^win/.test(process.platform)) {
            this._osType = OSType.Windows;
        } else if (/^darwin/.test(process.platform)) {
            this._osType = OSType.OSX;
        } else if (/^linux/.test(process.platform)) {
            this._osType = OSType.Linux;
            const info = linux_info_from_file();
            this._osVersion = info.version;
        } else {
            this._osType = OSType.Unsupported;
        }

        if (this._osVersion === '') {
            const osVersion = os.release();
            const clean = semver.clean(osVersion);
            this._osVersion = clean === null ? '' : clean;
        }
    }
    public get osType(): OSType {
        return this._osType;
    }
    public get osVersion(): string {
        return this._osVersion;
    }
    public get is64bit(): boolean {
        return os.arch() === 'x64';
    }
    public get pathVariableName() {
        return this.isWindows ? WINDOWS_PATH_VARIABLE_NAME : NON_WINDOWS_PATH_VARIABLE_NAME;
    }
    public get virtualEnvBinName() {
        return this.isWindows ? 'scripts' : 'bin';
    }

    // XXX Drop the following (in favor of osType).
    public get isWindows(): boolean {
        return this._osType === OSType.Windows;
    }
    public get isMac(): boolean {
        return this._osType === OSType.OSX;
    }
    public get isLinux(): boolean {
        return this._osType === OSType.Linux;
    }
}

// Inspired in part by: https://github.com/juju/os
class LinuxInfo {
    public readonly distro: string;
    public readonly version: string;

    constructor(distro: string, version: string) {
        this.distro = distro;
        const clean = semver.clean(version);
        this.version = clean === null ? '' : clean;
    }
}

function linux_info_from_file(filename: string = LINUX_INFO_FILE): LinuxInfo {
    if (!fs.existsSync(filename)) {
        return new LinuxInfo('', '');
    }

    let distro = '';
    let version = '';
    const data = fs.readFileSync(filename, 'utf-8');
    for (const line of data.split(/\n/)) {
        const parts = line.split('=', 2);
        switch (parts[0]) {
            case 'NAME':
                distro = parts[1];
                break;
            case 'VERSION_ID':
                version = parts[1];
                break;
            default:
        }
    }
    return new LinuxInfo(distro, version);
}
