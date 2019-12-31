// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as os from 'os';
import { parse } from 'semver';
import { PlatformService } from '../../../client/common/platform/platformService';
import { OSType } from '../../../client/common/utils/platform';

use(chaiAsPromised);

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

    test('osRelease', async () => {
        const expected = os.release();
        const svc = new PlatformService();
        const result = svc.osRelease;

        expect(result).to.be.equal(expected, 'invalid value');
    });

    test('is64bit', async () => {
        // tslint:disable-next-line:no-require-imports
        const arch = require('arch');

        const hostReports64Bit = arch() === 'x64';
        const svc = new PlatformService();
        const result = svc.is64bit;

        expect(result).to.be.equal(hostReports64Bit, `arch() reports '${arch()}', PlatformService.is64bit reports ${result}.`);
    });

    test('getVersion on Mac/Windows', async function() {
        if (osType === OSType.Linux) {
            // tslint:disable-next-line:no-invalid-this
            return this.skip();
        }
        const expectedVersion = parse(os.release())!;
        const svc = new PlatformService();
        const result = await svc.getVersion();

        expect(result.compare(expectedVersion)).to.be.equal(0, 'invalid value');
    });
    test('getVersion on Linux shoud throw an exception', async function() {
        if (osType !== OSType.Linux) {
            // tslint:disable-next-line:no-invalid-this
            return this.skip();
        }
        const svc = new PlatformService();

        await expect(svc.getVersion()).to.eventually.be.rejectedWith('Not Supported');
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
