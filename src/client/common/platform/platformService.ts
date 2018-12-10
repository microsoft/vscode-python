// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { injectable } from 'inversify';
import * as os from 'os';
import { coerce, SemVer } from 'semver';
import { sendTelemetryEvent } from '../../telemetry';
import { PLATFORM_INFO, PlatformErrors } from '../../telemetry/constants';
import { traceDecorators, traceError } from '../logger';
import { OSDistro, OSType } from '../utils/platform';
import { parseVersion } from '../utils/version';
import { NON_WINDOWS_PATH_VARIABLE_NAME, WINDOWS_PATH_VARIABLE_NAME } from './constants';
import { IPlatformService } from './types';

@injectable()
export class PlatformService implements IPlatformService {
    public readonly osType: OSType = getOSType();
    public distro?: OSDistro;
    public version?: SemVer;
    public get pathVariableName() {
        return this.isWindows ? WINDOWS_PATH_VARIABLE_NAME : NON_WINDOWS_PATH_VARIABLE_NAME;
    }
    public get virtualEnvBinName() {
        return this.isWindows ? 'Scripts' : 'bin';
    }
    @traceDecorators.verbose('Get OS Distro')
    public async getOSDistro(): Promise<OSDistro> {
        if (this.distro) {
            return this.distro;
        }
        switch (this.osType) {
            case OSType.Windows:
            case OSType.OSX:
                return this.distro = OSDistro.Unknown;
            default:
                const result = await getLinuxDistro();
                this.distro = result[0];
                this.version = result[1];
                return this.distro;
        }
    }
    @traceDecorators.verbose('Get Platform Version')
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
                        sendTelemetryEvent(PLATFORM_INFO, undefined, { osVersion: `${ver.major}.${ver.minor}.${ver.patch}` });
                        return this.version = ver;
                    }
                    throw new Error('Unable to parse version');
                } catch (ex) {
                    sendTelemetryEvent(PLATFORM_INFO, undefined, { failureType: PlatformErrors.FailedToParseVersion });
                    traceError(`Failed to parse Version ${os.release()}`, ex);
                    return parseVersion(os.release());
                }
            default:
                const result = await getLinuxDistro();
                sendTelemetryEvent(PLATFORM_INFO, undefined, { distro: result[0], osVersion: `${result[1].major}.${result[1].minor}.${result[1].patch}` });
                this.distro = result[0];
                this.version = result[1];
                return this.version;
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
    public get is64bit(): boolean {
        // tslint:disable-next-line:no-require-imports
        const arch = require('arch') as typeof import('arch');
        return arch() === 'x64';
    }
}

function getOSType(platform: string = process.platform): OSType {
    if (/^win/.test(platform)) {
        return OSType.Windows;
    } else if (/^darwin/.test(platform)) {
        return OSType.OSX;
    } else if (/^linux/.test(platform)) {
        return OSType.Linux;
    } else {
        sendTelemetryEvent(PLATFORM_INFO, undefined, { failureType: PlatformErrors.FailedToDetermineOS });
        return OSType.Unknown;
    }
}

async function getLinuxDistro(): Promise<[OSDistro, SemVer]> {
    let distro: OSDistro = OSDistro.Unknown;
    let version = new SemVer('0.0.0');
    return new Promise<[OSDistro, SemVer]>((resolve, reject) => {
        // tslint:disable-next-line:no-require-imports
        const getos = require('getos') as typeof import('getos');
        // tslint:disable-next-line:no-any
        getos((exc: Error, info: any) => {
            if (exc) {
                sendTelemetryEvent(PLATFORM_INFO, undefined, { failureType: PlatformErrors.FailedToGetLinuxInfo });
                return reject(exc);
            }
            distro = getLinuxDistroFromName(info.dist);
            version = parseVersion(info.release);
            resolve([distro, version]);
        });
    });
}

function getLinuxDistroFromName(name: string): OSDistro {
    name = name.toLowerCase();
    // See https://github.com/zyga/os-release-zoo.
    if (/ubuntu/.test(name)) {
        return OSDistro.Ubuntu;
    } else if (/debian/.test(name)) {
        return OSDistro.Debian;
    } else if (/rhel/.test(name) || /red hat/.test(name)) {
        return OSDistro.RHEL;
    } else if (/fedora/.test(name)) {
        return OSDistro.Fedora;
    } else if (/alpine/.test(name)) {
        return OSDistro.Alpine;
    } else if (/mint/.test(name)) {
        return OSDistro.Mint;
    } else if (/centos/.test(name)) {
        return OSDistro.CentOS;
    } else if (/suse/.test(name)) {
        return OSDistro.Suse;
    } else if (/gentoo/.test(name)) {
        return OSDistro.Suse;
    } else if (/arch/.test(name)) {
        return OSDistro.Arch;
    } else {
        return OSDistro.Unknown;
    }
}
