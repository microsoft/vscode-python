// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { injectable } from 'inversify';
import * as os from 'os';
import { NON_WINDOWS_PATH_VARIABLE_NAME, WINDOWS_PATH_VARIABLE_NAME } from './constants';
import { IPlatformService, OSType } from './types';

@injectable()
export class PlatformService implements IPlatformService {
    private _osType: OSType;

    constructor() {
        if (/^win/.test(process.platform)) {
            this._osType = OSType.Windows;
        } else if (/^darwin/.test(process.platform)) {
            this._osType = OSType.OSX;
        } else if (/^linux/.test(process.platform)) {
            this._osType = OSType.Linux;
        } else {
            this._osType = OSType.Unsupported;
        }
    }
    public get osType(): OSType {
        return this._osType;
    }
    // XXX deprecate
    public get isWindows(): boolean {
        return this._osType === OSType.Windows;
    }
    // XXX deprecate
    public get isMac(): boolean {
        return this._osType === OSType.OSX;
    }
    // XXX deprecate
    public get isLinux(): boolean {
        return this._osType === OSType.Linux;
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
}
