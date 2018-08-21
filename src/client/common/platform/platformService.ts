// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { injectable } from 'inversify';
import * as osinfo from './osinfo';
import { IPlatformService } from './types';

@injectable()
export class PlatformService implements IPlatformService {
    private info?: osinfo.OSInfo;

    public get os(): osinfo.OSInfo {
        if (!this.info) {
            this.info = osinfo.getOSInfo();
        }
        return this.info;
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
