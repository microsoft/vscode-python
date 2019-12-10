// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as fsextra from 'fs-extra';
import * as path from 'path';
import {
    FileSystem, FileSystemUtils, RawFileSystem
} from '../../../client/common/platform/fileSystem';
import {
    FileStat, FileType,
    IFileSystemUtils, IRawFileSystem
} from '../../../client/common/platform/types';
import {
    assertDoesNotExist, assertExists, DOES_NOT_EXIST, FSFixture, WINDOWS
} from './filesystem.functional.test';

// Note: all functional tests that do not trigger the VS Code "fs" API
// are found in filesystem.functional.test.ts.

// tslint:disable:max-func-body-length chai-vague-errors
// tslint:disable:no-suspicious-comment

suite('Raw FileSystem', () => {
    let filesystem: IRawFileSystem;
    let fix: FSFixture;
    setup(async () => {
        filesystem = RawFileSystem.withDefaults();
        fix = new FSFixture();

        await assertDoesNotExist(DOES_NOT_EXIST);
    });
    teardown(async () => {
        await fix.cleanUp();
    });

    suite('readText', () => {
        test('returns contents of a file', async () => {
            const expected = '<some text>';
            const filename = await fix.createFile('x/y/z/spam.py', expected);

            const content = await filesystem.readText(filename);

            expect(content).to.be.equal(expected);
        });

        test('always UTF-8', async () => {
            const expected = '... 😁 ...';
            const filename = await fix.createFile('x/y/z/spam.py', expected);

            const text = await filesystem.readText(filename);

            expect(text).to.equal(expected);
        });

        test('returns garbage if encoding is UCS-2', async () => {
            const filename = await fix.resolve('spam.py');
            // There are probably cases where this would fail too.
            // However, the extension never has to deal with non-UTF8
            // cases, so it doesn't matter too much.
            const original = '... 😁 ...';
            await fsextra.writeFile(filename, original, { encoding: 'ucs2' });

            const text = await filesystem.readText(filename);

            expect(text).to.equal('.\u0000.\u0000.\u0000 \u0000=�\u0001� \u0000.\u0000.\u0000.\u0000');
        });

        test('throws an exception if file does not exist', async () => {
            const promise = filesystem.readText(DOES_NOT_EXIST);

            await expect(promise).to.eventually.be.rejected;
        });
    });

    suite('writeText', () => {
        test('creates the file if missing', async () => {
            const filename = await fix.resolve('x/y/z/spam.py');
            await assertDoesNotExist(filename);
            const data = 'line1\nline2\n';

            await filesystem.writeText(filename, data);

            const actual = await fsextra.readFile(filename)
                .then(buffer => buffer.toString());
            expect(actual).to.equal(data);
        });

        test('always UTF-8', async () => {
            const filename = await fix.resolve('x/y/z/spam.py');
            const data = '... 😁 ...';

            await filesystem.writeText(filename, data);

            const actual = await fsextra.readFile(filename)
                .then(buffer => buffer.toString());
            expect(actual).to.equal(data);
        });

        test('overwrites existing file', async () => {
            const filename = await fix.createFile('x/y/z/spam.py', '...');
            const data = 'line1\nline2\n';

            await filesystem.writeText(filename, data);

            const actual = await fsextra.readFile(filename)
                .then(buffer => buffer.toString());
            expect(actual).to.equal(data);
        });
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

    suite('stat', () => {
        function convertStat(old: fsextra.Stats, filetype: FileType): FileStat {
            return {
                type: filetype,
                size: old.size,
                // TODO (https://github.com/microsoft/vscode/issues/84177)
                //   FileStat.ctime and FileStat.mtime only have 1-second resolution.
                //   So for now we round to the nearest integer.
                // TODO (https://github.com/microsoft/vscode/issues/84177)
                //   FileStat.ctime is consistently 0 instead of the actual ctime.
                ctime: 0,
                //ctime: Math.round(old.ctimeMs),
                mtime: Math.round(old.mtimeMs)
            };
        }

        test('gets the info for an existing file', async () => {
            const filename = await fix.createFile('x/y/z/spam.py', '...');
            const old = await fsextra.stat(filename);
            const expected = convertStat(old, FileType.File);

            const stat = await filesystem.stat(filename);

            expect(stat).to.deep.equal(expected);
        });

        test('gets the info for an existing directory', async () => {
            const dirname = await fix.createDirectory('x/y/z/spam');
            const old = await fsextra.stat(dirname);
            const expected = convertStat(old, FileType.Directory);

            const stat = await filesystem.stat(dirname);

            expect(stat).to.deep.equal(expected);
        });

        test('for symlinks, gets the info for the linked file', async () => {
            const filename = await fix.createFile('x/y/z/spam.py', '...');
            const symlink = await fix.createSymlink('x/y/z/eggs.py', filename);
            const old = await fsextra.stat(filename);
            const expected = convertStat(old, FileType.SymbolicLink | FileType.File);

            const stat = await filesystem.stat(symlink);

            expect(stat).to.deep.equal(expected);
        });

        test('fails if the file does not exist', async () => {
            const promise = filesystem.stat(DOES_NOT_EXIST);

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
                ['info.py', FileType.SymbolicLink | FileType.File],
                ['ipc.sock', FileType.File], // This isn't "Unknown" for some reason.
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

    suite('mkdirp', () => {
        test('creates the directory and all missing parents', async () => {
            await fix.createDirectory('x');
            // x/y, x/y/z, and x/y/z/spam are all missing.
            const dirname = await fix.resolve('x/y/z/spam', false);
            await assertDoesNotExist(dirname);

            await filesystem.mkdirp(dirname);

            await assertExists(dirname);
        });

        test('works if the directory already exists', async () => {
            const dirname = await fix.createDirectory('spam');
            await assertExists(dirname);

            await filesystem.mkdirp(dirname);

            await assertExists(dirname);
        });
    });

    suite('copyFile', () => {
        test('the source file gets copied (same directory)', async () => {
            const data = '<content>';
            const src = await fix.createFile('x/y/z/spam.py', data);
            const dest = await fix.resolve('x/y/z/spam.py.bak');
            await assertDoesNotExist(dest);

            await filesystem.copyFile(src, dest);

            const actual = await fsextra.readFile(dest)
                .then(buffer => buffer.toString());
            expect(actual).to.equal(data);
            const original = await fsextra.readFile(src)
                .then(buffer => buffer.toString());
            expect(original).to.equal(data);
        });

        test('the source file gets copied (different directory)', async () => {
            const data = '<content>';
            const src = await fix.createFile('x/y/z/spam.py', data);
            const dest = await fix.resolve('x/y/eggs.py');
            await assertDoesNotExist(dest);

            await filesystem.copyFile(src, dest);

            const actual = await fsextra.readFile(dest)
                .then(buffer => buffer.toString());
            expect(actual).to.equal(data);
            const original = await fsextra.readFile(src)
                .then(buffer => buffer.toString());
            expect(original).to.equal(data);
        });

        test('fails if the source does not exist', async () => {
            const dest = await fix.resolve('x/spam.py');

            const promise = filesystem.copyFile(DOES_NOT_EXIST, dest);

            await expect(promise).to.eventually.be.rejected;
        });

        test('fails if the target parent directory does not exist', async () => {
            const src = await fix.createFile('x/spam.py', '...');
            const dest = await fix.resolve('y/eggs.py', false);
            await assertDoesNotExist(path.dirname(dest));

            const promise = filesystem.copyFile(src, dest);

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

    suite('pathExists', () => {
        test('file missing (any)', async () => {
            const exists = await utils.pathExists(DOES_NOT_EXIST);

            expect(exists).to.equal(false);
        });

        Object.keys(FileType).forEach(ft => {
            test(`file missing (${ft})`, async () => {
                //tslint:disable-next-line:no-any
                const exists = await utils.pathExists(DOES_NOT_EXIST, ft as any as FileType);

                expect(exists).to.equal(false);
            });
        });

        test('any', async () => {
            const filename = await fix.createFile('x/y/z/spam.py');

            const exists = await utils.pathExists(filename);

            expect(exists).to.equal(true);
        });

        test('want file, got file', async () => {
            const filename = await fix.createFile('x/y/z/spam.py');

            const exists = await utils.pathExists(filename, FileType.File);

            expect(exists).to.equal(true);
        });

        test('want file, not file', async () => {
            const filename = await fix.createDirectory('x/y/z/spam.py');

            const exists = await utils.pathExists(filename, FileType.File);

            expect(exists).to.equal(false);
        });

        test('want directory, got directory', async () => {
            const dirname = await fix.createDirectory('x/y/z/spam');

            const exists = await utils.pathExists(dirname, FileType.Directory);

            expect(exists).to.equal(true);
        });

        test('want directory, not directory', async () => {
            const dirname = await fix.createFile('x/y/z/spam');

            const exists = await utils.pathExists(dirname, FileType.Directory);

            expect(exists).to.equal(false);
        });

        test('symlink', async () => {
            const filename = await fix.createFile('x/y/z/spam.py', '...');
            const symlink = await fix.createSymlink('x/y/z/eggs.py', filename);

            const exists = await utils.pathExists(symlink, FileType.SymbolicLink);

            expect(exists).to.equal(true);
        });

        test('unknown', async function () {
            // tslint:disable-next-line: no-invalid-this
            return this.skip();
            // const sockFile = await fix.createSocket('x/y/z/ipc.sock');

            // const exists = await utils.pathExists(sockFile, FileType.Unknown);

            // expect(exists).to.equal(true);
        });
    });

    suite('fileExists', () => {
        test('want file, got file', async () => {
            const filename = await fix.createFile('x/y/z/spam.py');

            const exists = await utils.fileExists(filename);

            expect(exists).to.equal(true);
        });
    });

    suite('directoryExists', () => {
        test('want directory, got directory', async () => {
            const dirname = await fix.createDirectory('x/y/z/spam');

            const exists = await utils.directoryExists(dirname);

            expect(exists).to.equal(true);
        });
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
        setup(function() {
            // Tests disabled due to CI failures: https://github.com/microsoft/vscode-python/issues/8804
            // tslint:disable-next-line:no-invalid-this
            return this.skip();
        });

        test('mixed types', async () => {
            const symlinkSource = await fix.createFile('x/info.py');
            const dirname = await fix.createDirectory('x/y/z/scripts');
            await fix.createDirectory('x/y/z/scripts/w');
            const file1 = await fix.createFile('x/y/z/scripts/spam.py');
            await fix.createDirectory('x/y/z/scripts/v');
            const file2 = await fix.createFile('x/y/z/scripts/eggs.py');
            const file3 = await fix.createSocket('x/y/z/scripts/spam.sock');
            await fix.createSymlink('x/y/z/scripts/other', symlinkSource);
            const file4 = await fix.createFile('x/y/z/scripts/data.json');

            const results = await utils.getFiles(dirname);

            expect(results.sort()).to.deep.equal([
                file4,
                file2,
                file1,
                file3
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

suite('FileSystem - legacy aliases', () => {
    const fileToAppendTo = path.join(__dirname, 'created_for_testing_dummy.txt');
    setup(() => {
        cleanTestFiles(); // This smells like functional testing...
    });
    teardown(cleanTestFiles);
    function cleanTestFiles() {
        if (fsextra.existsSync(fileToAppendTo)) {
            fsextra.unlinkSync(fileToAppendTo);
        }
    }

    test('ReadFile returns contents of a file', async () => {
        const file = __filename;
        const filesystem = new FileSystem();
        const expectedContents = await fsextra.readFile(file).then(buffer => buffer.toString());

        const content = await filesystem.readFile(file);

        expect(content).to.be.equal(expectedContents);
    });

    test('ReadFile throws an exception if file does not exist', async () => {
        const filesystem = new FileSystem();

        const readPromise = filesystem.readFile('xyz');

        await expect(readPromise).to.be.rejectedWith();
    });
});
