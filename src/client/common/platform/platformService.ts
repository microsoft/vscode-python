// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { injectable } from 'inversify';
import { FileSystem } from './fileSystem';
import * as osinfo from './osinfo';
import { IPlatformService } from './types';

@injectable()
export class PlatformService implements IPlatformService {
    public readonly os: osinfo.OSInfo;

    constructor() {
        // Due to circular dependency between PlatformService and
        // FileSystem, we must use a dummy OSInfo at first.
        this.os = new osinfo.OSInfo(osinfo.getOSType());
        const filesystem = new FileSystem(this);
        this.os = osinfo.getOSInfo(filesystem.readFileSync);
    }

    public get pathVariableName() {
        return osinfo.getPathVariableName(this.os);
    }
    public get virtualEnvBinName() {
        return osinfo.getVirtualEnvBinName(this.os);
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
