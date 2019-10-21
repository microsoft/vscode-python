// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as fsextra from 'fs-extra';
import {
    FileSystemUtils, RawFileSystem
} from '../../../client/common/platform/fileSystem';
import {
    IFileSystemUtils, IRawFileSystem
} from '../../../client/common/platform/types';
import {
    DOES_NOT_EXIST, assertDoesNotExist, assertExists, FSFixture, WINDOWS
} from './filesystem.functional.test';

// Note: all functional tests that do not trigger the VS Code "fs" API
// are found in filesystem.functional.test.ts.

// tslint:disable:max-func-body-length chai-vague-errors

suite('Raw FileSystem', () => {
    let filesystem: IRawFileSystem;
    let fix: FSFixture;
    setup(() => {
        filesystem = RawFileSystem.withDefaults();
        fix = new FSFixture();
    });
    teardown(async () => {
        await fix.cleanUp();
    });

    suite('rmtree', () => {
        test('deletes the directory and everything in it', async () => {
            const dirname = await fix.createDirectory('x');
            const filename = await fix.createFile('x/y/z/spam.py');
            await assertExists(filename);

            await filesystem.rmtree(dirname);

            await assertDoesNotExist(dirname);
        });

        test('fails if the directory does not exist', async () => {
            const promise = filesystem.rmtree(DOES_NOT_EXIST);

            await expect(promise).to.eventually.be.rejected;
        });
    });

    suite('rmfile', () => {
        test('deletes the file', async () => {
            const filename = await fix.createFile('x/y/z/spam.py', '...');
            await assertExists(filename);

            await filesystem.rmfile(filename);

            await assertDoesNotExist(filename);
        });

        test('fails if the file does not exist', async () => {
            const promise = filesystem.rmfile(DOES_NOT_EXIST);

            await expect(promise).to.eventually.be.rejected;
        });
    });
});

suite('FileSystem Utils', () => {
    let utils: IFileSystemUtils;
    let fix: FSFixture;
    setup(() => {
        utils = FileSystemUtils.withDefaults();
        fix = new FSFixture();
    });
    teardown(async () => {
        await fix.cleanUp();
    });

    suite('isDirReadonly', () => {
        suite('non-Windows', () => {
            suiteSetup(function () {
                if (WINDOWS) {
                    // tslint:disable-next-line:no-invalid-this
                    this.skip();
                }
            });

            // On Windows, chmod won't have any effect on the file itself.
            test('is readonly', async () => {
                const dirname = await fix.createDirectory('x/y/z/spam');
                await fsextra.chmod(dirname, 0o444);

                const isReadonly = await utils.isDirReadonly(dirname);

                expect(isReadonly).to.equal(true);
            });
        });

        test('is not readonly', async () => {
            const dirname = await fix.createDirectory('x/y/z/spam');

            const isReadonly = await utils.isDirReadonly(dirname);

            expect(isReadonly).to.equal(false);
        });

        test('fails if the file does not exist', async () => {
            const promise = utils.isDirReadonly(DOES_NOT_EXIST);

            await expect(promise).to.eventually.be.rejected;
        });
    });
});
