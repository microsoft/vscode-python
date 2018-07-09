// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IFileSystem, IPlatformService } from '../common/platform/types';
import {
    language_server_linux_x64_sha512,
    language_server_osx_x64_sha512,
    language_server_win_x64_sha512,
    language_server_win_x86_sha512
} from './languageServerHashes';

export class PlatformData {
    constructor(private platform: IPlatformService, fs: IFileSystem) { }
    public async getPlatformName(): Promise<string> {
        if (this.platform.isWindows) {
            return this.platform.is64bit ? 'win-x64' : 'win-x86';
        }
        if (this.platform.isMac) {
            return 'osx-x64';
        }
        if (this.platform.isLinux) {
            if (!this.platform.is64bit) {
                throw new Error('Microsoft Python Language Server does not support 32-bit Linux.');
            }
            return 'linux-x64';
        }
        throw new Error('Unknown OS platform.');
    }

    public getEngineDllName(): string {
        return 'Microsoft.Python.LanguageServer.dll';
    }

    public getEngineExecutableName(): string {
        return this.platform.isWindows
            ? 'Microsoft.Python.LanguageServer.exe'
            : 'Microsoft.Python.LanguageServer.LanguageServer';
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
