// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IPlatformService } from '../../common/platform/types';
import { IPlatformData } from '../types';

export enum PlatformName {
    Windows32Bit = 'win-x86',
    Windows64Bit = 'win-x64',
    Mac64Bit = 'osx-x64',
    Linux64Bit = 'linux-x64',
}

export enum PlatformLSExecutables {
    Windows = 'Microsoft.Python.LanguageServer.exe',
    MacOS = 'Microsoft.Python.LanguageServer',
    Linux = 'Microsoft.Python.LanguageServer',
}

@injectable()
export class PlatformData implements IPlatformData {
    constructor(@inject(IPlatformService) private readonly platform: IPlatformService) {}
    public get platformName(): PlatformName {
        if (this.platform.isWindows) {
            return this.platform.is64bit ? PlatformName.Windows64Bit : PlatformName.Windows32Bit;
        }
        if (this.platform.isMac) {
            return PlatformName.Mac64Bit;
        }
        if (this.platform.isLinux) {
            if (!this.platform.is64bit) {
                throw new Error('Microsoft Python Language Server does not support 32-bit Linux.');
            }
            return PlatformName.Linux64Bit;
        }
        throw new Error('Unknown OS platform.');
    }

    public get engineDllName(): string {
        return 'Microsoft.Python.LanguageServer.dll';
    }

    public get engineExecutableName(): string {
        if (this.platform.isWindows) {
            return PlatformLSExecutables.Windows;
        } else if (this.platform.isLinux) {
            return PlatformLSExecutables.Linux;
        } else if (this.platform.isMac) {
            return PlatformLSExecutables.MacOS;
        } else {
            return 'unknown-platform';
        }
    }
}
