// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as os from 'os';
import { parse, SemVer } from 'semver';
import { PlatformService } from '../../../client/common/platform/platformService';
import { OSDistro, OSType } from '../../../client/common/utils/platform';
import { parseVersion } from '../../../client/common/utils/version';

// tslint:disable-next-line:max-func-body-length
suite('PlatformService', () => {
    const osType = getOSType();
    test('pathVariableName', async () => {
        const expected = osType === OSType.Windows ? 'Path' : 'PATH';
        const svc = new PlatformService();
        const result = svc.pathVariableName;

        expect(result).to.be.equal(expected, 'invalid value');
    });

    test('virtualEnvBinName - Windows', async () => {
        const expected = osType === OSType.Windows ? 'Scripts' : 'bin';
        const svc = new PlatformService();
        const result = svc.virtualEnvBinName;

        expect(result).to.be.equal(expected, 'invalid value');
    });

    test('isWindows', async () => {
        const expected = osType === OSType.Windows;
        const svc = new PlatformService();
        const result = svc.isWindows;

        expect(result).to.be.equal(expected, 'invalid value');
    });

    test('isMac', async () => {
        const expected = osType === OSType.OSX;
        const svc = new PlatformService();
        const result = svc.isMac;

        expect(result).to.be.equal(expected, 'invalid value');
    });

    test('isLinux', async () => {
        const expected = osType === OSType.Linux;
        const svc = new PlatformService();
        const result = svc.isLinux;

        expect(result).to.be.equal(expected, 'invalid value');
    });

    test('is64bit', async () => {
        let expected = true;
        if (os.arch() !== 'x64') {
            expected = false;
        }
        const svc = new PlatformService();
        const result = svc.is64bit;

        expect(result).to.be.equal(expected, 'invalid value');
    });

    test('getVersion on Mac/Windows', async function () {
        if (osType === OSType.Linux) {
            // tslint:disable-next-line:no-invalid-this
            return this.skip();
        }
        const expectedVersion = parse(os.release())!;
        const svc = new PlatformService();
        const result = await svc.getVersion();

        expect(result.compare(expectedVersion)).to.be.equal(0, 'invalid value');
    });
    test('getVersion on Linux', async function () {
        if (osType !== OSType.Linux) {
            // tslint:disable-next-line:no-invalid-this
            return this.skip();
        }
        const info = await getLinuxDistro();
        const expectedVersion = info[1];
        const svc = new PlatformService();
        const result = await svc.getVersion();

        expect(result.compare(expectedVersion)).to.be.equal(0, 'invalid value');
    });
    test('getDistro', async () => {
        const info = osType === OSType.Linux ? await getLinuxDistro() : [OSDistro.Unknown, undefined];
        const expectedDistro = info[0];
        const svc = new PlatformService();
        const result = await svc.getOSDistro();

        expect(result).to.be.equal(expectedDistro, 'invalid value');
    });
});

function getOSType(platform: string = process.platform): OSType {
    if (/^win/.test(platform)) {
        return OSType.Windows;
    } else if (/^darwin/.test(platform)) {
        return OSType.OSX;
    } else if (/^linux/.test(platform)) {
        return OSType.Linux;
    } else {
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
