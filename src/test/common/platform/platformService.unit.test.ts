// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as os from 'os';
import { getOSInfo } from '../../../client/common/platform/osinfo';
import { PlatformService } from '../../../client/common/platform/platformService';

// tslint:disable-next-line:max-func-body-length
suite('PlatformService', () => {
    test('local info', async () => {
        const expected = getOSInfo();
        const svc = new PlatformService();
        const info = svc.os;

        expect(info).to.deep.equal(expected, 'invalid value');
    });

    test('pathVariableName', async () => {
        let expected = 'PATH';
        if (/^win/.test(process.platform)) {
            expected = 'Path';
        }
        const svc = new PlatformService();
        const result = svc.pathVariableName;

        expect(result).to.be.equal(expected, 'invalid value');
    });

    test('virtualEnvBinName - Windows', async () => {
        let expected = 'bin';
        if (/^win/.test(process.platform)) {
            expected = 'scripts';
        }
        const svc = new PlatformService();
        const result = svc.virtualEnvBinName;

        expect(result).to.be.equal(expected, 'invalid value');
    });

    test('isWindows', async () => {
        let expected = false;
        if (/^win/.test(process.platform)) {
            expected = true;
        }
        const svc = new PlatformService();
        const result = svc.isWindows;

        expect(result).to.be.equal(expected, 'invalid value');
    });

    test('isMac', async () => {
        let expected = false;
        if (/^darwin/.test(process.platform)) {
            expected = true;
        }
        const svc = new PlatformService();
        const result = svc.isMac;

        expect(result).to.be.equal(expected, 'invalid value');
    });

    test('isLinux', async () => {
        let expected = false;
        if (/^linux/.test(process.platform)) {
            expected = true;
        }
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
});
