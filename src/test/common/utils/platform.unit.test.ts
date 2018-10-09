// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as semver from 'semver';
import {
    getInfo, getOSType, Info,
    is64bit, isLinux, isMac, isWindows,
    matchPlatform,
    OSDistro, OSType
} from '../../../client/common/utils/platform';
import { parseVersion } from '../../../client/common/utils/version';
import { Stub } from '../../stub';

// Windows
export const WIN_10 = new Info(
    OSType.Windows,
    'x64',
    new semver.SemVer('10.0.1'));
export const WIN_7 = new Info(
    OSType.Windows,
    'x64',
    new semver.SemVer('6.1.3'));
export const WIN_XP = new Info(
    OSType.Windows,
    'x64',
    new semver.SemVer('5.1.7'));
// OS X
export const MAC_HIGH_SIERRA = new Info(
    OSType.OSX,
    'x64',
    new semver.SemVer('10.13.1'));
export const MAC_SIERRA = new Info(
    OSType.OSX,
    'x64',
    new semver.SemVer('10.12.2'));
export const MAC_EL_CAPITAN = new Info(
    OSType.OSX,
    'x64',
    new semver.SemVer('10.11.5'));

// Linux
export const UBUNTU_BIONIC = new Info(
    OSType.Linux,
    'x64',
    parseVersion('18.04'),
    //semver.coerce('18.04') || new semver.SemVer('0.0.0'),
    OSDistro.Ubuntu);
export const UBUNTU_PRECISE = new Info(
    OSType.Linux,
    'x64',
    parseVersion('14.04'),
    //semver.coerce('14.04') || new semver.SemVer('0.0.0'),
    OSDistro.Ubuntu);
export const FEDORA = new Info(
    OSType.Linux,
    'x64',
    parseVersion('24'),
    //semver.coerce('24') || new semver.SemVer('0.0.0'),
    OSDistro.Fedora);
export const ARCH = new Info(
    OSType.Linux,
    'x64',
    new semver.SemVer('0.0.0'),  // rolling vs. 2018.08.01
    OSDistro.Arch);

