// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as fsextra from 'fs-extra';
import {
    FileSystemUtils, RawFileSystem
} from '../../../client/common/platform/fileSystem';
import {
    FileType,
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

    suite('listdir', () => {
        test('mixed', async () => {
            // Create the target directory and its contents.
            const dirname = await fix.createDirectory('x/y/z');
            await fix.createFile('x/y/z/__init__.py', '');
            const script = await fix.createFile('x/y/z/__main__.py', '<script here>');
            await fix.createFile('x/y/z/spam.py', '...');
            await fix.createSocket('x/y/z/ipc.sock');
            await fix.createFile('x/y/z/eggs.py', '"""..."""');
            await fix.createSymlink(
                'x/y/z/info.py',
                // Link to an ignored file.
                await fix.createFile('x/_info.py', '<info here>') // source
            );
            await fix.createDirectory('x/y/z/w');
            // Create other files and directories (should be ignored).
            await fix.createSymlink(
                'my-script.py',
                // Link to a listed file.
                script // source (__main__.py)
            );
            const ignored1 = await fix.createFile('x/__init__.py', '');
            await fix.createFile('x/y/__init__.py', '');
            await fix.createSymlink(
                'x/y/z/w/__init__.py',
                ignored1 // source (x/__init__.py)
            );
            await fix.createDirectory('x/y/z/w/data');
            await fix.createFile('x/y/z/w/data/v1.json');

            const entries = await filesystem.listdir(dirname);

            expect(entries.sort()).to.deep.equal([
                ['__init__.py', FileType.File],
                ['__main__.py', FileType.File],
                ['eggs.py', FileType.File],
                ['info.py', FileType.SymbolicLink],
                ['ipc.sock', FileType.Unknown],
                ['spam.py', FileType.File],
                ['w', FileType.Directory]
            ]);
        });

        test('empty', async () => {
            const dirname = await fix.createDirectory('x/y/z/eggs');

            const entries = await filesystem.listdir(dirname);

            expect(entries).to.deep.equal([]);
        });

        test('fails if the directory does not exist', async () => {
            const promise = filesystem.listdir(DOES_NOT_EXIST);

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

    suite('getSubDirectories', () => {
        test('mixed types', async () => {
            const symlinkSource = await fix.createFile('x/info.py');
            const dirname = await fix.createDirectory('x/y/z/scripts');
            const subdir1 = await fix.createDirectory('x/y/z/scripts/w');
            await fix.createFile('x/y/z/scripts/spam.py');
            const subdir2 = await fix.createDirectory('x/y/z/scripts/v');
            await fix.createFile('x/y/z/scripts/eggs.py');
            await fix.createSocket('x/y/z/scripts/spam.sock');
            await fix.createSymlink('x/y/z/scripts/other', symlinkSource);
            await fix.createFile('x/y/z/scripts/data.json');

            const results = await utils.getSubDirectories(dirname);

            expect(results.sort()).to.deep.equal([
                subdir2,
                subdir1
            ]);
        });

        test('empty if the directory does not exist', async () => {
            const entries = await utils.getSubDirectories(DOES_NOT_EXIST);

            expect(entries).to.deep.equal([]);
        });
    });

    suite('getFiles', () => {
        test('mixed types', async () => {
            const symlinkSource = await fix.createFile('x/info.py');
            const dirname = await fix.createDirectory('x/y/z/scripts');
            await fix.createDirectory('x/y/z/scripts/w');
            const file1 = await fix.createFile('x/y/z/scripts/spam.py');
            await fix.createDirectory('x/y/z/scripts/v');
            const file2 = await fix.createFile('x/y/z/scripts/eggs.py');
            await fix.createSocket('x/y/z/scripts/spam.sock');
            await fix.createSymlink('x/y/z/scripts/other', symlinkSource);
            const file3 = await fix.createFile('x/y/z/scripts/data.json');

            const results = await utils.getFiles(dirname);

            expect(results.sort()).to.deep.equal([
                file3,
                file2,
                file1
            ]);
        });

        test('empty if the directory does not exist', async () => {
            const entries = await utils.getFiles(DOES_NOT_EXIST);

            expect(entries).to.deep.equal([]);
        });
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
