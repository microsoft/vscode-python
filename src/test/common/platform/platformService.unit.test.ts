// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as semver from 'semver';
import { getOSInfo } from '../../../client/common/platform/osinfo';
import { PlatformService } from '../../../client/common/platform/platformService';
import { OSDistro, OSInfo, OSType } from '../../../client/common/platform/types';

const WINDOWS = new OSInfo(
    OSType.Windows,
    'x64',
    new semver.SemVer('10.0.1'));
const MAC = new OSInfo(
    OSType.OSX,
    'x64',
    new semver.SemVer('10.13.1'));
const LINUX = new OSInfo(
    OSType.Linux,
    'x64',
    semver.coerce('18.04') || new semver.SemVer('0.0.0'),
    OSDistro.Ubuntu);

// tslint:disable-next-line:max-func-body-length
suite('PlatformService', () => {
    test('local info', async () => {
        const expected = getOSInfo();
        const svc = new PlatformService();
        const info = svc.os;

        expect(info).to.deep.equal(expected, 'invalid value');
    });

    test('pathVariableName - Windows', async () => {
        const svc = new PlatformService(WINDOWS);
        const result = svc.pathVariableName;

        expect(result).to.be.equal('Path', 'invalid value');
    });

    test('pathVariableName - Mac', async () => {
        const svc = new PlatformService(MAC);
        const result = svc.pathVariableName;

        expect(result).to.be.equal('PATH', 'invalid value');
    });

    test('pathVariableName - Linux', async () => {
        const svc = new PlatformService(LINUX);
        const result = svc.pathVariableName;

        expect(result).to.be.equal('PATH', 'invalid value');
    });

    test('virtualEnvBinName - Windows', async () => {
        const svc = new PlatformService(WINDOWS);
        const result = svc.virtualEnvBinName;

        expect(result).to.be.equal('scripts', 'invalid value');
    });

    test('virtualEnvBinName - Mac', async () => {
        const svc = new PlatformService(MAC);
        const result = svc.virtualEnvBinName;

        expect(result).to.be.equal('bin', 'invalid value');
    });

    test('virtualEnvBinName - Linux', async () => {
        const svc = new PlatformService(LINUX);
        const result = svc.virtualEnvBinName;

        expect(result).to.be.equal('bin', 'invalid value');
    });

    //=======================
    // helpers

    test('isWindows', async () => {
        let svc = new PlatformService(WINDOWS);
        let  result = svc.isWindows;

        expect(result).to.be.equal(true, 'invalid value');

        for (const info of [MAC, LINUX]) {
            svc = new PlatformService(info);
            result = svc.isWindows;

            expect(result).to.be.equal(false, 'invalid value');
        }
    });

    test('isMac', async () => {
        let svc = new PlatformService(MAC);
        let result = svc.isMac;

        expect(result).to.be.equal(true, 'invalid value');

        for (const info of [WINDOWS, LINUX]) {
            svc = new PlatformService(info);
            result = svc.isMac;

            expect(result).to.be.equal(false, 'invalid value');
        }
    });

    test('isLinux', async () => {
        let svc = new PlatformService(LINUX);
        let result = svc.isLinux;

        expect(result).to.be.equal(true, 'invalid value');

        for (const info of [WINDOWS, MAC]) {
            svc = new PlatformService(info);
            result = svc.isLinux;

            expect(result).to.be.equal(false, 'invalid value');
        }
    });

    test('is64bit', async () => {
        for (const info of [WINDOWS, MAC, LINUX]) {
            const svc = new PlatformService(info);
            const result = svc.is64bit;

            expect(result).to.be.equal(true, 'invalid value');
        }

        const info2 = new OSInfo(
            OSType.Windows,
            'x86',
            new semver.SemVer('10.0.1'));
        const svc2 = new PlatformService(info2);
        const result2 = svc2.is64bit;

        expect(result2).to.be.equal(false, 'invalid value');

    });
});
