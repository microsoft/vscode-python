// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { injectable } from 'inversify';
import * as os from 'os';
import { coerce, SemVer } from 'semver';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName, PlatformErrors } from '../../telemetry/constants';
import { getOSType, OSType } from '../utils/platform';
import { parseVersion } from '../utils/version';
import { NON_WINDOWS_PATH_VARIABLE_NAME, WINDOWS_PATH_VARIABLE_NAME } from './constants';
import { IPlatformService } from './types';

@injectable()
export class PlatformService implements IPlatformService {
    public readonly osType: OSType = getOSType();
    public version?: SemVer;
    constructor() {
        if (this.osType === OSType.Unknown) {
            sendTelemetryEvent(EventName.PLATFORM_INFO, undefined, {
                failureType: PlatformErrors.FailedToDetermineOS
            });
        }
    }
    public get pathVariableName() {
        return this.isWindows ? WINDOWS_PATH_VARIABLE_NAME : NON_WINDOWS_PATH_VARIABLE_NAME;
    }
    public get virtualEnvBinName() {
        return this.isWindows ? 'Scripts' : 'bin';
    }
    public async getVersion(): Promise<SemVer> {
        if (this.version) {
            return this.version;
        }
        switch (this.osType) {
            case OSType.Windows:
            case OSType.OSX:
                // Release section of https://en.wikipedia.org/wiki/MacOS_Sierra.
                // Version 10.12 maps to Darwin 16.0.0.
                // Using os.relase() we get the darwin release #.
                try {
                    const ver = coerce(os.release());
                    if (ver) {
                        sendTelemetryEvent(EventName.PLATFORM_INFO, undefined, {
                            osVersion: `${ver.major}.${ver.minor}.${ver.patch}`
                        });
                        return (this.version = ver);
                    }
                    throw new Error('Unable to parse version');
                } catch (ex) {
                    sendTelemetryEvent(EventName.PLATFORM_INFO, undefined, {
                        failureType: PlatformErrors.FailedToParseVersion
                    });
                    return parseVersion(os.release());
                }
            default:
                throw new Error('Not Supported');
        }
    }

    public get isWindows(): boolean {
        return this.osType === OSType.Windows;
    }
    public get isMac(): boolean {
        return this.osType === OSType.OSX;
    }
    public get isLinux(): boolean {
        return this.osType === OSType.Linux;
    }
    public get osRelease(): string {
        return os.release();
    }
    public get is64bit(): boolean {
        // tslint:disable-next-line:no-require-imports
        const arch = require('arch');
        return arch() === 'x64';
    }
}
