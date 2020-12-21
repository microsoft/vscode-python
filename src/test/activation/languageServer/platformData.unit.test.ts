// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-unused-variable
import * as assert from 'assert';
import * as TypeMoq from 'typemoq';
import { PlatformData, PlatformLSExecutables } from '../../../client/activation/languageServer/platformData';
import { IPlatformService } from '../../../client/common/platform/types';

const testDataWinMac = [
    { isWindows: true, is64Bit: true, expectedName: 'win-x64' },
    { isWindows: true, is64Bit: false, expectedName: 'win-x86' },
    { isWindows: false, is64Bit: true, expectedName: 'osx-x64' },
];

const testDataLinux = [
    { name: 'centos', expectedName: 'linux-x64' },
    { name: 'debian', expectedName: 'linux-x64' },
    { name: 'fedora', expectedName: 'linux-x64' },
    { name: 'ol', expectedName: 'linux-x64' },
    { name: 'opensuse', expectedName: 'linux-x64' },
    { name: 'rhel', expectedName: 'linux-x64' },
    { name: 'ubuntu', expectedName: 'linux-x64' },
];

const testDataModuleName = [
    { isWindows: true, isMac: false, isLinux: false, expectedName: PlatformLSExecutables.Windows },
    { isWindows: false, isMac: true, isLinux: false, expectedName: PlatformLSExecutables.MacOS },
    { isWindows: false, isMac: false, isLinux: true, expectedName: PlatformLSExecutables.Linux },
];

// tslint:disable-next-line:max-func-body-length
suite('Language Server Activation - platform data', () => {
    test('Name and hash (Windows/Mac)', async () => {
        for (const t of testDataWinMac) {
            const platformService = TypeMoq.Mock.ofType<IPlatformService>();
            platformService.setup((x) => x.isWindows).returns(() => t.isWindows);
            platformService.setup((x) => x.isMac).returns(() => !t.isWindows);
            platformService.setup((x) => x.is64bit).returns(() => t.is64Bit);

            const pd = new PlatformData(platformService.object);

            const actual = pd.platformName;
            assert.equal(actual, t.expectedName, `${actual} does not match ${t.expectedName}`);
        }
    });
    test('Name and hash (Linux)', async () => {
        for (const t of testDataLinux) {
            const platformService = TypeMoq.Mock.ofType<IPlatformService>();
            platformService.setup((x) => x.isWindows).returns(() => false);
            platformService.setup((x) => x.isMac).returns(() => false);
            platformService.setup((x) => x.isLinux).returns(() => true);
            platformService.setup((x) => x.is64bit).returns(() => true);

            const pd = new PlatformData(platformService.object);

            const actual = pd.platformName;
            assert.equal(actual, t.expectedName, `${actual} does not match ${t.expectedName}`);
        }
    });
    test('Module name', async () => {
        for (const t of testDataModuleName) {
            const platformService = TypeMoq.Mock.ofType<IPlatformService>();
            platformService.setup((x) => x.isWindows).returns(() => t.isWindows);
            platformService.setup((x) => x.isLinux).returns(() => t.isLinux);
            platformService.setup((x) => x.isMac).returns(() => t.isMac);

            const pd = new PlatformData(platformService.object);

            const actual = pd.engineExecutableName;
            assert.equal(actual, t.expectedName, `${actual} does not match ${t.expectedName}`);
        }
    });
});
