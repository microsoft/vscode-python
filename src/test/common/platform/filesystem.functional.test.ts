// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-require-imports no-var-requires max-func-body-length chai-vague-errors

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as fsextra from 'fs-extra';
import * as net from 'net';
import * as path from 'path';
import * as tmpMod from 'tmp';
import {
    FileSystem, FileSystemPaths, FileSystemUtils, RawFileSystem,
    TempFileSystem
} from '../../../client/common/platform/fileSystem';
import {
    FileType,
    IFileSystemPaths, IFileSystemUtils, IRawFileSystem, ITempFileSystem,
    TemporaryFile
} from '../../../client/common/platform/types';
import { sleep } from '../../../client/common/utils/async';

const assertArrays = require('chai-arrays');
use(assertArrays);
use(chaiAsPromised);

// Note: all functional tests that trigger the VS Code "fs" API are
// found in filesystem.test.ts.

export const WINDOWS = /^win/.test(process.platform);

export const DOES_NOT_EXIST = 'this file does not exist';

export async function assertDoesNotExist(filename: string) {
    await expect(
        fsextra.stat(filename)
    ).to.eventually.be.rejected;
}

export async function assertExists(filename: string) {
    await expect(
        fsextra.stat(filename)
    ).to.not.eventually.be.rejected;
}

export class FSFixture {
    public tempDir: tmpMod.SynchrounousResult | undefined;
    public sockServer: net.Server | undefined;

    public async cleanUp() {
        if (this.tempDir) {
            const tempDir = this.tempDir;
            this.tempDir = undefined;
            tempDir.removeCallback();
        }
        if (this.sockServer) {
            const srv = this.sockServer;
            await new Promise(resolve => srv.close(resolve));
            this.sockServer = undefined;
        }
    }

    public async resolve(relname: string, mkdirs = true): Promise<string> {
        if (!this.tempDir) {
            this.tempDir = tmpMod.dirSync({
                prefix: 'pyvsc-fs-tests-',
                unsafeCleanup: true
            });
        }
        relname = path.normalize(relname);
        const filename = path.join(this.tempDir.name, relname);
        if (mkdirs) {
            await fsextra.mkdirp(
                path.dirname(filename));
        }
        return filename;
    }

    public async createFile(relname: string, text = ''): Promise<string> {
        const filename = await this.resolve(relname);
        await fsextra.writeFile(filename, text);
        return filename;
    }

    public async createDirectory(relname: string): Promise<string> {
        const dirname = await this.resolve(relname);
        await fsextra.mkdir(dirname);
        return dirname;
    }

    public async createSymlink(relname: string, source: string): Promise<string> {
        const symlink = await this.resolve(relname);
        await fsextra.ensureSymlink(source, symlink);
        return symlink;
    }

    public async createSocket(relname: string): Promise<string> {
        if (!this.sockServer) {
            this.sockServer = net.createServer();
        }
        const srv = this.sockServer!;
        const filename = await this.resolve(relname);
        await new Promise(resolve => srv!.listen(filename, 0, resolve));
        return filename;
    }
}

suite('FileSystem - Temporary files', () => {
    let tmp: ITempFileSystem;
    setup(() => {
        tmp = TempFileSystem.withDefaults();
    });

    suite('createFile', () => {
        test('TemporaryFile is populated properly', async () => {
            const tempfile = await tmp.createFile('.tmp');
            await assertExists(tempfile.filePath);
            tempfile.dispose();

            await assertDoesNotExist(tempfile.filePath);
            expect(tempfile.filePath.endsWith('.tmp')).to.equal(true, `bad suffix on ${tempfile.filePath}`);
        });

        test('fails if the target temp directory does not exist', async () => {
            const promise = tmp.createFile('.tmp', DOES_NOT_EXIST);

            await expect(promise).to.eventually.be.rejected;
        });
    });
});

