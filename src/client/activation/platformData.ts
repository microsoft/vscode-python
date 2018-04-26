// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IFileSystem, IPlatformService } from '../common/platform/types';
import {
    analysis_engine_centos_x64_sha512,
    analysis_engine_debian_x64_sha512,
    analysis_engine_fedora_x64_sha512,
    analysis_engine_ol_x64_sha512,
    analysis_engine_opensuse_x64_sha512,
    analysis_engine_osx_x64_sha512,
    analysis_engine_rhel_x64_sha512,
    analysis_engine_ubuntu_x64_sha512,
    analysis_engine_win_x64_sha512,
    analysis_engine_win_x86_sha512
} from './analysisEngineHashes';

// '/etc/os-release', ID=flavor
const supportedLinuxFlavors = [
    'centos',
    'debian',
    'fedora',
    'ol',
    'opensuse',
    'rhel',
    'ubuntu'
];

export class PlatformData {
    constructor(private platform: IPlatformService, private fs: IFileSystem) { }
    public async getPlatformName(): Promise<string> {
        if (this.platform.isWindows) {
            return this.platform.is64bit ? 'win-x64' : 'win-x86';
        }
        if (this.platform.isMac) {
            return 'osx-x64';
        }
        if (this.platform.isLinux) {
            if (!this.platform.is64bit) {
                throw new Error('Python Analysis Engine does not support 32-bit Linux.');
            }
            const linuxFlavor = await this.getLinuxFlavor();
            if (linuxFlavor.length === 0) {
                throw new Error('Unable to determine Linux flavor from /etc/os-release.');
            }
            if (supportedLinuxFlavors.indexOf(linuxFlavor) < 0) {
                throw new Error(`${linuxFlavor} is not supported.`);
            }
            return `${linuxFlavor}-x64`;
        }
        throw new Error('Unknown OS platform.');
    }

    public getEngineDllName(): string {
        return 'Microsoft.PythonTools.VsCode.dll';
    }

    public getEngineExecutableName(): string {
        return this.platform.isWindows
            ? 'Microsoft.PythonTools.VsCode.exe'
            : 'Microsoft.PythonTools.VsCode';
    }

    public async getExpectedHash(): Promise<string> {
        if (this.platform.isWindows) {
            return this.platform.is64bit ? analysis_engine_win_x64_sha512 : analysis_engine_win_x86_sha512;
        }
        if (this.platform.isMac) {
            return analysis_engine_osx_x64_sha512;
        }
        if (this.platform.isLinux && this.platform.is64bit) {
            const linuxFlavor = await this.getLinuxFlavor();
            // tslint:disable-next-line:switch-default
            switch (linuxFlavor) {
                case 'centos': return analysis_engine_centos_x64_sha512;
                case 'debian': return analysis_engine_debian_x64_sha512;
                case 'fedora': return analysis_engine_fedora_x64_sha512;
                case 'ol': return analysis_engine_ol_x64_sha512;
                case 'opensuse': return analysis_engine_opensuse_x64_sha512;
                case 'rhel': return analysis_engine_rhel_x64_sha512;
                case 'ubuntu': return analysis_engine_ubuntu_x64_sha512;
            }
        }
        throw new Error('Unknown platform.');
    }

    private async getLinuxFlavor(): Promise<string> {
        const verFile = '/etc/os-release';
        const data = await this.fs.readFile(verFile);
        if (data) {
            const res = /ID=(.*)/.exec(data);
            if (res && res.length > 1) {
                return res[1];
            }
        }
        return '';
    }
}
