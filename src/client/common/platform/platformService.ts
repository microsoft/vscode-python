// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { injectable } from 'inversify';
import { arch, release } from 'os';
import { NON_WINDOWS_PATH_VARIABLE_NAME, WINDOWS_PATH_VARIABLE_NAME } from './constants';
import { IPlatformService, IVersion } from './types';

class OSVersion implements IVersion {
    public get versionString(): string {
        return release();
    }
    public get versionMajor(): number {
        const parts = this.versionString.split('.');
        return parts.length > 0 ? parseInt(parts[0], 10) : 0;
    }
    public get versionMinor(): number {
        const parts = this.versionString.split('.');
        return parts.length > 1 ? parseInt(parts[1], 10) : 0;
    }
}

class MacOSVersion {
    public get isCompatibleOS(): boolean {
        // https://en.wikipedia.org/wiki/Darwin_%28operating_system%29#Release_history
        // 10.12 == Darwin 16.0
        return new OSVersion().versionMajor >= 16;
    }
}

@injectable()
export class PlatformService implements IPlatformService {
    private _isWindows: boolean;
    private _isMac: boolean;

    constructor() {
        this._isWindows = /^win/.test(process.platform);
        this._isMac = /^darwin/.test(process.platform);
    }
    public get isWindows(): boolean {
        return this._isWindows;
    }
    public get isMac(): boolean {
        return this._isMac;
    }
    public get isLinux(): boolean {
        return !(this.isWindows || this.isMac);
    }
    public get is64bit(): boolean {
        return arch() === 'x64';
    }
    public get pathVariableName() {
        return this.isWindows ? WINDOWS_PATH_VARIABLE_NAME : NON_WINDOWS_PATH_VARIABLE_NAME;
    }
    public get virtualEnvBinName() {
        return this.isWindows ? 'scripts' : 'bin';
    }
    public get isNetCoreCompatibleOS(): boolean {
        if (this.isMac) {
            return new MacOSVersion().isCompatibleOS;
        }
        // tslint:disable-next-line:no-suspicious-comment
        // TODO: implement Linux checks. They are all over.
        // release() reports kernel version. For the actual
        // OS version run 'lsb_release -a' on Ubuntu,
        // 'cat /etc/centos-release' on CentOS
        // 'cat /etc/fedora-release' on Fedora
        // 'cat /etc/lsb-release' on Mint
        // 'cat /etc/redhat-release' on Red Hat
        return true; // Windows matches between .NET Core and VS Code.
    }
}