suite('FileSystem paths', () => {
    let fspath: IFileSystemPaths;
    setup(() => {
        fspath = FileSystemPaths.withDefaults();
    });

    suite('join', () => {
        test('parts get joined by path.sep', () => {
            const expected = path.join('x', 'y', 'z', 'spam.py');

            const result = fspath.join(
                'x',
                path.sep === '\\' ? 'y\\z' : 'y/z',
                'spam.py'
            );

            expect(result).to.equal(expected);
        });
    });

    suite('normCase', () => {
        test('forward-slash', () => {
            const filename = 'X/Y/Z/SPAM.PY';
            const expected = WINDOWS ? 'X\\Y\\Z\\SPAM.PY' : filename;

            const result = fspath.normCase(filename);

            expect(result).to.equal(expected);
        });

        test('backslash is not changed', () => {
            const filename = 'X\\Y\\Z\\SPAM.PY';
            const expected = filename;

            const result = fspath.normCase(filename);

            expect(result).to.equal(expected);
        });

        test('lower-case', () => {
            const filename = 'x\\y\\z\\spam.py';
            const expected = WINDOWS ? 'X\\Y\\Z\\SPAM.PY' : filename;

            const result = fspath.normCase(filename);

            expect(result).to.equal(expected);
        });

        test('upper-case stays upper-case', () => {
            const filename = 'X\\Y\\Z\\SPAM.PY';
            const expected = 'X\\Y\\Z\\SPAM.PY';

            const result = fspath.normCase(filename);

            expect(result).to.equal(expected);
        });
    });
});

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

    suite('chmod (non-Windows)', () => {
        suiteSetup(function () {
            // On Windows, chmod won't have any effect on the file itself.
            if (WINDOWS) {
                // tslint:disable-next-line:no-invalid-this
                this.skip();
            }
        });
        async function checkMode(filename: string, expected: number) {
            const stat = await fsextra.stat(filename);
            expect(stat.mode & 0o777).to.equal(expected);
        }

        test('the file mode gets updated (string)', async () => {
            const filename = await fix.createFile('spam.py', '...');
            await fsextra.chmod(filename, 0o644);

            await filesystem.chmod(filename, '755');

            await checkMode(filename, 0o755);
        });

        test('the file mode gets updated (number)', async () => {
            const filename = await fix.createFile('spam.py', '...');
            await fsextra.chmod(filename, 0o644);

            await filesystem.chmod(filename, 0o755);

            await checkMode(filename, 0o755);
        });

        test('the file mode gets updated for a directory', async () => {
            const dirname = await fix.createDirectory('spam');
            await fsextra.chmod(dirname, 0o755);

            await filesystem.chmod(dirname, 0o700);

            await checkMode(dirname, 0o700);
        });

        test('nothing happens if the file mode already matches', async () => {
            const filename = await fix.createFile('spam.py', '...');
            await fsextra.chmod(filename, 0o644);

            await filesystem.chmod(filename, 0o644);

            await checkMode(filename, 0o644);
        });

        test('fails if the file does not exist', async () => {
            const promise = filesystem.chmod(DOES_NOT_EXIST, 0o755);

            await expect(promise).to.eventually.be.rejected;
        });
    });

    suite('lstat', () => {
        test('for symlinks, gives the link info', async () => {
            const filename = await fix.createFile('x/y/z/spam.py', '...');
            const symlink = await fix.createSymlink('x/y/z/eggs.py', filename);
            const old = await fsextra.lstat(symlink);
            const expected = {
                type: FileType.SymbolicLink,
                size: old.size,
                ctime: old.ctimeMs,
                mtime: old.mtimeMs
            };

            const stat = await filesystem.lstat(symlink);

            expect(stat).to.deep.equal(expected);
        });

        test('for normal files, gives the file info', async () => {
            const filename = await fix.createFile('x/y/z/spam.py', '...');
            const old = await fsextra.stat(filename);
            const expected = {
                type: FileType.File,
                size: old.size,
                ctime: old.ctimeMs,
                mtime: old.mtimeMs
            };

            const stat = await filesystem.lstat(filename);

            expect(stat).to.deep.equal(expected);
        });

        test('fails if the file does not exist', async () => {
            const promise = filesystem.lstat(DOES_NOT_EXIST);

            await expect(promise).to.eventually.be.rejected;
        });
    });

    suite('statSync', () => {
        test('gets the info for an existing file', async () => {
            const filename = await fix.createFile('x/y/z/spam.py', '...');
            const old = await fsextra.stat(filename);
            const expected = {
                type: FileType.File,
                size: old.size,
                ctime: old.ctimeMs,
                mtime: old.mtimeMs
            };

            const stat = filesystem.statSync(filename);

            expect(stat).to.deep.equal(expected);
        });

        test('gets the info for an existing directory', async () => {
            const dirname = await fix.createDirectory('x/y/z/spam');
            const old = await fsextra.stat(dirname);
            const expected = {
                type: FileType.Directory,
                size: old.size,
                ctime: old.ctimeMs,
                mtime: old.mtimeMs
            };

            const stat = filesystem.statSync(dirname);

            expect(stat).to.deep.equal(expected);
        });

        test('for symlinks, gets the info for the linked file', async () => {
            const filename = await fix.createFile('x/y/z/spam.py', '...');
            const symlink = await fix.createSymlink('x/y/z/eggs.py', filename);
            const old = await fsextra.stat(filename);
            const expected = {
                type: FileType.File,
                size: old.size,
                ctime: old.ctimeMs,
                mtime: old.mtimeMs
            };

            const stat = filesystem.statSync(symlink);

            expect(stat).to.deep.equal(expected);
        });

        test('fails if the file does not exist', async () => {
            expect(
                () => filesystem.statSync(DOES_NOT_EXIST)
            ).to.throw(Error);
        });
    });

    suite('readTextSync', () => {
        test('returns contents of a file', async () => {
            const expected = '<some text>';
            const filename = await fix.createFile('x/y/z/spam.py', expected);

            const content = filesystem.readTextSync(filename);

            expect(content).to.be.equal(expected);
        });

        test('always UTF-8', async () => {
            const expected = '... 😁 ...';
            const filename = await fix.createFile('x/y/z/spam.py', expected);

            const text = filesystem.readTextSync(filename);

            expect(text).to.equal(expected);
        });

        test('throws an exception if file does not exist', async () => {
            expect(
                () => filesystem.readTextSync(DOES_NOT_EXIST)
            ).to.throw(Error);
        });
    });

    suite('createWriteStream', () => {
        test('returns the correct WriteStream', async () => {
            const filename = await fix.resolve('x/y/z/spam.py');
            const expected = fsextra.createWriteStream(filename);

            const stream = filesystem.createWriteStream(filename);

            expect(stream.path).to.deep.equal(expected.path);
        });

        test('creates the file if missing', async () => {
            const filename = await fix.resolve('x/y/z/spam.py');
            await assertDoesNotExist(filename);
            const data = 'line1\nline2\n';

            const stream = filesystem.createWriteStream(filename);
            stream.write(data);
            stream.destroy();

            const actual = await fsextra.readFile(filename)
                .then(buffer => buffer.toString());
            expect(actual).to.equal(data);
        });

        test('always UTF-8', async () => {
            const filename = await fix.resolve('x/y/z/spam.py');
            const data = '... 😁 ...';

            const stream = filesystem.createWriteStream(filename);
            stream.write(data);
            stream.destroy();

            const actual = await fsextra.readFile(filename)
                .then(buffer => buffer.toString());
            expect(actual).to.equal(data);
        });

        test('overwrites existing file', async () => {
            const filename = await fix.createFile('x/y/z/spam.py', '...');
            const data = 'line1\nline2\n';

            const stream = filesystem.createWriteStream(filename);
            stream.write(data);
            stream.destroy();

            const actual = await fsextra.readFile(filename)
                .then(buffer => buffer.toString());
            expect(actual).to.equal(data);
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

    suite('arePathsSame', () => {
        test('identical', () => {
            const filename = 'x/y/z/spam.py';

            const result = utils.arePathsSame(filename, filename);

            expect(result).to.equal(true);
        });

        test('not the same', () => {
            const file1 = 'x/y/z/spam.py';
            const file2 = 'a/b/c/spam.py';

            const result = utils.arePathsSame(file1, file2);

            expect(result).to.equal(false);
        });

        test('with different separators', () => {
            const file1 = 'x/y/z/spam.py';
            const file2 = 'x\\y\\z\\spam.py';
            const expected = WINDOWS;

            const result = utils.arePathsSame(file1, file2);

            expect(result).to.equal(expected);
        });

        test('with different case', () => {
            const file1 = 'x/y/z/spam.py';
            const file2 = 'x/Y/z/Spam.py';
            const expected = WINDOWS;

            const result = utils.arePathsSame(file1, file2);

            expect(result).to.equal(expected);
        });
    });

    suite('getFileHash', () => {
        setup(function() {
            // Tests disabled due to CI failures: https://github.com/microsoft/vscode-python/issues/8804
            // tslint:disable-next-line:no-invalid-this
            return this.skip();
        });

        test('Getting hash for a file should return non-empty string', async () => {
            const filename = await fix.createFile('x/y/z/spam.py');

            const hash = await utils.getFileHash(filename);

            expect(hash).to.not.equal('');
        });

        test('the returned hash is stable', async () => {
            const filename = await fix.createFile('x/y/z/spam.py');

            const hash1 = await utils.getFileHash(filename);
            const hash2 = await utils.getFileHash(filename);
            const hash3 = await utils.getFileHash(filename);

            expect(hash1).to.equal(hash2);
            expect(hash1).to.equal(hash3);
            expect(hash2).to.equal(hash3);
        });

        test('the returned hash changes with modification', async () => {
            const filename = await fix.createFile('x/y/z/spam.py', 'original text');

            const hash1 = await utils.getFileHash(filename);
            await sleep(10);
            await fsextra.writeFile(filename, 'new text');
            const hash2 = await utils.getFileHash(filename);

            expect(hash1).to.not.equal(hash2);
        });

        test('the returned hash is unique', async () => {
            const file1 = await fix.createFile('spam.py');
            await sleep(10); // milliseconds
            const file2 = await fix.createFile('x/y/z/spam.py');
            await sleep(10); // milliseconds
            const file3 = await fix.createFile('eggs.py');

            const hash1 = await utils.getFileHash(file1);
            const hash2 = await utils.getFileHash(file2);
            const hash3 = await utils.getFileHash(file3);

            expect(hash1).to.not.equal(hash2);
            expect(hash1).to.not.equal(hash3);
            expect(hash2).to.not.equal(hash3);
        });

        test('Getting hash for non existent file should throw error', async () => {
            const promise = utils.getFileHash(DOES_NOT_EXIST);

            await expect(promise).to.eventually.be.rejected;
        });
    });

    suite('search', () => {
        test('found matches', async () => {
            const pattern = await fix.resolve(`x/y/z/spam.*`);
            const expected: string[] = [
                await fix.createFile('x/y/z/spam.py'),
                await fix.createFile('x/y/z/spam.pyc'),
                await fix.createFile('x/y/z/spam.so'),
                await fix.createDirectory('x/y/z/spam.data')
            ];
            // non-matches
            await fix.createFile('x/spam.py');
            await fix.createFile('x/y/z/eggs.py');
            await fix.createFile('x/y/z/spam-all.py');
            await fix.createFile('x/y/z/spam');
            await fix.createFile('x/spam.py');

            const files = await utils.search(pattern);

            expect(files.sort()).to.deep.equal(expected.sort());
        });

        test('no matches', async () => {
            const pattern = await fix.resolve(`x/y/z/spam.*`);

            const files = await utils.search(pattern);

            expect(files).to.deep.equal([]);
        });
    });
});

suite('FileSystem - legacy aliases', () => {
    const fileToAppendTo = path.join(__dirname, 'created_for_testing_dummy.txt');
    setup(() => {
        cleanTestFiles();
    });
    teardown(cleanTestFiles);
    function cleanTestFiles() {
        if (fsextra.existsSync(fileToAppendTo)) {
            fsextra.unlinkSync(fileToAppendTo);
        }
    }

    suite('Case sensitivity', () => {
        const path1 = 'c:\\users\\Peter Smith\\my documents\\test.txt';
        const path2 = 'c:\\USERS\\Peter Smith\\my documents\\test.TXT';
        const path3 = 'c:\\USERS\\Peter Smith\\my documents\\test.exe';
        let filesystem: FileSystem;
        setup(() => {
            filesystem = new FileSystem();
        });

        test('windows', function() {
            if (!WINDOWS) {
                // tslint:disable-next-line:no-invalid-this
                this.skip();
            }

            const same12 = filesystem.arePathsSame(path1, path2);
            const same11 = filesystem.arePathsSame(path1, path1);
            const same22 = filesystem.arePathsSame(path2, path2);
            const same13 = filesystem.arePathsSame(path1, path3);

            expect(same12).to.be.equal(true, 'file paths do not match (windows)');
            expect(same11).to.be.equal(true, '1. file paths do not match');
            expect(same22).to.be.equal(true, '2. file paths do not match');
            expect(same13).to.be.equal(false, '2. file paths do not match');
        });

        test('non-windows', function() {
            if (WINDOWS) {
                // tslint:disable-next-line:no-invalid-this
                this.skip();
            }

            const same12 = filesystem.arePathsSame(path1, path2);
            const same11 = filesystem.arePathsSame(path1, path1);
            const same22 = filesystem.arePathsSame(path2, path2);
            const same13 = filesystem.arePathsSame(path1, path3);

            expect(same12).to.be.equal(false, 'file match (non windows)');
            expect(same11).to.be.equal(true, '1. file paths do not match');
            expect(same22).to.be.equal(true, '2. file paths do not match');
            expect(same13).to.be.equal(false, '2. file paths do not match');
        });
    });

    test('Check existence of files synchronously', async () => {
        const filesystem = new FileSystem();

        expect(filesystem.fileExistsSync(__filename)).to.be.equal(true, 'file not found');
    });

    test('Test searching for files', async () => {
        const searchPattern = `${path.basename(__filename, __filename.substring(__filename.length - 3))}.*`;
        const filesystem = new FileSystem();

        const files = await filesystem.search(path.join(__dirname, searchPattern));

        expect(files).to.be.array();
        expect(files.length).to.be.at.least(1);
        const expectedFileName = __filename.replace(/\\/g, '/');
        const fileName = files[0].replace(/\\/g, '/');
        expect(fileName).to.equal(expectedFileName);
    });

    test('Ensure creating a temporary file results in a unique temp file path', async () => {
        const filesystem = new FileSystem();

        const tempFile = await filesystem.createTemporaryFile('.tmp');
        const tempFile2 = await filesystem.createTemporaryFile('.tmp');

        tempFile.dispose();
        tempFile2.dispose();
        expect(tempFile.filePath).to.not.equal(tempFile2.filePath, 'Temp files must be unique, implementation of createTemporaryFile is off.');
    });

    test('Ensure writing to a temp file is supported via file stream', async () => {
        const filesystem = new FileSystem();

        await filesystem.createTemporaryFile('.tmp').then((tf: TemporaryFile) => {
            expect(tf).to.not.equal(undefined, 'Error trying to create a temporary file');
            const writeStream = filesystem.createWriteStream(tf.filePath);
            writeStream.write('hello', 'utf8', (err: Error | null | undefined) => {
                expect(err).to.equal(undefined, `Failed to write to a temp file, error is ${err}`);
            });
        }, (failReason) => {
            expect(failReason).to.equal('No errors occurred', `Failed to create a temporary file with error ${failReason}`);
        });
    });

    test('Ensure chmod works against a temporary file', async () => {
        const filesystem = new FileSystem();

        await filesystem.createTemporaryFile('.tmp').then(async (fl: TemporaryFile) => {
            await filesystem.chmod(fl.filePath, '7777').then(
                (_success: void) => {
                    // cannot check for success other than we got here, chmod in Windows won't have any effect on the file itself.
                },
                (failReason) => {
                    expect(failReason).to.equal('There was no error using chmod', `Failed to perform chmod operation successfully, got error ${failReason}`);
                });
        });
    });

    test('Getting hash for non existent file should throw error', async () => {
        const filesystem = new FileSystem();

        const promise = filesystem.getFileHash('some unknown file');

        await expect(promise).to.eventually.be.rejected;
    });

    test('Getting hash for a file should return non-empty string', async () => {
        const filesystem = new FileSystem();

        const hash = await filesystem.getFileHash(__filename);

        expect(hash).to.be.length.greaterThan(0);
    });

    suite('createTemporaryFile', () => {
        test('TemporaryFile is populated properly', async () => {
            const filesystem = new FileSystem();

            const tempfile = await filesystem.createTemporaryFile('.tmp');

            await assertExists(tempfile.filePath);
            tempfile.dispose();
            expect(tempfile.filePath.endsWith('.tmp')).to.equal(true, tempfile.filePath);
        });

        test('Ensure creating a temporary file results in a unique temp file path', async () => {
            const filesystem = new FileSystem();

            const tempfile1 = await filesystem.createTemporaryFile('.tmp');
            const tempfile2 = await filesystem.createTemporaryFile('.tmp');

            tempfile1.dispose();
            tempfile2.dispose();
            expect(tempfile1.filePath).to.not.equal(tempfile2.filePath);
        });

        test('Ensure writing to a temp file is supported via file stream', async () => {
            const filesystem = new FileSystem();
            const tempfile = await filesystem.createTemporaryFile('.tmp');
            const stream = filesystem.createWriteStream(tempfile.filePath);
            const data = '...';

            stream.write(data, 'utf8');

            const actual = await fsextra.readFile(tempfile.filePath, 'utf8');
            expect(actual).to.equal(data);
        });

        test('Ensure chmod works against a temporary file', async () => {
            const filesystem = new FileSystem();

            const tempfile = await filesystem.createTemporaryFile('.tmp');

            await expect(
                fsextra.chmod(tempfile.filePath, '7777')
            ).to.not.eventually.be.rejected;
        });
    });
});
