// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:max-func-body-length chai-vague-errors
// tslint:disable:no-suspicious-comment

import { expect } from 'chai';
import * as fsextra from 'fs-extra';
// prettier-ignore
import {
    convertStat, FileSystem, RawFileSystem
} from '../../../client/common/platform/fileSystem';
import { PlatformService } from '../../../client/common/platform/platformService';
// prettier-ignore
import {
    FileType, IFileSystem, IRawFileSystem
} from '../../../client/common/platform/types';
// prettier-ignore
import {
    assertDoesNotExist, DOES_NOT_EXIST, FSFixture,
    SUPPORTS_SOCKETS, SUPPORTS_SYMLINKS
} from './utils';

// Note: all functional tests that do not trigger the VS Code "fs" API
// are found in filesystem.functional.test.ts.

suite('FileSystem - raw', () => {
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

    suite('stat', () => {
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

        test('for symlinks, gets the info for the linked file', async function() {
            if (!SUPPORTS_SYMLINKS) {
                // tslint:disable-next-line:no-invalid-this
                this.skip();
            }
            const filename = await fix.createFile('x/y/z/spam.py', '...');
            const symlink = await fix.createSymlink('x/y/z/eggs.py', filename);
            const old = await fsextra.stat(filename);
            const expected = convertStat(old, FileType.SymbolicLink | FileType.File);

            const stat = await filesystem.stat(symlink);

            expect(stat).to.deep.equal(expected);
        });

        test('gets the info for a socket', async function() {
            if (!SUPPORTS_SOCKETS) {
                // tslint:disable-next-line:no-invalid-this
                return this.skip();
            }
            const sock = await fix.createSocket('x/spam.sock');
            const old = await fsextra.stat(sock);
            const expected = convertStat(old, FileType.Unknown);

            const stat = await filesystem.stat(sock);

            expect(stat).to.deep.equal(expected);
        });

        test('fails if the file does not exist', async () => {
            const promise = filesystem.stat(DOES_NOT_EXIST);

            await expect(promise).to.eventually.be.rejected;
        });
    });
});

suite('FileSystem', () => {
    let filesystem: IFileSystem;
    let fix: FSFixture;
    setup(async () => {
        // prettier-ignore
        filesystem = new FileSystem(
            new PlatformService()
        );
        fix = new FSFixture();

        await assertDoesNotExist(DOES_NOT_EXIST);
    });
    teardown(async () => {
        await fix.cleanUp();
    });

    suite('raw', () => {
        suite('stat', () => {
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

            test('for symlinks, gets the info for the linked file', async function() {
                if (!SUPPORTS_SYMLINKS) {
                    // tslint:disable-next-line:no-invalid-this
                    this.skip();
                }
                const filename = await fix.createFile('x/y/z/spam.py', '...');
                const symlink = await fix.createSymlink('x/y/z/eggs.py', filename);
                const old = await fsextra.stat(filename);
                const expected = convertStat(old, FileType.SymbolicLink | FileType.File);

                const stat = await filesystem.stat(symlink);

                expect(stat).to.deep.equal(expected);
            });

            test('gets the info for a socket', async function() {
                if (!SUPPORTS_SOCKETS) {
                    // tslint:disable-next-line:no-invalid-this
                    return this.skip();
                }
                const sock = await fix.createSocket('x/spam.sock');
                const old = await fsextra.stat(sock);
                const expected = convertStat(old, FileType.Unknown);

                const stat = await filesystem.stat(sock);

                expect(stat).to.deep.equal(expected);
            });

            test('fails if the file does not exist', async () => {
                const promise = filesystem.stat(DOES_NOT_EXIST);

                await expect(promise).to.eventually.be.rejected;
            });
        });
    });

    suite('utils', () => {
        suite('fileExists', () => {
            test('want file, got file', async () => {
                const filename = await fix.createFile('x/y/z/spam.py');

                const exists = await filesystem.fileExists(filename);

                expect(exists).to.equal(true);
            });

            test('want file, not file', async () => {
                const filename = await fix.createDirectory('x/y/z/spam.py');

                const exists = await filesystem.fileExists(filename);

                expect(exists).to.equal(false);
            });

            test('symlink', async function() {
                if (!SUPPORTS_SYMLINKS) {
                    // tslint:disable-next-line:no-invalid-this
                    this.skip();
                }
                const filename = await fix.createFile('x/y/z/spam.py', '...');
                const symlink = await fix.createSymlink('x/y/z/eggs.py', filename);

                const exists = await filesystem.fileExists(symlink);

                // This is because we currently use stat() and not lstat().
                expect(exists).to.equal(true);
            });

            test('unknown', async function() {
                if (!SUPPORTS_SOCKETS) {
                    // tslint:disable-next-line:no-invalid-this
                    this.skip();
                }
                const sockFile = await fix.createSocket('x/y/z/ipc.sock');

                const exists = await filesystem.fileExists(sockFile);

                expect(exists).to.equal(false);
            });
        });

        suite('directoryExists', () => {
            test('want directory, got directory', async () => {
                const dirname = await fix.createDirectory('x/y/z/spam');

                const exists = await filesystem.directoryExists(dirname);

                expect(exists).to.equal(true);
            });

            test('want directory, not directory', async () => {
                const dirname = await fix.createFile('x/y/z/spam');

                const exists = await filesystem.directoryExists(dirname);

                expect(exists).to.equal(false);
            });

            test('symlink', async () => {
                const dirname = await fix.createDirectory('x/y/z/spam');
                const symlink = await fix.createSymlink('x/y/z/eggs', dirname);

                const exists = await filesystem.directoryExists(symlink);

                // This is because we currently use stat() and not lstat().
                expect(exists).to.equal(true);
            });

            test('unknown', async function() {
                if (!SUPPORTS_SOCKETS) {
                    // tslint:disable-next-line:no-invalid-this
                    this.skip();
                }
                const sockFile = await fix.createSocket('x/y/z/ipc.sock');

                const exists = await filesystem.directoryExists(sockFile);

                expect(exists).to.equal(false);
            });
        });

        suite('getSubDirectories', () => {
            test('empty if the directory does not exist', async () => {
                const entries = await filesystem.getSubDirectories(DOES_NOT_EXIST);

                expect(entries).to.deep.equal([]);
            });
        });

        suite('getFiles', () => {
            test('empty if the directory does not exist', async () => {
                const entries = await filesystem.getFiles(DOES_NOT_EXIST);

                expect(entries).to.deep.equal([]);
            });
        });
    });
});
