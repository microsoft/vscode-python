// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:max-func-body-length chai-vague-errors

import { expect, use } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import { FileSystem } from '../../../client/common/platform/fileSystem';
import { PlatformService } from '../../../client/common/platform/platformService';
import { IFileSystem, TemporaryFile } from '../../../client/common/platform/types';
import { sleep } from '../../../client/common/utils/async';
import {
    assertDoesNotExist, assertExists, DOES_NOT_EXIST, FSFixture,
    SUPPORTS_SYMLINKS, WINDOWS
} from './utils';

// tslint:disable:no-require-imports no-var-requires
const assertArrays = require('chai-arrays');
use(require('chai-as-promised'));
use(assertArrays);

suite('FileSystem', () => {
    let fileSystem: IFileSystem;
    let fix: FSFixture;
    setup(async () => {
        fileSystem = new FileSystem(
            new PlatformService()
        );
        fix = new FSFixture();

        await assertDoesNotExist(DOES_NOT_EXIST);
    });
    teardown(async () => {
        await fix.cleanUp();
        await fix.ensureDeleted(DOES_NOT_EXIST);
    });

    suite('path-related', () => {
        suite('directorySeparatorChar', () => {
            test('value', () => {
                const sep = fileSystem.directorySeparatorChar;

                expect(sep).to.equal(path.sep);
            });
        });

        suite('arePathsSame', () => {
            test('identical', () => {
                const filename = 'x/y/z/spam.py';

                const result = fileSystem.arePathsSame(filename, filename);

                expect(result).to.equal(true);
            });

            test('not the same', () => {
                const file1 = 'x/y/z/spam.py';
                const file2 = 'a/b/c/spam.py';

                const result = fileSystem.arePathsSame(file1, file2);

                expect(result).to.equal(false);
            });

            test('with different separators', () => {
                const file1 = 'x/y/z/spam.py';
                const file2 = 'x\\y\\z\\spam.py';
                const expected = WINDOWS;

                const result = fileSystem.arePathsSame(file1, file2);

                expect(result).to.equal(expected);
            });

            test('with different case', () => {
                const file1 = 'x/y/z/spam.py';
                const file2 = 'x/Y/z/Spam.py';
                const expected = WINDOWS;

                const result = fileSystem.arePathsSame(file1, file2);

                expect(result).to.equal(expected);
            });
        });

        suite('getRealPath', () => {
            test('', async () => {
                // XXX
            });
        });
    });

    suite('raw', () => {
        suite('createDirectory', () => {
            test('creates the directory and all missing parents', async () => {
                await fix.createDirectory('x');
                // x/y, x/y/z, and x/y/z/spam are all missing.
                const dirname = await fix.resolve('x/y/z/spam', false);
                await assertDoesNotExist(dirname);

                await fileSystem.createDirectory(dirname);

                await assertExists(dirname);
            });

            test('works if the directory already exists', async () => {
                const dirname = await fix.createDirectory('spam');
                await assertExists(dirname);

                await fileSystem.createDirectory(dirname);

                await assertExists(dirname);
            });
        });

        suite('deleteDirectory', () => {
            test('deletes the directory if empty', async () => {
                const dirname = await fix.createDirectory('x');
                await assertExists(dirname);

                await fileSystem.deleteDirectory(dirname);

                await assertDoesNotExist(dirname);
            });

            test('fails if the directory is not empty', async () => {
                const dirname = await fix.createDirectory('x');
                const filename = await fix.createFile('x/y/z/spam.py');
                await assertExists(filename);

                const promise = fileSystem.deleteDirectory(dirname);

                await expect(promise).to.eventually.be.rejected;
            });

            test('fails if the directory does not exist', async () => {
                const promise = fileSystem.deleteDirectory(DOES_NOT_EXIST);

                await expect(promise).to.eventually.be.rejected;
            });
        });

        suite('readFile', () => {
            test('returns contents of a file', async () => {
                const expected = '<some text>';
                const filename = await fix.createFile('x/y/z/spam.py', expected);

                const content = await fileSystem.readFile(filename);

                expect(content).to.be.equal(expected);
            });

            test('always UTF-8', async () => {
                const expected = '... 😁 ...';
                const filename = await fix.createFile('x/y/z/spam.py', expected);

                const text = await fileSystem.readFile(filename);

                expect(text).to.equal(expected);
            });

            test('returns garbage if encoding is UCS-2', async () => {
                const filename = await fix.resolve('spam.py');
                // There are probably cases where this would fail too.
                // However, the extension never has to deal with non-UTF8
                // cases, so it doesn't matter too much.
                const original = '... 😁 ...';
                await fs.writeFile(filename, original, { encoding: 'ucs2' });

                const text = await fileSystem.readFile(filename);

                expect(text).to.equal('.\u0000.\u0000.\u0000 \u0000=�\u0001� \u0000.\u0000.\u0000.\u0000');
            });

            test('throws an exception if file does not exist', async () => {
                const promise = fileSystem.readFile(DOES_NOT_EXIST);

                await expect(promise).to.eventually.be.rejected;
            });
        });

        suite('writeFile', () => {
            test('creates the file if missing', async () => {
                const filename = await fix.resolve('x/y/z/spam.py');
                await assertDoesNotExist(filename);
                const data = 'line1\nline2\n';

                await fileSystem.writeFile(filename, data);

                const actual = await fs.readFile(filename)
                    .then(buffer => buffer.toString());
                expect(actual).to.equal(data);
            });

            test('always UTF-8', async () => {
                const filename = await fix.resolve('x/y/z/spam.py');
                const data = '... 😁 ...';

                await fileSystem.writeFile(filename, data);

                const actual = await fs.readFile(filename)
                    .then(buffer => buffer.toString());
                expect(actual).to.equal(data);
            });

            test('overwrites existing file', async () => {
                const filename = await fix.createFile('x/y/z/spam.py', '...');
                const data = 'line1\nline2\n';

                await fileSystem.writeFile(filename, data);

                const actual = await fs.readFile(filename)
                    .then(buffer => buffer.toString());
                expect(actual).to.equal(data);
            });
        });

        suite('appendFile', () => {
            test('existing file', async () => {
                const orig = 'spamspamspam\n\n';
                const dataToAppend = `Some Data\n${new Date().toString()}\nAnd another line`;
                const filename = await fix.createFile('spam.txt', orig);
                const expected = `${orig}${dataToAppend}`;

                await fileSystem.appendFile(filename, dataToAppend);

                const actual = await fs.readFile(filename, 'utf8');
                expect(actual).to.be.equal(expected);
            });

            test('existing empty file', async () => {
                const filename = await fix.createFile('spam.txt');
                const dataToAppend = `Some Data\n${new Date().toString()}\nAnd another line`;
                const expected = dataToAppend;

                await fileSystem.appendFile(filename, dataToAppend);

                const actual = await fs.readFile(filename, 'utf8');
                expect(actual).to.be.equal(expected);
            });

            test('creates the file if it does not already exist', async () => {
                await fileSystem.appendFile(DOES_NOT_EXIST, 'spam');

                const actual = await fs.readFile(DOES_NOT_EXIST, 'utf8');
                expect(actual).to.be.equal('spam');
            });

            test('fails if not a file', async () => {
                const dirname = await fix.createDirectory('spam');

                const promise = fileSystem.appendFile(dirname, 'spam');

                await expect(promise).to.eventually.be.rejected;
            });
        });

        suite('copyFile', () => {
            test('the source file gets copied (same directory)', async () => {
                const data = '<content>';
                const src = await fix.createFile('x/y/z/spam.py', data);
                const dest = await fix.resolve('x/y/z/spam.py.bak');
                await assertDoesNotExist(dest);

                await fileSystem.copyFile(src, dest);

                const actual = await fs.readFile(dest)
                    .then(buffer => buffer.toString());
                expect(actual).to.equal(data);
                const original = await fs.readFile(src)
                    .then(buffer => buffer.toString());
                expect(original).to.equal(data);
            });

            test('the source file gets copied (different directory)', async () => {
                const data = '<content>';
                const src = await fix.createFile('x/y/z/spam.py', data);
                const dest = await fix.resolve('x/y/eggs.py');
                await assertDoesNotExist(dest);

                await fileSystem.copyFile(src, dest);

                const actual = await fs.readFile(dest)
                    .then(buffer => buffer.toString());
                expect(actual).to.equal(data);
                const original = await fs.readFile(src)
                    .then(buffer => buffer.toString());
                expect(original).to.equal(data);
            });

            test('fails if the source does not exist', async () => {
                const dest = await fix.resolve('x/spam.py');

                const promise = fileSystem.copyFile(DOES_NOT_EXIST, dest);

                await expect(promise).to.eventually.be.rejected;
            });

            test('fails if the target parent directory does not exist', async () => {
                const src = await fix.createFile('x/spam.py', '...');
                const dest = await fix.resolve('y/eggs.py', false);
                await assertDoesNotExist(path.dirname(dest));

                const promise = fileSystem.copyFile(src, dest);

                await expect(promise).to.eventually.be.rejected;
            });
        });

        suite('deleteFile', () => {
            test('deletes the file', async () => {
                const filename = await fix.createFile('x/y/z/spam.py', '...');
                await assertExists(filename);

                await fileSystem.deleteFile(filename);

                await assertDoesNotExist(filename);
            });

            test('fails if the file does not exist', async () => {
                const promise = fileSystem.deleteFile(DOES_NOT_EXIST);

                await expect(promise).to.eventually.be.rejected;
            });
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
                const stat = await fs.stat(filename);
                expect(stat.mode & 0o777).to.equal(expected);
            }

            test('the file mode gets updated (string)', async () => {
                const filename = await fix.createFile('spam.py', '...');
                await fs.chmod(filename, 0o644);

                await fileSystem.chmod(filename, '755');

                await checkMode(filename, 0o755);
            });

            test('the file mode gets updated (number)', async () => {
                const filename = await fix.createFile('spam.py', '...');
                await fs.chmod(filename, 0o644);

                await fileSystem.chmod(filename, 0o755);

                await checkMode(filename, 0o755);
            });

            test('the file mode gets updated for a directory', async () => {
                const dirname = await fix.createDirectory('spam');
                await fs.chmod(dirname, 0o755);

                await fileSystem.chmod(dirname, 0o700);

                await checkMode(dirname, 0o700);
            });

            test('nothing happens if the file mode already matches', async () => {
                const filename = await fix.createFile('spam.py', '...');
                await fs.chmod(filename, 0o644);

                await fileSystem.chmod(filename, 0o644);

                await checkMode(filename, 0o644);
            });

            test('fails if the file does not exist', async () => {
                const promise = fileSystem.chmod(DOES_NOT_EXIST, 0o755);

                await expect(promise).to.eventually.be.rejected;
            });
        });

        suite('move', () => {
            test('', async () => {
                // XXX
            });
        });

        //=============================
        // sync methods

        suite('readFileSync', () => {
            test('returns contents of a file', async () => {
                const expected = '<some text>';
                const filename = await fix.createFile('x/y/z/spam.py', expected);

                const text = fileSystem.readFileSync(filename);

                expect(text).to.be.equal(expected);
            });

            test('always UTF-8', async () => {
                const expected = '... 😁 ...';
                const filename = await fix.createFile('x/y/z/spam.py', expected);

                const text = fileSystem.readFileSync(filename);

                expect(text).to.equal(expected);
            });

            test('throws an exception if file does not exist', async () => {
                expect(
                    () => fileSystem.readFileSync(DOES_NOT_EXIST)
                ).to.throw(Error);
            });
        });

        suite('createReadStream', () => {
            test('', async () => {
                // XXX
            });
        });

        suite('createWriteStream', () => {
            test('returns the correct WriteStream', async () => {
                const filename = await fix.resolve('x/y/z/spam.py');
                const expected = fs.createWriteStream(filename);
                expected.destroy();

                const stream = fileSystem.createWriteStream(filename);
                stream.destroy();

                expect(stream.path).to.deep.equal(expected.path);
            });

            test('creates the file if missing', async () => {
                const filename = await fix.resolve('x/y/z/spam.py');
                await assertDoesNotExist(filename);
                const data = 'line1\nline2\n';

                const stream = fileSystem.createWriteStream(filename);
                stream.write(data);
                stream.destroy();

                const actual = await fs.readFile(filename)
                    .then(buffer => buffer.toString());
                expect(actual).to.equal(data);
            });

            test('always UTF-8', async () => {
                const filename = await fix.resolve('x/y/z/spam.py');
                const data = '... 😁 ...';

                const stream = fileSystem.createWriteStream(filename);
                stream.write(data);
                stream.destroy();

                const actual = await fs.readFile(filename)
                    .then(buffer => buffer.toString());
                expect(actual).to.equal(data);
            });

            test('overwrites existing file', async () => {
                const filename = await fix.createFile('x/y/z/spam.py', '...');
                const data = 'line1\nline2\n';

                const stream = fileSystem.createWriteStream(filename);
                stream.write(data);
                stream.destroy();

                const actual = await fs.readFile(filename)
                    .then(buffer => buffer.toString());
                expect(actual).to.equal(data);
            });
        });
    });

    suite('utils', () => {
        suite('fileExists', () => {
            test('want file, got file', async () => {
                const filename = await fix.createFile('x/y/z/spam.py');

                const exists = await fileSystem.fileExists(filename);

                expect(exists).to.equal(true);
            });

            test('', async () => {
                // XXX
            });
        });

        suite('directoryExists', () => {
            test('want directory, got directory', async () => {
                const dirname = await fix.createDirectory('x/y/z/spam');

                const exists = await fileSystem.directoryExists(dirname);

                expect(exists).to.equal(true);
            });

            test('', async () => {
                // XXX
            });
        });

        suite('getSubDirectories', () => {
            if (SUPPORTS_SYMLINKS) {
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

                    const results = await fileSystem.getSubDirectories(dirname);

                    expect(results.sort()).to.deep.equal([
                        subdir2,
                        subdir1
                    ]);
                });
            } else {
                test('mixed types', async () => {
                    const dirname = await fix.createDirectory('x/y/z/scripts');
                    const subdir1 = await fix.createDirectory('x/y/z/scripts/w');
                    await fix.createFile('x/y/z/scripts/spam.py');
                    const subdir2 = await fix.createDirectory('x/y/z/scripts/v');
                    await fix.createFile('x/y/z/scripts/eggs.py');
                    await fix.createSocket('x/y/z/scripts/spam.sock');
                    await fix.createFile('x/y/z/scripts/data.json');

                    const results = await fileSystem.getSubDirectories(dirname);

                    expect(results.sort()).to.deep.equal([
                        subdir2,
                        subdir1
                    ]);
                });
            }

            test('empty if the directory does not exist', async () => {
                const entries = await fileSystem.getSubDirectories(DOES_NOT_EXIST);

                expect(entries).to.deep.equal([]);
            });
        });

        suite('getFiles', () => {
            if (SUPPORTS_SYMLINKS) {
                test('mixed types', async () => {
                    const symlinkSource = await fix.createFile('x/info.py');
                    const dirname = await fix.createDirectory('x/y/z/scripts');
                    await fix.createDirectory('x/y/z/scripts/w');
                    const file1 = await fix.createFile('x/y/z/scripts/spam.py');
                    await fix.createDirectory('x/y/z/scripts/v');
                    const file2 = await fix.createFile('x/y/z/scripts/eggs.py');
                    const sock = await fix.createSocket('x/y/z/scripts/spam.sock');
                    const symlink = await fix.createSymlink('x/y/z/scripts/other', symlinkSource);
                    const file3 = await fix.createFile('x/y/z/scripts/data.json');

                    const results = await fileSystem.getFiles(dirname);

                    expect(results.sort()).to.deep.equal([
                        file3,
                        file2,
                        symlink,
                        file1,
                        sock
                    ]);
                });
            } else {
                test('mixed types', async () => {
                    const dirname = await fix.createDirectory('x/y/z/scripts');
                    await fix.createDirectory('x/y/z/scripts/w');
                    const file1 = await fix.createFile('x/y/z/scripts/spam.py');
                    await fix.createDirectory('x/y/z/scripts/v');
                    const file2 = await fix.createFile('x/y/z/scripts/eggs.py');
                    const sock = await fix.createSocket('x/y/z/scripts/spam.sock');
                    const file3 = await fix.createFile('x/y/z/scripts/data.json');

                    const results = await fileSystem.getFiles(dirname);

                    expect(results.sort()).to.deep.equal([
                        file3,
                        file2,
                        file1,
                        sock
                    ]);
                });
            }

            test('empty if the directory does not exist', async () => {
                const entries = await fileSystem.getFiles(DOES_NOT_EXIST);

                expect(entries).to.deep.equal([]);
            });
        });

        suite('getFileHash', () => {
            // Since getFileHash() relies on timestamps, we have to take
            // into account filesystem timestamp resolution.  For instance
            // on FAT and HFS it is 1 second.
            // See: https://nodejs.org/api/fs.html#fs_stat_time_values

            test('Getting hash for a file should return non-empty string', async () => {
                const filename = await fix.createFile('x/y/z/spam.py');

                const hash = await fileSystem.getFileHash(filename);

                expect(hash).to.not.equal('');
            });

            test('the returned hash is stable', async () => {
                const filename = await fix.createFile('x/y/z/spam.py');

                const hash1 = await fileSystem.getFileHash(filename);
                const hash2 = await fileSystem.getFileHash(filename);
                await sleep(2_000); // just in case
                const hash3 = await fileSystem.getFileHash(filename);

                expect(hash1).to.equal(hash2);
                expect(hash1).to.equal(hash3);
                expect(hash2).to.equal(hash3);
            });

            test('the returned hash changes with modification', async () => {
                const filename = await fix.createFile('x/y/z/spam.py', 'original text');

                const hash1 = await fileSystem.getFileHash(filename);
                await sleep(2_000); // for filesystems with 1s resolution
                await fs.writeFile(filename, 'new text');
                const hash2 = await fileSystem.getFileHash(filename);

                expect(hash1).to.not.equal(hash2);
            });

            test('the returned hash is unique', async () => {
                const file1 = await fix.createFile('spam.py');
                await sleep(2_000); // for filesystems with 1s resolution
                const file2 = await fix.createFile('x/y/z/spam.py');
                await sleep(2_000); // for filesystems with 1s resolution
                const file3 = await fix.createFile('eggs.py');

                const hash1 = await fileSystem.getFileHash(file1);
                const hash2 = await fileSystem.getFileHash(file2);
                const hash3 = await fileSystem.getFileHash(file3);

                expect(hash1).to.not.equal(hash2);
                expect(hash1).to.not.equal(hash3);
                expect(hash2).to.not.equal(hash3);
            });

            test('Getting hash for non existent file should throw error', async () => {
                const promise = fileSystem.getFileHash(DOES_NOT_EXIST);

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

                const files = await fileSystem.search(pattern);

                expect(files.sort()).to.deep.equal(expected.sort());
            });

            test('no matches', async () => {
                const pattern = await fix.resolve(`x/y/z/spam.*`);

                const files = await fileSystem.search(pattern);

                expect(files).to.deep.equal([]);
            });
        });

        suite('createTemporaryFile', () => {
            async function createTemporaryFile(suffix: string): Promise<TemporaryFile> {
                const tempfile = await fileSystem.createTemporaryFile(suffix);
                fix.addFSCleanup(tempfile.filePath, tempfile.dispose);
                return tempfile;
            }

            test('TemporaryFile is created properly', async () => {
                const tempfile = await fileSystem.createTemporaryFile('.tmp');
                fix.addFSCleanup(tempfile.filePath, tempfile.dispose);
                await assertExists(tempfile.filePath);

                expect(tempfile.filePath.endsWith('.tmp')).to.equal(true, `bad suffix on ${tempfile.filePath}`);
            });

            test('TemporaryFile is disposed properly', async () => {
                const tempfile = await createTemporaryFile('.tmp');
                await assertExists(tempfile.filePath);

                tempfile.dispose();

                await assertDoesNotExist(tempfile.filePath);
            });

            test('Ensure creating a temporary file results in a unique temp file path', async () => {
                const tempFile = await createTemporaryFile('.tmp');
                const tempFile2 = await createTemporaryFile('.tmp');

                const filename1 = tempFile.filePath;
                const filename2 = tempFile2.filePath;

                expect(filename1).to.not.equal(filename2);
            });

            test('Ensure writing to a temp file is supported via file stream', async () => {
                const tempfile = await createTemporaryFile('.tmp');
                const stream = fileSystem.createWriteStream(tempfile.filePath);
                fix.addCleanup(() => stream.destroy());
                const data = '...';

                stream.write(data, 'utf8');

                const actual = await fs.readFile(tempfile.filePath, 'utf8');
                expect(actual).to.equal(data);
            });

            test('Ensure chmod works against a temporary file', async () => {
                // Note that on Windows chmod is a noop.
                const tempfile = await createTemporaryFile('.tmp');

                await expect(
                    fs.chmod(tempfile.filePath, '7777')
                ).to.not.eventually.be.rejected;
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
                    await fs.chmod(dirname, 0o444);

                    const isReadonly = await fileSystem.isDirReadonly(dirname);

                    expect(isReadonly).to.equal(false);
                });
            });

            test('is not readonly', async () => {
                const dirname = await fix.createDirectory('x/y/z/spam');

                const isReadonly = await fileSystem.isDirReadonly(dirname);

                expect(isReadonly).to.equal(true);
            });

            // Failing may be more sensible, but for now we are sticking
            // with the existing behavior.
            test('false if the directory does not exist', async () => {
                const isReadonly = await fileSystem.isDirReadonly(DOES_NOT_EXIST);

                expect(isReadonly).to.equal(false);
            });
        });

        //=============================
        // sync methods

        suite('fileExistsSync', () => {
            test('Check existence of files synchronously', async () => {
                const exists = fileSystem.fileExistsSync(__filename);

                expect(exists).to.be.equal(true, 'file not found');
            });

            test('', async () => {
                // XXX
            });
        });
    });
});
