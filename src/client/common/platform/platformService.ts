// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { injectable } from 'inversify';
import * as platform from '../../../utils/platform';
import * as osinfo from './osinfo';
import { IPlatformService } from './types';

@injectable()
export class PlatformService implements IPlatformService {
    private cached?: platform.Info;

    public get info(): platform.Info {
        if (!this.cached) {
            this.cached = platform.getInfo();
        }
        return this.cached;
    }

    public get pathVariableName() {
        return osinfo.getPathVariableName(this.info);
    }
    public get virtualEnvBinName() {
        return osinfo.getVirtualEnvBinName(this.info);
    }

    // convenience methods

    public get isWindows(): boolean {
        return platform.isWindows(this.info);
    }
    public get isMac(): boolean {
        return platform.isMac(this.info);
    }
    public get isLinux(): boolean {
        return platform.isLinux(this.info);
    }
    public get is64bit(): boolean {
        return platform.is64bit(this.info);
    }
}
