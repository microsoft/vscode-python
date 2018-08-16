// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { injectable } from 'inversify';
import { NON_WINDOWS_PATH_VARIABLE_NAME, WINDOWS_PATH_VARIABLE_NAME } from './constants';
import { getOSInfo } from './osinfo';
import { IPlatformService, OSInfo, OSType } from './types';

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
