// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:max-func-body-length

import { expect } from 'chai';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { FileSystemPathUtils } from '../../../client/common/platform/fs-paths';
import { getNamesAndValues } from '../../../client/common/utils/enum';
import { OSType } from '../../../client/common/utils/platform';

interface IUtilsDeps {
    // executables
    delimiter: string;
    envVar: string;
    // paths
    readonly sep: string;
    join(...filenames: string[]): string;
    dirname(filename: string): string;
    basename(filename: string, suffix?: string): string;
    normalize(filename: string): string;
    normCase(filename: string): string;
    // node "path"
    relative(relpath: string, rootpath: string): string;
}

suite('FileSystem - Path Utils', () => {
    let deps: TypeMoq.IMock<IUtilsDeps>;
    let utils: FileSystemPathUtils;
    setup(() => {
        deps = TypeMoq.Mock.ofType<IUtilsDeps>(undefined, TypeMoq.MockBehavior.Strict);
        // prettier-ignore
        utils = new FileSystemPathUtils(
            'my-home',
            deps.object,
            deps.object,
            deps.object
        );
    });
    function verifyAll() {
        deps.verifyAll();
    }

    suite('path-related', () => {
        const caseInsensitive = [OSType.Windows];

        suite('arePathsSame', () => {
            getNamesAndValues<OSType>(OSType).forEach(item => {
                const osType = item.value;

                function setNormCase(filename: string, numCalls = 1): string {
                    // prettier-ignore
                    const norm = (osType === OSType.Windows)
                        ? path.normalize(filename).toUpperCase()
                        : filename;
                    deps.setup(d => d.normCase(filename))
                        .returns(() => norm)
                        .verifiable(TypeMoq.Times.exactly(numCalls));
                    return filename;
                }

                // prettier-ignore
                [
                    'c:\\users\\Peter Smith\\my documents\\test.txt',

                    'c:\\USERS\\Peter Smith\\my documents\\test.TXT'
                ].forEach(path1 => {
                    test(`True if paths are identical (type: ${item.name}) - ${path1}`, () => {
                        path1 = setNormCase(path1, 2);

                        const areSame = utils.arePathsSame(path1, path1);

                        expect(areSame).to.be.equal(true, 'file paths do not match');
                        verifyAll();
                    });
                });

                test(`False if paths are completely different (type: ${item.name})`, () => {
                    const path1 = setNormCase('c:\\users\\Peter Smith\\my documents\\test.txt');
                    const path2 = setNormCase('c:\\users\\Peter Smith\\my documents\\test.exe');

                    const areSame = utils.arePathsSame(path1, path2);

                    expect(areSame).to.be.equal(false, 'file paths do not match');
                    verifyAll();
                });

                if (caseInsensitive.includes(osType)) {
                    test(`True if paths only differ by case (type: ${item.name})`, () => {
                        const path1 = setNormCase('c:\\users\\Peter Smith\\my documents\\test.txt');
                        const path2 = setNormCase('c:\\USERS\\Peter Smith\\my documents\\test.TXT');

                        const areSame = utils.arePathsSame(path1, path2);

                        expect(areSame).to.be.equal(true, 'file paths match');
                        verifyAll();
                    });
                } else {
                    test(`False if paths only differ by case (type: ${item.name})`, () => {
                        const path1 = setNormCase('c:\\users\\Peter Smith\\my documents\\test.txt');
                        const path2 = setNormCase('c:\\USERS\\Peter Smith\\my documents\\test.TXT');

                        const areSame = utils.arePathsSame(path1, path2);

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
