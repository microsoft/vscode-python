// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-unused-variable
import * as assert from 'assert';
import * as TypeMoq from 'typemoq';
import { PlatformData, PlatformLSExecutables } from '../../client/activation/platformData';
import { IFileSystem, IPlatformService } from '../../client/common/platform/types';

const testDataWinMac = [
    { isWindows: true, is64Bit: true, expectedName: 'win-x64' },
    { isWindows: true, is64Bit: false, expectedName: 'win-x86' },
    { isWindows: false, is64Bit: true, expectedName: 'osx-x64' }
];

const testDataLinux = [
    { name: 'centos', expectedName: 'linux-x64' },
    { name: 'debian', expectedName: 'linux-x64' },
    { name: 'fedora', expectedName: 'linux-x64' },
    { name: 'ol', expectedName: 'linux-x64' },
    { name: 'opensuse', expectedName: 'linux-x64' },
    { name: 'rhel', expectedName: 'linux-x64' },
    { name: 'ubuntu', expectedName: 'linux-x64' }
];

const testDataModuleName = [
    { isWindows: true, isMac: false, isLinux: false, expectedName: PlatformLSExecutables.Windows },
    { isWindows: false, isMac: true, isLinux: false, expectedName: PlatformLSExecutables.MacOS },
    { isWindows: false, isMac: false, isLinux: true, expectedName: PlatformLSExecutables.Linux }
];

// tslint:disable-next-line:max-func-body-length
suite('Activation - platform data', () => {
    test('Name and hash (Windows/Mac)', async () => {
        for (const t of testDataWinMac) {
            const platformService = TypeMoq.Mock.ofType<IPlatformService>();
            platformService.setup(x => x.isWindows).returns(() => t.isWindows);
            platformService.setup(x => x.isMac).returns(() => !t.isWindows);
            platformService.setup(x => x.is64bit).returns(() => t.is64Bit);

            const fs = TypeMoq.Mock.ofType<IFileSystem>();
            const pd = new PlatformData(platformService.object, fs.object);

            const actual = await pd.getPlatformName();
            assert.equal(actual, t.expectedName, `${actual} does not match ${t.expectedName}`);

            const actualHash = await pd.getExpectedHash();
            assert.equal(actualHash, t.expectedName, `${actual} hash not match ${t.expectedName}`);
        }
    });
    test('Name and hash (Linux)', async () => {
        for (const t of testDataLinux) {
            const platformService = TypeMoq.Mock.ofType<IPlatformService>();
            platformService.setup(x => x.isWindows).returns(() => false);
            platformService.setup(x => x.isMac).returns(() => false);
            platformService.setup(x => x.isLinux).returns(() => true);
            platformService.setup(x => x.is64bit).returns(() => true);

            const fs = TypeMoq.Mock.ofType<IFileSystem>();
            fs.setup(x => x.readFile(TypeMoq.It.isAnyString())).returns(() => Promise.resolve(`NAME="name"\nID=${t.name}\nID_LIKE=debian`));
            const pd = new PlatformData(platformService.object, fs.object);

            const actual = await pd.getPlatformName();
            assert.equal(actual, t.expectedName, `${actual} does not match ${t.expectedName}`);

            const actualHash = await pd.getExpectedHash();
            assert.equal(actual, t.expectedName, `${actual} hash not match ${t.expectedName}`);
        }
    });
    test('Module name', async () => {
        for (const t of testDataModuleName) {
            const platformService = TypeMoq.Mock.ofType<IPlatformService>();
            platformService.setup(x => x.isWindows).returns(() => t.isWindows);
            platformService.setup(x => x.isLinux).returns(() => t.isLinux);
            platformService.setup(x => x.isMac).returns(() => t.isMac);

            const fs = TypeMoq.Mock.ofType<IFileSystem>();
            const pd = new PlatformData(platformService.object, fs.object);

            const actual = pd.getEngineExecutableName();
            assert.equal(actual, t.expectedName, `${actual} does not match ${t.expectedName}`);
        }
    });
});
