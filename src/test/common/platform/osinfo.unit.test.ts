// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as semver from 'semver';
import { getOSInfo, getOSType, getPathVariableName, getVirtualEnvBinName, is64bit, isLinux, isMac, isWindows, OSInfo, parseVersion } from '../../../client/common/platform/osinfo';
import { OSDistro, OSType } from '../../../client/common/platform/types';
import { Stub } from '../../../test/stub';

// Windows
export const WIN_10 = new OSInfo(
    OSType.Windows,
    'x64',
    new semver.SemVer('10.0.1'));
export const WIN_7 = new OSInfo(
    OSType.Windows,
    'x64',
    new semver.SemVer('6.1.3'));
export const WIN_XP = new OSInfo(
    OSType.Windows,
    'x64',
    new semver.SemVer('5.1.7'));
// OS X
export const MAC_HIGH_SIERRA = new OSInfo(
    OSType.OSX,
    'x64',
    new semver.SemVer('10.13.1'));
export const MAC_SIERRA = new OSInfo(
    OSType.OSX,
    'x64',
    new semver.SemVer('10.12.2'));
export const MAC_EL_CAPITAN = new OSInfo(
    OSType.OSX,
    'x64',
    new semver.SemVer('10.11.5'));

// Linux
export const UBUNTU_BIONIC = new OSInfo(
    OSType.Linux,
    'x64',
    parseVersion('18.04'),
    //semver.coerce('18.04') || new semver.SemVer('0.0.0'),
    OSDistro.Ubuntu);
export const UBUNTU_PRECISE = new OSInfo(
    OSType.Linux,
    'x64',
    parseVersion('14.04'),
    //semver.coerce('14.04') || new semver.SemVer('0.0.0'),
    OSDistro.Ubuntu);
export const FEDORA = new OSInfo(
    OSType.Linux,
    'x64',
    parseVersion('24'),
    //semver.coerce('24') || new semver.SemVer('0.0.0'),
    OSDistro.Fedora);
export const ARCH = new OSInfo(
    OSType.Linux,
    'x64',
    new semver.SemVer('0.0.0'),  // rolling vs. 2018.08.01
    OSDistro.Arch);

export const OLD = new OSInfo(
    OSType.Windows,
    'x86',
    new semver.SemVer('5.1.7'));

class StubDeps {
    public returnGetArch: string = '';
    public returnGetRelease: string = '';
    public returnGetLinuxDistro: [OSDistro, semver.SemVer] = [OSDistro.Unknown, new semver.SemVer('0.0.0')];

    constructor(
        public stub: Stub = new Stub()) {}

    public getArch(): string {
        this.stub.addCall('getArch');
        this.stub.maybeErr();
        return this.returnGetArch;
    }

    public getRelease(): string {
        this.stub.addCall('getRelease');
        this.stub.maybeErr();
        return this.returnGetRelease;
    }

    public getLinuxDistro(): [OSDistro, semver.SemVer] {
        this.stub.addCall('getLinuxDistro');
        this.stub.maybeErr();
        return this.returnGetLinuxDistro;
    }
}

suite('OS Info - getOSInfo()', () => {
    let stub: Stub;
    let deps: StubDeps;

    setup(() => {
        stub = new Stub();
        deps = new StubDeps(stub);
    });

    const NOT_LINUX: [OSDistro, string] = [OSDistro.Unknown, ''];
    const tests: [string, string, string, [OSDistro, string], OSInfo][] = [
        ['windows', 'x64', '10.0.1', NOT_LINUX, WIN_10],
        ['windows', 'x64', '6.1.3', NOT_LINUX, WIN_7],
        ['windows', 'x64', '5.1.7', NOT_LINUX, WIN_XP],

        ['darwin', 'x64', '10.13.1', NOT_LINUX, MAC_HIGH_SIERRA],
        ['darwin', 'x64', '10.12.2', NOT_LINUX, MAC_SIERRA],
        ['darwin', 'x64', '10.11.5', NOT_LINUX, MAC_EL_CAPITAN],

        ['linux', 'x64', '4.1.4', [OSDistro.Ubuntu, '18.04'], UBUNTU_BIONIC],
        ['linux', 'x64', '4.1.4', [OSDistro.Ubuntu, '14.04'], UBUNTU_PRECISE],
        ['linux', 'x64', '4.1.4', [OSDistro.Fedora, '24'], FEDORA],
        ['linux', 'x64', '4.1.4', [OSDistro.Arch, ''], ARCH],

        ['windows', 'x86', '5.1.7', NOT_LINUX, OLD]  // WinXP
    ];
    let i = 0;
    for (const [platform, arch, release, [distro, version], expected] of tests) {
        test(`${i} - ${platform} ${arch} ${release}`, async () => {
            deps.returnGetArch = arch;
            deps.returnGetRelease = release;
            deps.returnGetLinuxDistro = [distro, parseVersion(version)];
            const result = getOSInfo(
                () => deps.getArch(),
                () => deps.getRelease(),
                () => deps.getLinuxDistro(),
                platform);

            expect(result).to.deep.equal(expected);
            if (distro === OSDistro.Unknown) {
                stub.checkCalls([
                    {funcName: 'getArch', args: []},
                    {funcName: 'getRelease', args: []}
                ]);
            } else {
                stub.checkCalls([
                    {funcName: 'getArch', args: []},
                    {funcName: 'getLinuxDistro', args: []}
                ]);
            }
        });
        i = i + 1;
    }
});

