// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { inject, injectable } from 'inversify';
import { arch, release } from 'os';
import { IServiceContainer } from '../../ioc/types';
import { IProcessService, IProcessServiceFactory } from '../process/types';
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

enum OSCheckResult {
    Compatible,
    Incompatible,
    Unknown
}

class MacOSVersion {
    public isCompatibleOS(): Promise<string> {
        // https://en.wikipedia.org/wiki/Darwin_%28operating_system%29#Release_history
        // 10.12 == Darwin 16.0
        return Promise.resolve(new OSVersion().versionMajor >= 16 ? '' : 'Microsoft Python Language Server does not support MacOS older than 10.12.');
    }
}

class LinuxVersion {
    constructor(private serviceContainer: IServiceContainer) { }
    public async isCompatibleOS(): Promise<string> {
        const factory = this.serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory);
        const process = await factory.create();

        // https://github.com/dotnet/core/blob/master/release-notes/2.1/2.1-supported-os.md
        // OS version run 'lsb_release -a' on Ubuntu
        let result = await this.checkLinux(process, 'lsb_release', ['-a'], 'Ubuntu', 'Release:', ['18', '16', '14']);
        if (result === OSCheckResult.Compatible) {
            return Promise.resolve('');
        } else if (result === OSCheckResult.Incompatible) {
            return Promise.resolve('Microsoft Python Language Server only supports Ubuntu 18, 16 or 14.');
        }

        // 'cat /etc/centos-release' on CentOS
        result = await this.checkLinux(process, 'cat', ['/etc/centos-release'], 'CentOS', 'release', ['7']);
        if (result === OSCheckResult.Compatible) {
            return Promise.resolve('');
        } else if (result === OSCheckResult.Incompatible) {
            return Promise.resolve('Microsoft Python Language Server only support CentOS 7.');
        }

        // 'cat /etc/fedora-release' on Fedora
        result = await this.checkLinux(process, 'cat', ['/etc/fedora-release'], 'Fedora', 'release', ['28', '27']);
        if (result === OSCheckResult.Compatible) {
            return Promise.resolve('');
        } else if (result === OSCheckResult.Incompatible) {
            return Promise.resolve('Microsoft Python Language Server only support Fedora 28 and 27.');
        }

        // 'cat /etc/redhat-release' on RedHat
        result = await this.checkLinux(process, 'cat', ['/etc/redhat-release'], 'Red Hat', 'release', ['7', '6']);
        if (result === OSCheckResult.Compatible) {
            return Promise.resolve('');
        } else if (result === OSCheckResult.Incompatible) {
            return Promise.resolve('Microsoft Python Language Server only support RedHat 6 or 7.');
        }

        // 'cat /etc/suse-release' on SUSE
        result = await this.checkLinux(process, 'cat', ['/etc/suse-release'], 'SUSE', 'release', ['12']);
        if (result === OSCheckResult.Compatible) {
            return Promise.resolve('');
        } else if (result === OSCheckResult.Incompatible) {
            return Promise.resolve('Microsoft Python Language Server only support SUSE 12.');
        }

        // 'cat /etc/suse-release' on Debian
        result = await this.checkLinux(process, 'lsb_release', ['-a'], 'Debian', 'Release:', ['9', '8.7']);
        if (result === OSCheckResult.Compatible) {
            return Promise.resolve('');
        } else if (result === OSCheckResult.Incompatible) {
            return Promise.resolve('Microsoft Python Language Server only support SUSE 12.');
        }

        return Promise.resolve(''); // Optimistic for other Linuxes
    }

    private async checkLinux(process: IProcessService, command: string, args: string[], osName: string, key: string, values: string[]): Promise<OSCheckResult> {
        const result = await process.exec(command, args);
        const words = result.stdout.split(' \t\n');
        if (words.indexOf(osName) > 0) {
            const index = words.indexOf(key);
            if (index >= 0 && index < words.length - 1) {
                const version = words[index + 1];
                const major = version.split('.')[0];
                for (const v of values) {
                    if (major === v) {
                        return Promise.resolve(OSCheckResult.Compatible);
                    }
                }
            }
            return Promise.resolve(OSCheckResult.Incompatible);
        }
        return Promise.resolve(OSCheckResult.Unknown);
    }
}

// tslint:disable-next-line:max-classes-per-file
@injectable()
export class PlatformService implements IPlatformService {
    private _isWindows: boolean;
    private _isMac: boolean;

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
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
    public isNetCoreCompatibleOS(): Promise<string> {
        if (this.isMac) {
            return new MacOSVersion().isCompatibleOS();
        }
        if (this.isLinux) {
            return new LinuxVersion(this.serviceContainer).isCompatibleOS();
        }
        return Promise.resolve(''); // Windows matches between .NET Core and VS Code.
    }
}
