// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as semver from 'semver';
import { getOSInfo, getOSType, is64bit, isLinux, isMac, isWindows } from '../../../client/common/platform/osinfo';
import { OSDistro, OSInfo, OSType } from '../../../client/common/platform/types';
import { Stub } from '../../../test/stub';

// Windows
const WIN_10 = new OSInfo(
    OSType.Windows,
    'x64',
    new semver.SemVer('10.0.1'));
const WIN_7 = new OSInfo(
    OSType.Windows,
    'x64',
    new semver.SemVer('6.1.3'));
const WIN_XP = new OSInfo(
    OSType.Windows,
    'x64',
    new semver.SemVer('5.1.7'));
// OS X
const MAC_HIGH_SIERRA = new OSInfo(
    OSType.OSX,
    'x64',
    new semver.SemVer('10.13.1'));
const MAC_SIERRA = new OSInfo(
    OSType.OSX,
    'x64',
    new semver.SemVer('10.12.2'));
const MAC_EL_CAPITAN = new OSInfo(
    OSType.OSX,
    'x64',
    new semver.SemVer('10.11.5'));

// Linux
const UBUNTU_BIONIC = new OSInfo(
    OSType.Linux,
    'x64',
    semver.coerce('18.04') || new semver.SemVer('0.0.0'),
    OSDistro.Ubuntu);
// tslint:disable-next-line:no-multiline-string
const UBUNTU_BIONIC_FILE = `
NAME="Ubuntu"
VERSION="18.04.1 LTS (Bionic Beaver)"
ID=ubuntu
ID_LIKE=debian
PRETTY_NAME="Ubuntu 18.04.1 LTS"
VERSION_ID="18.04"
HOME_URL="https://www.ubuntu.com/"
SUPPORT_URL="https://help.ubuntu.com/"
BUG_REPORT_URL="https://bugs.launchpad.net/ubuntu/"
PRIVACY_POLICY_URL="https://www.ubuntu.com/legal/terms-and-policies/privacy-policy"
VERSION_CODENAME=bionic
UBUNTU_CODENAME=bionic
`;
const UBUNTU_PRECISE = new OSInfo(
    OSType.Linux,
    'x64',
    semver.coerce('14.04') || new semver.SemVer('0.0.0'),
    OSDistro.Ubuntu);
// tslint:disable-next-line:no-multiline-string
const UBUNTU_PRECISE_FILE = `
NAME="Ubuntu"
VERSION="14.04.4 LTS, Trusty Tahr"
ID=ubuntu
ID_LIKE=debian
PRETTY_NAME="Ubuntu 14.04.4 LTS"
VERSION_ID="14.04"
HOME_URL="http://www.ubuntu.com/"
SUPPORT_URL="http://help.ubuntu.com/"
BUG_REPORT_URL="http://bugs.launchpad.net/ubuntu/"
`;
const FEDORA = new OSInfo(
    OSType.Linux,
    'x64',
    semver.coerce('24') || new semver.SemVer('0.0.0'),
    OSDistro.Fedora);
// tslint:disable-next-line:no-multiline-string
const FEDORA_FILE = `
NAME=Fedora
VERSION="24 (Workstation Edition)"
ID=fedora
VERSION_ID=24
PRETTY_NAME="Fedora 24 (Workstation Edition)"
CPE_NAME="cpe:/o:fedoraproject:fedora:24"
HOME_URL="https://fedoraproject.org/"
BUG_REPORT_URL="https://bugzilla.redhat.com/"
REDHAT_BUGZILLA_PRODUCT="Fedora"
REDHAT_BUGZILLA_PRODUCT_VERSION=24
REDHAT_SUPPORT_PRODUCT="Fedora"
REDHAT_SUPPORT_PRODUCT_VERSION=24
PRIVACY_POLICY_URL=https://fedoraproject.org/wiki/Legal:PrivacyPolicy
VARIANT="Workstation Edition"
VARIANT_ID=workstation
`;
const ARCH = new OSInfo(
    OSType.Linux,
    'x64',
    semver.coerce('') || new semver.SemVer('0.0.0'),  // rolling vs. 2018.08.01
    OSDistro.Arch);
// tslint:disable-next-line:no-multiline-string
const ARCH_FILE = `
NAME="Arch Linux"
PRETTY_NAME="Arch Linux"
ID=arch
ID_LIKE=archlinux
HOME_URL="https://www.archlinux.org/"
SUPPORT_URL="https://bbs.archlinux.org/"
BUG_REPORT_URL="https://bugs.archlinux.org/"
`;

const OLD = new OSInfo(
    OSType.Windows,
    'x86',
    new semver.SemVer('5.1.7'));

class StubDeps {
    public returnReadFile: string = '';
    public returnGetArch: string = '';
    public returnGetRelease: string = '';

    constructor(
        public stub: Stub = new Stub()) {}

    public readFile(filename: string): string {
        this.stub.addCall('readFile', filename);
        this.stub.maybeErr();
        return this.returnReadFile;
    }

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
}

suite('OS Info - getOSInfo()', () => {
    let stub: Stub;
    let deps: StubDeps;

    setup(() => {
        stub = new Stub();
        deps = new StubDeps(stub);
    });

    const tests: [string, string, string, string, OSInfo][] = [
        ['windows', 'x64', '10.0.1', '', WIN_10],
        ['windows', 'x64', '6.1.3', '', WIN_7],
        ['windows', 'x64', '5.1.7', '', WIN_XP],

        ['darwin', 'x64', '10.13.1', '', MAC_HIGH_SIERRA],
        ['darwin', 'x64', '10.12.2', '', MAC_SIERRA],
        ['darwin', 'x64', '10.11.5', '', MAC_EL_CAPITAN],

        ['linux', 'x64', '4.1.4', UBUNTU_BIONIC_FILE, UBUNTU_BIONIC],
        ['linux', 'x64', '4.1.4', UBUNTU_PRECISE_FILE, UBUNTU_PRECISE],
        ['linux', 'x64', '4.1.4', FEDORA_FILE, FEDORA],
        ['linux', 'x64', '4.1.4', ARCH_FILE, ARCH],

        ['windows', 'x86', '5.1.7', '', OLD]
    ];
    let i = 0;
    for (const [platform, arch, release, osFile, expected] of tests) {
        test(`${i} - ${platform} ${arch} ${release}`, async () => {
            deps.returnGetArch = arch;
            deps.returnGetRelease = release;
            deps.returnReadFile = osFile;
            const result = getOSInfo(
                (fn: string) => deps.readFile(fn),
                () => deps.getArch(),
                () => deps.getRelease(),
                platform);

            expect(result).to.deep.equal(expected);
            if (osFile === '') {
                stub.checkCalls([
                    {funcName: 'getArch', args: []},
                    {funcName: 'getRelease', args: []}
                ]);
            } else {
                stub.checkCalls([
                    {funcName: 'getArch', args: []},
                    {funcName: 'readFile', args: ['/etc/os-release']}
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
});