export const OLD = new Info(
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

suite('OS Info - getInfo()', () => {
    let stub: Stub;
    let deps: StubDeps;

    setup(() => {
        stub = new Stub();
        deps = new StubDeps(stub);
    });

    const NOT_LINUX: [OSDistro, string] = [OSDistro.Unknown, ''];
    const tests: [string, string, string, [OSDistro, string], Info][] = [
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
            const result = getInfo(
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

// tslint:disable-next-line:max-func-body-length
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

    test('matchPlatform - any', async () => {
        const cases: [string, Info, boolean][] = [
            ['', WIN_10, true],
            ['', MAC_HIGH_SIERRA, true],
            ['', UBUNTU_BIONIC, true],
            ['', FEDORA, true],
            ['', ARCH, true]
        ];
        for (const [names, info, expected] of cases) {
            const result = matchPlatform(names, info);

            expect(result).to.be.equal(expected);
        }
    });

    test('matchPlatform - Windows', async () => {
        const cases: [string, Info, boolean][] = [
            ['win', WIN_10, true],
            ['win', MAC_HIGH_SIERRA, false],
            ['win', UBUNTU_BIONIC, false],
            ['win', FEDORA, false],
            ['win', ARCH, false],

            ['-win', WIN_10, false],
            ['-win', MAC_HIGH_SIERRA, true],
            ['-win', UBUNTU_BIONIC, true],
            ['-win', FEDORA, true],
            ['-win', ARCH, true]
        ];
        for (const [names, info, expected] of cases) {
            const result = matchPlatform(names, info);

            expect(result).to.be.equal(expected);
        }
    });

    test('matchPlatform - OSX', async () => {
        const cases: [string, Info, boolean][] = [
            ['osx', MAC_HIGH_SIERRA, true],
            ['mac', MAC_HIGH_SIERRA, true],
            ['osx', WIN_10, false],
            ['osx', UBUNTU_BIONIC, false],
            ['osx', FEDORA, false],
            ['osx', ARCH, false],

            ['-osx', MAC_HIGH_SIERRA, false],
            ['-mac', MAC_HIGH_SIERRA, false],
            ['-osx', WIN_10, true],
            ['-osx', UBUNTU_BIONIC, true],
            ['-osx', FEDORA, true],
            ['-osx', ARCH, true]
        ];
        for (const [names, info, expected] of cases) {
            const result = matchPlatform(names, info);

            expect(result).to.be.equal(expected);
        }
    });

    test('matchPlatform - Linux', async () => {
        const cases: [string, Info, boolean][] = [
            ['linux', UBUNTU_BIONIC, true],
            ['linux', FEDORA, true],
            ['linux', ARCH, true],
            ['linux', WIN_10, false],
            ['linux', MAC_HIGH_SIERRA, false],

            ['-linux', UBUNTU_BIONIC, false],
            ['-linux', FEDORA, false],
            ['-linux', ARCH, false],
            ['-linux', WIN_10, true],
            ['-linux', MAC_HIGH_SIERRA, true]
        ];
        for (const [names, info, expected] of cases) {
            const result = matchPlatform(names, info);

            expect(result).to.be.equal(expected, `${names} ${info.type} ${info.distro}`);
        }
    });

    test('matchPlatform - ubuntu', async () => {
        const cases: [string, Info, boolean][] = [
            ['ubuntu', UBUNTU_BIONIC, true],
            ['ubuntu', FEDORA, false],
            ['ubuntu', ARCH, false],
            ['ubuntu', WIN_10, false],
            ['ubuntu', MAC_HIGH_SIERRA, false],

            ['-ubuntu', UBUNTU_BIONIC, false],
            ['-ubuntu', FEDORA, true],
            ['-ubuntu', ARCH, true],
            ['-ubuntu', WIN_10, true],
            ['-ubuntu', MAC_HIGH_SIERRA, true]
        ];
        for (const [names, info, expected] of cases) {
            const result = matchPlatform(names, info);

            expect(result).to.be.equal(expected, `${names} ${info.type} ${info.distro}`);
        }
    });

    test('matchPlatform - fedora', async () => {
        const cases: [string, Info, boolean][] = [
            ['fedora', FEDORA, true],
            ['fedora', UBUNTU_BIONIC, false],
            ['fedora', ARCH, false],
            ['fedora', WIN_10, false],
            ['fedora', MAC_HIGH_SIERRA, false],

            ['-fedora', FEDORA, false],
            ['-fedora', UBUNTU_BIONIC, true],
            ['-fedora', ARCH, true],
            ['-fedora', WIN_10, true],
            ['-fedora', MAC_HIGH_SIERRA, true]
        ];
        for (const [names, info, expected] of cases) {
            const result = matchPlatform(names, info);

            expect(result).to.be.equal(expected, `${names} ${info.type} ${info.distro}`);
        }
    });

    test('matchPlatform - arch', async () => {
        const cases: [string, Info, boolean][] = [
            ['arch', ARCH, true],
            ['arch', UBUNTU_BIONIC, false],
            ['arch', FEDORA, false],
            ['arch', WIN_10, false],
            ['arch', MAC_HIGH_SIERRA, false],

            ['-arch', ARCH, false],
            ['-arch', UBUNTU_BIONIC, true],
            ['-arch', FEDORA, true],
            ['-arch', WIN_10, true],
            ['-arch', MAC_HIGH_SIERRA, true]
        ];
        for (const [names, info, expected] of cases) {
            const result = matchPlatform(names, info);

            expect(result).to.be.equal(expected, `${names} ${info.type} ${info.distro}`);
        }
    });

    test('matchPlatform - multi', async () => {
        function runTest(names: string, cases: [Info, boolean][]) {
            for (const [info, expected] of cases) {
                const result = matchPlatform(names, info);

                expect(result).to.be.equal(expected);
            }
        }

        runTest('win|osx|linux', [
            [WIN_10, true],
            [MAC_HIGH_SIERRA, true],
            [UBUNTU_BIONIC, true],
            [ARCH, true]
        ]);
        runTest('win|osx', [
            [WIN_10, true],
            [MAC_HIGH_SIERRA, true],
            [UBUNTU_BIONIC, false],
            [ARCH, false]
        ]);
        runTest('osx|linux', [
            [WIN_10, false],
            [MAC_HIGH_SIERRA, true],
            [UBUNTU_BIONIC, true],
            [ARCH, true]
        ]);
    });
});