suite('OS Info - getOSType()', () => {
    const tests: [string, OSType][] = [
        ['windows', OSType.Windows],
        ['darwin', OSType.OSX],
        ['linux', OSType.Linux],

        ['win32', OSType.Windows],
        ['darwin ++', OSType.OSX],
        ['linux!', OSType.Linux]
    ];
    for (const [platform, expected] of tests) {
        test(`platform: ${platform}`, async () => {
            const result = getOSType(platform);

            expect(result).to.be.equal(expected);
        });
    }
});

suite('OS Info - helpers', () => {
    test('isWindows', async () => {
        for (const info of [WIN_10]) {
            const result = isWindows(info);
            expect(result).to.be.equal(true, 'invalid value');
        }
        for (const info of [MAC_HIGH_SIERRA, UBUNTU_BIONIC, FEDORA]) {
            const result = isWindows(info);
            expect(result).to.be.equal(false, 'invalid value');
        }
    });

    test('isMac', async () => {
        for (const info of [MAC_HIGH_SIERRA]) {
            const result = isMac(info);
            expect(result).to.be.equal(true, 'invalid value');
        }
        for (const info of [WIN_10, UBUNTU_BIONIC, FEDORA]) {
            const result = isMac(info);
            expect(result).to.be.equal(false, 'invalid value');
        }
    });

    test('isLinux', async () => {
        for (const info of [UBUNTU_BIONIC, FEDORA]) {
            const result = isLinux(info);
            expect(result).to.be.equal(true, 'invalid value');
        }
        for (const info of [WIN_10, MAC_HIGH_SIERRA]) {
            const result = isLinux(info);
            expect(result).to.be.equal(false, 'invalid value');
        }
    });

    test('is64bit', async () => {
        const result1 = is64bit(WIN_10);
        const result2 = is64bit(OLD);

        expect(result1).to.be.equal(true, 'invalid value');
        expect(result2).to.be.equal(false, 'invalid value');
    });

    test('getPathVariableName - Windows', async () => {
        const result = getPathVariableName(WIN_10);

        expect(result).to.be.equal('Path', 'invalid value');
    });

    test('getPathVariableName - Mac', async () => {
        const result = getPathVariableName(MAC_HIGH_SIERRA);

        expect(result).to.be.equal('PATH', 'invalid value');
    });

    test('getPathVariableName - Linux', async () => {
        const result = getPathVariableName(UBUNTU_BIONIC);

        expect(result).to.be.equal('PATH', 'invalid value');
    });

    test('getVirtualEnvBinName - Windows', async () => {
        const result = getVirtualEnvBinName(WIN_10);

        expect(result).to.be.equal('scripts', 'invalid value');
    });

    test('getVirtualEnvBinName - Mac', async () => {
        const result = getVirtualEnvBinName(MAC_HIGH_SIERRA);

        expect(result).to.be.equal('bin', 'invalid value');
    });

    test('getVirtualEnvBinName - Linux', async () => {
        const result = getVirtualEnvBinName(UBUNTU_BIONIC);

        expect(result).to.be.equal('bin', 'invalid value');
    });

});
