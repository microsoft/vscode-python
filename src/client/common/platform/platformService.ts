// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { inject, injectable } from 'inversify';
import { NON_WINDOWS_PATH_VARIABLE_NAME, WINDOWS_PATH_VARIABLE_NAME } from './constants';
import { FileSystem } from './fileSystem';
import * as osinfo from './osinfo';
import { IFileSystem, IPlatformService, OSInfo } from './types';

@injectable()
export class PlatformService implements IPlatformService {
    public readonly os: OSInfo;

    constructor(
        info?: OSInfo,
        @inject(IFileSystem) filesystem?: IFileSystem
    ) {
        if (info) {
            this.os = info;
        } else {
            if (!filesystem) {
                // Due to circular dependency between PlatformService and
                // FileSystem, we must use a dummy OSInfo at first.
                this.os = new OSInfo(osinfo.getOSType());
                filesystem = new FileSystem(this);
            }
            this.os = osinfo.getOSInfo(filesystem.readFileSync);
        }
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
        return osinfo.isWindows(this.os);
    }
    public get isMac(): boolean {
        return osinfo.isMac(this.os);
    }
    public get isLinux(): boolean {
        return osinfo.isLinux(this.os);
    }
    public get is64bit(): boolean {
        return osinfo.is64bit(this.os);
    }
}
