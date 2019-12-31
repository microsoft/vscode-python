// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:max-func-body-length

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { FileSystem } from '../../../client/common/platform/fileSystem';
import { IPlatformService } from '../../../client/common/platform/types';
import { getNamesAndValues } from '../../../client/common/utils/enum';
import { OSType } from '../../../client/common/utils/platform';

suite('FileSystem', () => {
    let platformService: TypeMoq.IMock<IPlatformService>;
    let fileSystem: FileSystem;
    setup(() => {
        platformService = TypeMoq.Mock.ofType<IPlatformService>(undefined, TypeMoq.MockBehavior.Strict);
        fileSystem = new FileSystem(platformService.object);
    });
    function verifyAll() {
        platformService.verifyAll();
    }

    suite('path-related', () => {
        const caseInsensitive = [OSType.Windows];

        suite('arePathsSame', () => {
            getNamesAndValues<OSType>(OSType).forEach(item => {
                const osType = item.value;

                function setPlatform(numCalls = 1) {
                    platformService
                        .setup(p => p.isWindows)
                        .returns(() => osType === OSType.Windows)
                        .verifiable(TypeMoq.Times.exactly(numCalls));
                }

                test(`True if paths are identical (type: ${item.name})`, () => {
                    setPlatform(2);
                    const path1 = 'c:\\users\\Peter Smith\\my documents\\test.txt';
                    const path2 = 'c:\\USERS\\Peter Smith\\my documents\\test.TXT';

                    const areSame11 = fileSystem.arePathsSame(path1, path1);
                    const areSame22 = fileSystem.arePathsSame(path2, path2);

                    expect(areSame11).to.be.equal(true, '1. file paths do not match');
                    expect(areSame22).to.be.equal(true, '2. file paths do not match');
                    verifyAll();
                });

                test(`False if paths are completely different (type: ${item.name})`, () => {
                    setPlatform();
                    const path1 = 'c:\\users\\Peter Smith\\my documents\\test.txt';
                    const path2 = 'c:\\users\\Peter Smith\\my documents\\test.exe';

                    const areSame = fileSystem.arePathsSame(path1, path2);

                    expect(areSame).to.be.equal(false, 'file paths do not match');
                    verifyAll();
                });

                if (caseInsensitive.includes(osType)) {
                    test(`True if paths only differ by case (type: ${item.name})`, () => {
                        setPlatform();
                        const path1 = 'c:\\users\\Peter Smith\\my documents\\test.txt';
                        const path2 = 'c:\\USERS\\Peter Smith\\my documents\\test.TXT';

                        const areSame = fileSystem.arePathsSame(path1, path2);

                        expect(areSame).to.be.equal(true, 'file paths match');
                        verifyAll();
                    });
                } else {
                    test(`False if paths only differ by case (type: ${item.name})`, () => {
                        setPlatform();
                        const path1 = 'c:\\users\\Peter Smith\\my documents\\test.txt';
                        const path2 = 'c:\\USERS\\Peter Smith\\my documents\\test.TXT';

                        const areSame = fileSystem.arePathsSame(path1, path2);

                        expect(areSame).to.be.equal(false, 'file paths do not match');
                        verifyAll();
                    });
                }

                // Missing tests:
                // * exercize normalization
            });
        });
    });
});
