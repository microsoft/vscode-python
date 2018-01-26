// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as fs from 'fs-extra';
import * as TypeMoq from 'typemoq';
import { FileSystem } from '../../../client/common/platform/fileSystem';
import { IFileSystem, IPlatformService } from '../../../client/common/platform/types';

// tslint:disable-next-line:max-func-body-length
suite('FileSystem', () => {
    let platformService: TypeMoq.IMock<IPlatformService>;
    let fileSystem: IFileSystem;
    setup(() => {
        platformService = TypeMoq.Mock.ofType<IPlatformService>();
        fileSystem = new FileSystem(platformService.object);
    });

    test('ReadFile returns contents of a file', async () => {
        const file = __filename;
        const expectedContents = await fs.readFile(file).then(buffer => buffer.toString());
        const content = await fileSystem.readFile(file);

        expect(content).to.be.equal(expectedContents);
    });

    test('ReadFile throws an exception if file does not exist', async () => {
        const readPromise = fs.readFile('xyz', { encoding: 'utf8' });
        await expect(readPromise).to.be.rejectedWith();
    });

    function caseSensitivityFileCheck(isWindows: boolean, isOsx: boolean, isLinux: boolean) {
        platformService.setup(p => p.isWindows).returns(() => isWindows);
        platformService.setup(p => p.isMac).returns(() => isOsx);
        platformService.setup(p => p.isLinux).returns(() => isLinux);
        const path1 = 'c:\\users\\Peter Smith\\my documents\\test.txt';
        const path2 = 'c:\\USERS\\Peter Smith\\my documents\\test.TXT';
        const path3 = 'c:\\USERS\\Peter Smith\\my documents\\test.exe';

        if (isWindows) {
            expect(fileSystem.arePathsSame(path1, path2)).to.be.equal(true, 'file paths do not match (windows)');
        } else {
            expect(fileSystem.arePathsSame(path1, path2)).to.be.equal(false, 'file match (non windows)');
        }

        expect(fileSystem.arePathsSame(path1, path1)).to.be.equal(true, '1. file paths do not match');
        expect(fileSystem.arePathsSame(path2, path2)).to.be.equal(true, '2. file paths do not match');
        expect(fileSystem.arePathsSame(path1, path3)).to.be.equal(false, '2. file paths do not match');
    }

    test('Case sensitivity is ignored when comparing file names on windows', async () => {
        caseSensitivityFileCheck(true, false, false);
    });

    test('Case sensitivity is not ignored when comparing file names on osx', async () => {
        caseSensitivityFileCheck(false, true, false);
    });

    test('Case sensitivity is not ignored when comparing file names on linux', async () => {
        caseSensitivityFileCheck(false, false, true);
    });
});
