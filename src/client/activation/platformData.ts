// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IFileSystem, IPlatformService } from '../common/platform/types';
import {
    language_server_linux_x64_sha512,
    language_server_osx_x64_sha512,
    language_server_win_x64_sha512,
    language_server_win_x86_sha512
} from './languageServerHashes';

export enum PlatformName {
    Windows32Bit = 'win-x86',
    Windows64Bit = 'win-x64',
    Mac64Bit = 'osx-x64',
    Linux64Bit = 'linux-x64'
}

export enum PlatformLSExecutables {
    Windows = 'Microsoft.Python.LanguageServer.exe',
    MacOS = 'Microsoft.Python.LanguageServer',
    Linux = 'Microsoft.Python.LanguageServer'
}

export class PlatformData {
    constructor(private platform: IPlatformService, fs: IFileSystem) { }
    public async getPlatformName(): Promise<PlatformName> {
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

    public getEngineDllName(): string {
        return 'Microsoft.Python.LanguageServer.dll';
    }

    public getEngineExecutableName(): string {
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

    public async getExpectedHash(): Promise<string> {
        if (this.platform.isWindows) {
            return this.platform.is64bit ? language_server_win_x64_sha512 : language_server_win_x86_sha512;
        }
        if (this.platform.isMac) {
            return language_server_osx_x64_sha512;
        }
        if (this.platform.isLinux && this.platform.is64bit) {
            return language_server_linux_x64_sha512;
        }
        throw new Error('Unknown platform.');
    }
}
