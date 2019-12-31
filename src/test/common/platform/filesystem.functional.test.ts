// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:max-func-body-length chai-vague-errors

import { expect, use } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import { convertStat, FileSystem } from '../../../client/common/platform/fileSystem';
import { FileSystemPaths, FileSystemPathUtils } from '../../../client/common/platform/fs-paths';
import { PlatformService } from '../../../client/common/platform/platformService';
import { FileType } from '../../../client/common/platform/types';
import { sleep } from '../../../client/common/utils/async';
// prettier-ignore
import {
    assertDoesNotExist, assertExists, DOES_NOT_EXIST,
    fixPath, FSFixture,
    OSX, SUPPORTS_SOCKETS, SUPPORTS_SYMLINKS, WINDOWS
} from './utils';

// tslint:disable:no-require-imports no-var-requires
const assertArrays = require('chai-arrays');
use(require('chai-as-promised'));
use(assertArrays);

suite('FileSystem', () => {
    let fileSystem: FileSystem;
    let fix: FSFixture;
    setup(async () => {
        // prettier-ignore
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
        const paths = FileSystemPaths.withDefaults();
        const pathUtils = FileSystemPathUtils.withDefaults(paths);

        suite('directorySeparatorChar', () => {
            // tested fully in the FileSystemPaths tests.

            test('matches wrapped object', () => {
                const expected = paths.sep;

                const sep = fileSystem.directorySeparatorChar;

                expect(sep).to.equal(expected);
            });
        });

        suite('arePathsSame', () => {
            // tested fully in the FileSystemPathUtils tests.

            test('matches wrapped object', () => {
                const file1 = fixPath('a/b/c/spam.py');
                const file2 = fixPath('a/b/c/Spam.py');
                const expected = pathUtils.arePathsSame(file1, file2);

                const areSame = fileSystem.arePathsSame(file1, file2);

                expect(areSame).to.equal(expected);
            });
        });

        suite('getRealPath', () => {
            // tested fully in the FileSystemPathUtils tests.

            test('matches wrapped object', async () => {
                const filename = fixPath('a/b/c/spam.py');
                const expected = await pathUtils.getRealPath(filename);

                const resolved = await fileSystem.getRealPath(filename);

                expect(resolved).to.equal(expected);
            });
        });
    });

    suite('raw', () => {
        suite('lstat', () => {
            test('for symlinks, gives the link info', async function() {
                if (!SUPPORTS_SYMLINKS) {
                    // tslint:disable-next-line:no-invalid-this
                    this.skip();
                }
                const filename = await fix.createFile('x/y/z/spam.py', '...');
                const symlink = await fix.createSymlink('x/y/z/eggs.py', filename);
                // prettier-ignore
                const expected = convertStat(
                    await fs.lstat(symlink),
                    FileType.SymbolicLink
                );

                const stat = await fileSystem.lstat(symlink);

                expect(stat).to.deep.equal(expected);
            });

            test('for normal files, gives the file info', async () => {
                const filename = await fix.createFile('x/y/z/spam.py', '...');
                // Ideally we would compare to the result of
                // fileSystem.stat().  However, we do not have access
                // to the VS Code API here.
                // prettier-ignore
                const expected = convertStat(
                    await fs.lstat(filename),
                    FileType.File
                );

                const stat = await fileSystem.lstat(filename);

                expect(stat).to.deep.equal(expected);
            });

            test('fails if the file does not exist', async () => {
                const promise = fileSystem.lstat(DOES_NOT_EXIST);

                await expect(promise).to.eventually.be.rejected;
            });
        });

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

        suite('listdir', () => {
            setup(function() {
                if (WINDOWS) {
                    // tslint:disable-next-line:no-suspicious-comment
                    // TODO(GH-8995) These tests are failing on Windows,
                    // so we are // temporarily disabling it.
                    // tslint:disable-next-line:no-invalid-this
                    return this.skip();
                }
            });
            if (SUPPORTS_SYMLINKS) {
                test('mixed', async () => {
                    // Create the target directory and its contents.
                    const dirname = await fix.createDirectory('x/y/z');
                    const file1 = await fix.createFile('x/y/z/__init__.py', '');
                    const script = await fix.createFile('x/y/z/__main__.py', '<script here>');
                    const file2 = await fix.createFile('x/y/z/spam.py', '...');
                    const symlink1 = await fix.createSymlink(
                        'x/y/z/info.py',
                        // Link to an ignored file.
                        await fix.createFile('x/_info.py', '<info here>') // source
                    );
                    const sock = await fix.createSocket('x/y/z/ipc.sock');
                    const file3 = await fix.createFile('x/y/z/eggs.py', '"""..."""');
                    const symlink2 = await fix.createSymlink(
                        'x/y/z/broken',
                        DOES_NOT_EXIST // source
                    );
                    const symlink3 = await fix.createSymlink(
                        'x/y/z/ipc.sck',
                        sock // source
                    );
                    const subdir = await fix.createDirectory('x/y/z/w');
                    const symlink4 = await fix.createSymlink(
                        'x/y/z/static_files',
                        await fix.resolve('x/y/z/w/data') // source
                    );
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

                    const entries = await fileSystem.listdir(dirname);

                    expect(entries.sort()).to.deep.equal([
                        [file1, FileType.File],
                        [script, FileType.File],
                        [symlink2, FileType.SymbolicLink],
                        [file3, FileType.File],
                        [symlink1, FileType.SymbolicLink | FileType.File],
                        [symlink3, FileType.SymbolicLink],
                        [sock, FileType.Unknown],
                        [file2, FileType.File],
                        [symlink4, FileType.SymbolicLink | FileType.Directory],
                        [subdir, FileType.Directory]
                    ]);
                });
            } else if (SUPPORTS_SOCKETS) {
                test('mixed', async () => {
                    // Create the target directory and its contents.
                    const dirname = await fix.createDirectory('x/y/z');
                    const file1 = await fix.createFile('x/y/z/__init__.py', '');
                    const script = await fix.createFile('x/y/z/__main__.py', '<script here>');
                    const file2 = await fix.createFile('x/y/z/spam.py', '...');
                    const sock = await fix.createSocket('x/y/z/ipc.sock');
                    const file3 = await fix.createFile('x/y/z/eggs.py', '"""..."""');
                    const subdir = await fix.createDirectory('x/y/z/w');
                    // Create other files and directories (should be ignored).
                    await fix.createFile('x/__init__.py', '');
                    await fix.createFile('x/y/__init__.py', '');
                    await fix.createDirectory('x/y/z/w/data');
                    await fix.createFile('x/y/z/w/data/v1.json');

                    const entries = await fileSystem.listdir(dirname);

                    expect(entries.sort()).to.deep.equal([
                        [file1, FileType.File],
                        [script, FileType.File],
                        [file3, FileType.File],
                        [sock, FileType.Unknown],
                        [file2, FileType.File],
                        [subdir, FileType.Directory]
                    ]);
                });
            } else {
                test('mixed', async () => {
                    // Create the target directory and its contents.
                    const dirname = await fix.createDirectory('x/y/z');
                    const file1 = await fix.createFile('x/y/z/__init__.py', '');
                    const script = await fix.createFile('x/y/z/__main__.py', '<script here>');
                    const file2 = await fix.createFile('x/y/z/spam.py', '...');
                    const file3 = await fix.createFile('x/y/z/eggs.py', '"""..."""');
                    const subdir = await fix.createDirectory('x/y/z/w');
                    // Create other files and directories (should be ignored).
                    await fix.createFile('x/__init__.py', '');
                    await fix.createFile('x/y/__init__.py', '');
                    await fix.createDirectory('x/y/z/w/data');
                    await fix.createFile('x/y/z/w/data/v1.json');

                    const entries = await fileSystem.listdir(dirname);

                    expect(entries.sort()).to.deep.equal([
                        [file1, FileType.File],
                        [script, FileType.File],
                        [file3, FileType.File],
                        [file2, FileType.File],
                        [subdir, FileType.Directory]
                    ]);
                });
            }

            test('empty', async () => {
                const dirname = await fix.createDirectory('x/y/z/eggs');

                const entries = await fileSystem.listdir(dirname);

                expect(entries).to.deep.equal([]);
            });

            test('fails if the directory does not exist', async () => {
                const promise = fileSystem.listdir(DOES_NOT_EXIST);

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

                // prettier-ignore
                const actual = await fs.readFile(filename)
                    .then(buffer => buffer.toString());
                expect(actual).to.equal(data);
            });

            test('always UTF-8', async () => {
                const filename = await fix.resolve('x/y/z/spam.py');
                const data = '... 😁 ...';

                await fileSystem.writeFile(filename, data);

                // prettier-ignore
                const actual = await fs.readFile(filename)
                    .then(buffer => buffer.toString());
                expect(actual).to.equal(data);
            });

            test('overwrites existing file', async () => {
                const filename = await fix.createFile('x/y/z/spam.py', '...');
                const data = 'line1\nline2\n';

                await fileSystem.writeFile(filename, data);

                // prettier-ignore
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

                // prettier-ignore
                const actual = await fs.readFile(dest)
                    .then(buffer => buffer.toString());
                expect(actual).to.equal(data);
                // prettier-ignore
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

                // prettier-ignore
                const actual = await fs.readFile(dest)
                    .then(buffer => buffer.toString());
                expect(actual).to.equal(data);
                // prettier-ignore
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
            suiteSetup(function() {
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
            test('rename file', async () => {
                const source = await fix.createFile('spam.py', '<text>');
                const target = await fix.resolve('eggs-txt');
                await assertDoesNotExist(target);

                await fileSystem.move(source, target);

                await assertExists(target);
                const text = await fs.readFile(target, 'utf8');
                expect(text).to.equal('<text>');
                await assertDoesNotExist(source);
            });

            test('rename directory', async () => {
                const source = await fix.createDirectory('spam');
                await fix.createFile('spam/data.json', '<text>');
                const target = await fix.resolve('eggs');
                const filename = await fix.resolve('eggs/data.json', false);
                await assertDoesNotExist(target);

                await fileSystem.move(source, target);

                await assertExists(filename);
                const text = await fs.readFile(filename, 'utf8');
                expect(text).to.equal('<text>');
                await assertDoesNotExist(source);
            });

            test('rename symlink', async function() {
                if (!SUPPORTS_SYMLINKS) {
                    // tslint:disable-next-line:no-invalid-this
                    this.skip();
                }
                const filename = await fix.createFile('spam.py');
                const symlink = await fix.createSymlink('spam.lnk', filename);
                const target = await fix.resolve('eggs');
                await assertDoesNotExist(target);

                await fileSystem.move(symlink, target);

                await assertExists(target);
                const linked = await fs.readlink(target);
                expect(linked).to.equal(filename);
                await assertDoesNotExist(symlink);
            });

            test('move file', async () => {
                const source = await fix.createFile('spam.py', '<text>');
                await fix.createDirectory('eggs');
                const target = await fix.resolve('eggs/spam.py');
                await assertDoesNotExist(target);

                await fileSystem.move(source, target);

                await assertExists(target);
                const text = await fs.readFile(target, 'utf8');
                expect(text).to.equal('<text>');
                await assertDoesNotExist(source);
            });

            test('move directory', async () => {
                const source = await fix.createDirectory('spam/spam/spam/eggs/spam');
                await fix.createFile('spam/spam/spam/eggs/spam/data.json', '<text>');
                await fix.createDirectory('spam/spam/spam/hash');
                const target = await fix.resolve('spam/spam/spam/hash/spam');
                const filename = await fix.resolve('spam/spam/spam/hash/spam/data.json', false);
                await assertDoesNotExist(target);

                await fileSystem.move(source, target);

                await assertExists(filename);
                const text = await fs.readFile(filename, 'utf8');
                expect(text).to.equal('<text>');
                await assertDoesNotExist(source);
            });

            test('move symlink', async function() {
                if (!SUPPORTS_SYMLINKS) {
                    // tslint:disable-next-line:no-invalid-this
                    this.skip();
                }
                const filename = await fix.createFile('spam.py');
                const symlink = await fix.createSymlink('w/spam.lnk', filename);
                const target = await fix.resolve('x/spam.lnk');
                await assertDoesNotExist(target);

                await fileSystem.move(symlink, target);

                await assertExists(target);
                const linked = await fs.readlink(target);
                expect(linked).to.equal(filename);
                await assertDoesNotExist(symlink);
            });

            test('file target already exists', async () => {
                const source = await fix.createFile('spam.py', '<text>');
                const target = await fix.createFile('eggs-txt', '<other>');

                await fileSystem.move(source, target);

                await assertDoesNotExist(source);
                await assertExists(target);
                const text2 = await fs.readFile(target, 'utf8');
                expect(text2).to.equal('<text>');
            });

            test('directory target already exists', async () => {
                const source = await fix.createDirectory('spam');
                const file3 = await fix.createFile('spam/data.json', '<text>');
                const target = await fix.createDirectory('eggs');
                const file1 = await fix.createFile('eggs/spam.py', '<code>');
                const file2 = await fix.createFile('eggs/data.json', '<other>');

                const promise = fileSystem.move(source, target);

                await expect(promise).to.eventually.be.rejected;
                // Make sure nothing changed.
                const text1 = await fs.readFile(file1, 'utf8');
                expect(text1).to.equal('<code>');
                const text2 = await fs.readFile(file2, 'utf8');
                expect(text2).to.equal('<other>');
                const text3 = await fs.readFile(file3, 'utf8');
                expect(text3).to.equal('<text>');
            });

            test('fails if the file does not exist', async () => {
                const source = await fix.resolve(DOES_NOT_EXIST);
                const target = await fix.resolve('spam.py');

                const promise = fileSystem.move(source, target);

                await expect(promise).to.eventually.be.rejected;
                // Make sure nothing changed.
                await assertDoesNotExist(target);
            });

            test('fails if the target directory does not exist', async () => {
                const source = await fix.createFile('x/spam.py', '<text>');
                const target = await fix.resolve('w/spam.py', false);
                await assertDoesNotExist(path.dirname(target));

                const promise = fileSystem.move(source, target);

                await expect(promise).to.eventually.be.rejected;
                // Make sure nothing changed.
                await assertExists(source);
                await assertDoesNotExist(target);
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

            test('throws an exception if file does not exist', () => {
                expect(() => {
                    fileSystem.readFileSync(DOES_NOT_EXIST);
                }).to.throw(Error);
            });
        });

        suite('createReadStream', () => {
            test('returns the correct ReadStream', async () => {
                const filename = await fix.createFile('x/y/z/spam.py', '...');
                const expected = fs.createReadStream(filename);
                expected.destroy();

                const stream = fileSystem.createReadStream(filename);
                stream.destroy();

                expect(stream.path).to.deep.equal(expected.path);
            });

            // Missing tests:
            // * creation fails if the file does not exist
            // * .read() works as expected
            // * .pipe() works as expected
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

                // prettier-ignore
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

                // prettier-ignore
                const actual = await fs.readFile(filename)
                    .then(buffer => buffer.toString());
                expect(actual).to.equal(data);
            });

            test('overwrites existing file', async function() {
                if (OSX) {
                    // tslint:disable-next-line:no-suspicious-comment
                    // TODO(GH-8995) This test is failing on Mac, so
                    // we are temporarily disabling it.
                    // tslint:disable-next-line:no-invalid-this
                    return this.skip();
                }
                const filename = await fix.createFile('x/y/z/spam.py', '...');
                const data = 'line1\nline2\n';

                const stream = fileSystem.createWriteStream(filename);
                stream.write(data);
                stream.destroy();

                // prettier-ignore
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

            test('want file, not file', async () => {
                const filename = await fix.createDirectory('x/y/z/spam.py');

                const exists = await fileSystem.fileExists(filename);

                expect(exists).to.equal(false);
            });

            test('symlink', async function() {
                if (!SUPPORTS_SYMLINKS) {
                    // tslint:disable-next-line:no-invalid-this
                    this.skip();
                }
                const filename = await fix.createFile('x/y/z/spam.py', '...');
                const symlink = await fix.createSymlink('x/y/z/eggs.py', filename);

                const exists = await fileSystem.fileExists(symlink);

                // This is because we currently use stat() and not lstat().
                expect(exists).to.equal(true);
            });

            test('unknown', async function() {
                if (!SUPPORTS_SOCKETS) {
                    // tslint:disable-next-line:no-invalid-this
                    this.skip();
                }
                const sockFile = await fix.createSocket('x/y/z/ipc.sock');

                const exists = await fileSystem.fileExists(sockFile);

                expect(exists).to.equal(false);
            });
        });

        suite('directoryExists', () => {
            test('want directory, got directory', async () => {
                const dirname = await fix.createDirectory('x/y/z/spam');

                const exists = await fileSystem.directoryExists(dirname);

                expect(exists).to.equal(true);
            });

            test('want directory, not directory', async () => {
                const dirname = await fix.createFile('x/y/z/spam');

                const exists = await fileSystem.directoryExists(dirname);

                expect(exists).to.equal(false);
            });

            test('symlink', async () => {
                const dirname = await fix.createDirectory('x/y/z/spam');
                const symlink = await fix.createSymlink('x/y/z/eggs', dirname);

                const exists = await fileSystem.directoryExists(symlink);

                // This is because we currently use stat() and not lstat().
                expect(exists).to.equal(true);
            });

            test('unknown', async function() {
                if (!SUPPORTS_SOCKETS) {
                    // tslint:disable-next-line:no-invalid-this
                    this.skip();
                }
                const sockFile = await fix.createSocket('x/y/z/ipc.sock');

                const exists = await fileSystem.directoryExists(sockFile);

                expect(exists).to.equal(false);
            });
        });

        suite('getSubDirectories', () => {
            setup(function() {
                if (WINDOWS) {
                    // tslint:disable-next-line:no-suspicious-comment
                    // TODO(GH-8995) These tests are failing on Windows,
                    // so we are // temporarily disabling it.
                    // tslint:disable-next-line:no-invalid-this
                    return this.skip();
                }
            });
            if (SUPPORTS_SYMLINKS) {
                test('mixed types', async () => {
                    const symlinkFileSource = await fix.createFile('x/info.py');
                    const symlinkDirSource = await fix.createDirectory('x/data');
                    const dirname = await fix.createDirectory('x/y/z/scripts');
                    const subdir1 = await fix.createDirectory('x/y/z/scripts/w');
                    await fix.createFile('x/y/z/scripts/spam.py');
                    const subdir2 = await fix.createDirectory('x/y/z/scripts/v');
                    await fix.createFile('x/y/z/scripts/eggs.py');
                    await fix.createSocket('x/y/z/scripts/spam.sock');
                    await fix.createSymlink('x/y/z/scripts/other', symlinkFileSource);
                    const symlink = await fix.createSymlink('x/y/z/scripts/datadir', symlinkDirSource);
                    await fix.createFile('x/y/z/scripts/data.json');

                    const results = await fileSystem.getSubDirectories(dirname);

                    // prettier-ignore
                    expect(results.sort()).to.deep.equal([
                        symlink,
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
                    if (SUPPORTS_SOCKETS) {
                        await fix.createSocket('x/y/z/scripts/spam.sock');
                    }
                    await fix.createFile('x/y/z/scripts/data.json');

                    const results = await fileSystem.getSubDirectories(dirname);

                    // prettier-ignore
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
            setup(function() {
                if (WINDOWS) {
                    // tslint:disable-next-line:no-suspicious-comment
                    // TODO(GH-8995) These tests are failing on Windows,
                    // so we are // temporarily disabling it.
                    // tslint:disable-next-line:no-invalid-this
                    return this.skip();
                }
            });
            if (SUPPORTS_SYMLINKS) {
                test('mixed types', async () => {
                    const symlinkFileSource = await fix.createFile('x/info.py');
                    const symlinkDirSource = await fix.createDirectory('x/data');
                    const dirname = await fix.createDirectory('x/y/z/scripts');
                    await fix.createDirectory('x/y/z/scripts/w');
                    const file1 = await fix.createFile('x/y/z/scripts/spam.py');
                    await fix.createDirectory('x/y/z/scripts/v');
                    const file2 = await fix.createFile('x/y/z/scripts/eggs.py');
                    await fix.createSocket('x/y/z/scripts/spam.sock');
                    const symlink = await fix.createSymlink('x/y/z/scripts/other', symlinkFileSource);
                    await fix.createSymlink('x/y/z/scripts/datadir', symlinkDirSource);
                    const file3 = await fix.createFile('x/y/z/scripts/data.json');

                    const results = await fileSystem.getFiles(dirname);

                    // prettier-ignore
                    expect(results.sort()).to.deep.equal([
                        file3,
                        file2,
                        symlink,
                        file1
                    ]);
                });
            } else {
                test('mixed types', async () => {
                    const dirname = await fix.createDirectory('x/y/z/scripts');
                    await fix.createDirectory('x/y/z/scripts/w');
                    const file1 = await fix.createFile('x/y/z/scripts/spam.py');
                    await fix.createDirectory('x/y/z/scripts/v');
                    const file2 = await fix.createFile('x/y/z/scripts/eggs.py');
                    if (SUPPORTS_SOCKETS) {
                        await fix.createSocket('x/y/z/scripts/spam.sock');
                    }
                    const file3 = await fix.createFile('x/y/z/scripts/data.json');

                    const results = await fileSystem.getFiles(dirname);

                    // prettier-ignore
                    expect(results.sort()).to.deep.equal([
                        file3,
                        file2,
                        file1
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

                let files = await fileSystem.search(pattern);

                // For whatever reason, on Windows "search()" is
                // returning filenames with forward slasshes...
                files = files.map(fixPath);
                expect(files.sort()).to.deep.equal(expected.sort());
            });

            test('no matches', async () => {
                const pattern = await fix.resolve(`x/y/z/spam.*`);

                const files = await fileSystem.search(pattern);

                expect(files).to.deep.equal([]);
            });
        });

        suite('createFile', () => {
            // tested fully in the TemporaryFileSystem tests.

            test('calls wrapped object', async () => {
                const tempfile = await fileSystem.createTemporaryFile('.tmp');
                fix.addFSCleanup(tempfile.filePath, tempfile.dispose);
                await assertExists(tempfile.filePath);

                expect(tempfile.filePath.endsWith('.tmp')).to.equal(true);
            });
        });

        suite('isDirReadonly', () => {
            suite('non-Windows', () => {
                suiteSetup(function() {
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
            test('want file, got file', async () => {
                const filename = await fix.createFile('x/y/z/spam.py');

                const exists = fileSystem.fileExistsSync(filename);

                expect(exists).to.equal(true);
            });

            test('want file, not file', async () => {
                const filename = await fix.createDirectory('x/y/z/spam.py');

                const exists = fileSystem.fileExistsSync(filename);

                // Note that currently the "file" can be *anything*.  It
                // doesn't have to be just a regular file.  This is the
                // way it already worked, so we're keeping it that way
                // for now.
                expect(exists).to.equal(true);
            });

            test('symlink', async function() {
                if (!SUPPORTS_SYMLINKS) {
                    // tslint:disable-next-line:no-invalid-this
                    this.skip();
                }
                const filename = await fix.createFile('x/y/z/spam.py', '...');
                const symlink = await fix.createSymlink('x/y/z/eggs.py', filename);

                const exists = fileSystem.fileExistsSync(symlink);

                // Note that currently the "file" can be *anything*.  It
                // doesn't have to be just a regular file.  This is the
                // way it already worked, so we're keeping it that way
                // for now.
                expect(exists).to.equal(true);
            });

            test('unknown', async function() {
                if (WINDOWS) {
                    // tslint:disable-next-line:no-suspicious-comment
                    // TODO(GH-8995) These tests are failing on Windows,
                    // so we are // temporarily disabling it.
                    // tslint:disable-next-line:no-invalid-this
                    return this.skip();
                }
                if (!SUPPORTS_SOCKETS) {
                    // tslint:disable-next-line:no-invalid-this
                    this.skip();
                }
                const sockFile = await fix.createSocket('x/y/z/ipc.sock');

                const exists = fileSystem.fileExistsSync(sockFile);

                // Note that currently the "file" can be *anything*.  It
                // doesn't have to be just a regular file.  This is the
                // way it already worked, so we're keeping it that way
                // for now.
                expect(exists).to.equal(true);
            });
        });
    });
});
