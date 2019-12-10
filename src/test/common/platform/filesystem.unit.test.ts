// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:max-func-body-length

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { FileSystem } from '../../../client/common/platform/fileSystem';
import { IPlatformService } from '../../../client/common/platform/types';

suite('FileSystem', () => {
    let platformService: TypeMoq.IMock<IPlatformService>;
    let fileSystem: FileSystem;
    setup(() => {
        platformService = TypeMoq.Mock.ofType<IPlatformService>();
        fileSystem = new FileSystem(platformService.object);
    });

    suite('path-related', () => {
        suite('arePathsSame', () => {
            function caseSensitivityFileCheck(isWindows: boolean, isOsx: boolean, isLinux: boolean) {
                platformService.setup(p => p.isWindows).returns(() => isWindows);
                platformService.setup(p => p.isMac).returns(() => isOsx);
                platformService.setup(p => p.isLinux).returns(() => isLinux);
                const path1 = 'c:\\users\\Peter Smith\\my documents\\test.txt';
                const path2 = 'c:\\USERS\\Peter Smith\\my documents\\test.TXT';
                const path3 = 'c:\\USERS\\Peter Smith\\my documents\\test.exe';

                const res11 = fileSystem.arePathsSame(path1, path1);
                const res12 = fileSystem.arePathsSame(path1, path2);
                const res13 = fileSystem.arePathsSame(path1, path3);
                const res22 = fileSystem.arePathsSame(path2, path2);

                if (isWindows) {
                    expect(res12).to.be.equal(true, 'file paths do not match (windows)');
                } else {
                    expect(res12).to.be.equal(false, 'file match (non windows)');
                }
                expect(res11).to.be.equal(true, '1. file paths do not match');
                expect(res22).to.be.equal(true, '2. file paths do not match');
                expect(res13).to.be.equal(false, '2. file paths do not match');
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
    });
});
