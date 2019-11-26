// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as fs from 'fs';
import * as fsextra from 'fs-extra';
import * as TypeMoq from 'typemoq';
import { Disposable, FileSystemError, Uri } from 'vscode';
import {
    FileSystemPaths, FileSystemUtils, RawFileSystem, TempFileSystem
} from '../../../client/common/platform/fileSystem';
import {
    FileStat, FileType,
    IFileSystemPaths, IFileSystemUtils, IRawFileSystem, ITempFileSystem,
    TemporaryFile, WriteStream
} from '../../../client/common/platform/types';

// tslint:disable:max-func-body-length chai-vague-errors

function createMockStat(): TypeMoq.IMock<FileStat> {
    const stat = TypeMoq.Mock.ofType<FileStat>(undefined, TypeMoq.MockBehavior.Strict);
    // This is necessary because passing "mock.object" to
    // Promise.resolve() triggers the lookup.
    //tslint:disable-next-line:no-any
    stat.setup((s: any) => s.then)
        .returns(() => undefined)
        .verifiable(TypeMoq.Times.atLeast(0));
    return stat;
}

function createMockLegacyStat(): TypeMoq.IMock<fsextra.Stats> {
    const stat = TypeMoq.Mock.ofType<fsextra.Stats>(undefined, TypeMoq.MockBehavior.Strict);
    // This is necessary because passing "mock.object" to
    // Promise.resolve() triggers the lookup.
    //tslint:disable-next-line:no-any
    stat.setup((s: any) => s.then)
        .returns(() => undefined)
        .verifiable(TypeMoq.Times.atLeast(0));
    return stat;
}

//tslint:disable-next-line:no-any
type TempCallback = (err: any, path: string, fd: number, cleanupCallback: () => void) => void;
interface IRawFS {
    // VS Code
    copy(source: Uri, target: Uri, options?: {overwrite: boolean}): Thenable<void>;
    createDirectory(uri: Uri): Thenable<void>;
    delete(uri: Uri, options?: {recursive: boolean; useTrash: boolean}): Thenable<void>;
    readDirectory(uri: Uri): Thenable<[string, FileType][]>;
    readFile(uri: Uri): Thenable<Uint8Array>;
    stat(uri: Uri): Thenable<FileStat>;
    writeFile(uri: Uri, content: Uint8Array): Thenable<void>;

    // "fs-extra"
    chmod(filePath: string, mode: string): Promise<void>;
    lstat(filename: string): Promise<fsextra.Stats>;
    statSync(filename: string): fsextra.Stats;
    readFileSync(path: string, encoding: string): string;
    createWriteStream(dest: string): fs.WriteStream;

    // fs paths (IFileSystemPaths)
    join(...filenames: string[]): string;
    dirname(filename: string): string;
    normalize(filename: string): string;

    // "tmp"
    file(options: { }, cb: TempCallback): void;
}

suite('FileSystem - Temporary files', () => {
    let raw: TypeMoq.IMock<IRawFS>;
    let tmp: ITempFileSystem;
    setup(() => {
        raw = TypeMoq.Mock.ofType<IRawFS>(undefined, TypeMoq.MockBehavior.Strict);
        tmp = new TempFileSystem(
            raw.object
        );
    });
    function verifyAll() {
        raw.verifyAll();
    }

    suite('createFile', () => {
        test('TemporaryFile is populated properly', async () => {
            const expected: TemporaryFile = {
                filePath: '/tmp/xyz.tmp',
                dispose: (() => undefined)
            };
            raw.setup(r => r.file({ postfix: '.tmp', dir: undefined }, TypeMoq.It.isAny()))
                .callback((_s, cb) => {
                    cb(undefined, expected.filePath, undefined, expected.dispose);
                });

            const tempfile = await tmp.createFile('.tmp');

            expect(tempfile).to.deep.equal(expected);
            verifyAll();
        });

        test('failure', async () => {
            const err = new Error('something went wrong');
            raw.setup(r => r.file({ postfix: '.tmp', dir: undefined }, TypeMoq.It.isAny()))
                .callback((_s, cb) => {
                    cb(err);
                });

            const promise = tmp.createFile('.tmp');

            await expect(promise).to.eventually.be.rejected;
            verifyAll();
        });
    });
});

suite('FileSystem paths', () => {
    let raw: TypeMoq.IMock<IRawFS>;
    let paths: IFileSystemPaths;
    setup(() => {
        raw = TypeMoq.Mock.ofType<IRawFS>(undefined, TypeMoq.MockBehavior.Strict);
        paths = new FileSystemPaths(
            false, // isWindows
            raw.object
        );
    });
    function verifyAll() {
        raw.verifyAll();
    }

    suite('join', () => {
        test('wraps low-level function', () => {
            const expected = 'x/y/z/spam.py';
            raw.setup(r => r.join('x', 'y/z', 'spam.py'))
                .returns(() => expected);

            const result = paths.join('x', 'y/z', 'spam.py');

            expect(result).to.equal(expected);
        });
    });

    suite('dirname', () => {
        test('wraps low-level function', () => {
            const filename = 'x/y/z/spam.py';
            const expected = 'x/y/z';
            raw.setup(r => r.dirname(filename))
                .returns(() => expected);

            const result = paths.dirname(filename);

            expect(result).to.equal(expected);
        });
    });

    suite('normCase', () => {
        test('wraps low-level function', () => {
            const filename = 'x/y/z/spam.py';
            raw.setup(r => r.normalize(filename))
                .returns(() => filename);
            paths = new FileSystemPaths(
                false, // isWindows
                raw.object
            );

            const result = paths.normCase(filename);

            expect(result).to.equal(filename);
            verifyAll();
        });

        test('path separators get normalized on Windows', () => {
            const filename = 'X/Y/Z/SPAM.PY';
            const expected = 'X\\Y\\Z\\SPAM.PY';
            raw.setup(r => r.normalize(filename))
                .returns(() => expected);
            paths = new FileSystemPaths(
                true, // isWindows
                raw.object
            );

            const result = paths.normCase(filename);

            expect(result).to.equal(expected);
            verifyAll();
        });

        test('path separators stay the same on non-Windows', () => {
            const filename = 'x\\y\\z\\spam.py';
            const expected = filename;
            raw.setup(r => r.normalize(filename))
                .returns(() => expected);
            paths = new FileSystemPaths(
                false, // isWindows
                raw.object
            );

            const result = paths.normCase(filename);

            expect(result).to.equal(expected);
            verifyAll();
        });

        test('on Windows, lower-case is made upper-case', () => {
            const filename = 'x\\y\\z\\spam.py';
            const expected = 'X\\Y\\Z\\SPAM.PY';
            raw.setup(r => r.normalize(filename))
                .returns(() => filename);
            paths = new FileSystemPaths(
                true, // isWindows
                raw.object
            );

            const result = paths.normCase(filename);

            expect(result).to.equal(expected);
            verifyAll();
        });

        test('on Windows, upper-case stays upper-case', () => {
            const filename = 'X\\Y\\Z\\SPAM.PY';
            const expected = 'X\\Y\\Z\\SPAM.PY';
            raw.setup(r => r.normalize(filename))
                .returns(() => expected);
            paths = new FileSystemPaths(
                true, // isWindows
                raw.object
            );

            const result = paths.normCase(filename);

            expect(result).to.equal(expected);
            verifyAll();
        });

        test('on non-Windows, lower-case stays lower-case', () => {
            const filename = 'x/y/z/spam.py';
            const expected = 'x/y/z/spam.py';
            raw.setup(r => r.normalize(filename))
                .returns(() => filename);
            paths = new FileSystemPaths(
                false, // isWindows
                raw.object
            );

            const result = paths.normCase(filename);

            expect(result).to.equal(expected);
            verifyAll();
        });

        test('on non-Windows, upper-case stays upper-case', () => {
            const filename = 'X/Y/Z/SPAM.PY';
            const expected = 'X/Y/Z/SPAM.PY';
            raw.setup(r => r.normalize(filename))
                .returns(() => expected);
            paths = new FileSystemPaths(
                false, // isWindows
                raw.object
            );

            const result = paths.normCase(filename);

            expect(result).to.equal(expected);
            verifyAll();
        });
    });
});

suite('Raw FileSystem', () => {
    let raw: TypeMoq.IMock<IRawFS>;
    let oldStat: TypeMoq.IMock<fsextra.Stats>;
    let filesystem: IRawFileSystem;
    setup(() => {
        raw = TypeMoq.Mock.ofType<IRawFS>(undefined, TypeMoq.MockBehavior.Strict);
        oldStat = createMockLegacyStat();
        filesystem = new RawFileSystem(
            raw.object,
            raw.object,
            raw.object
        );
    });
    function verifyAll() {
        raw.verifyAll();
        oldStat.verifyAll();
    }

    function setupOldStat(stat: FileStat, old?: TypeMoq.IMock<fsextra.Stats> | null) {
        if (old === undefined) {
            old = oldStat;
        } else if (old === null) {
            old = createMockLegacyStat();
        }

        if (stat.type === FileType.File) {
            old!.setup(s => s.isFile())
                .returns(() => true);
        } else if (stat.type === FileType.Directory) {
            old!.setup(s => s.isFile())
                .returns(() => false);
            old!.setup(s => s.isDirectory())
                .returns(() => true);
        } else if (stat.type === FileType.SymbolicLink) {
            old!.setup(s => s.isFile())
                .returns(() => false);
            old!.setup(s => s.isDirectory())
                .returns(() => false);
            old!.setup(s => s.isSymbolicLink())
                .returns(() => true);
        } else {
            old!.setup(s => s.isFile())
                .returns(() => false);
            old!.setup(s => s.isDirectory())
                .returns(() => false);
            old!.setup(s => s.isSymbolicLink())
                .returns(() => false);
        }
        old!.setup(s => s.size)
            .returns(() => stat.size);
        old!.setup(s => s.ctimeMs)
            .returns(() => stat.ctime);
        old!.setup(s => s.mtimeMs)
            .returns(() => stat.mtime);

        return old!;
    }

    suite('readText', () => {
        test('wraps the low-level function', async () => {
            const filename = 'x/y/z/spam.py';
            const expected = '<text>';
            const data = Buffer.from(expected);
            raw.setup(r => r.readFile(Uri.file(filename)))
                .returns(() => Promise.resolve(data));

            const text = await filesystem.readText(filename);

            expect(text).to.equal(expected);
            verifyAll();
        });

        test('always UTF-8', async () => {
            const filename = 'x/y/z/spam.py';
            const expected = '... 😁 ...';
            const data = Buffer.from(expected);
            raw.setup(r => r.readFile(Uri.file(filename)))
                .returns(() => Promise.resolve(data));

            const text = await filesystem.readText(filename);

            expect(text).to.equal(expected);
            verifyAll();
        });
    });

    suite('writeText', () => {
        test('wraps the low-level function', async () => {
            const filename = 'x/y/z/spam.py';
            const text = '<data>';
            const data = Buffer.from(text);
            raw.setup(r => r.writeFile(Uri.file(filename), data))
                .returns(() => Promise.resolve());

            await filesystem.writeText(filename, text);

            verifyAll();
        });

        test('always UTF-8', async () => {
            const filename = 'x/y/z/spam.py';
            const text = '... 😁 ...';
            const data = Buffer.from(text);
            raw.setup(r => r.writeFile(Uri.file(filename), data))
                .returns(() => Promise.resolve());

            await filesystem.writeText(filename, text);

            verifyAll();
        });
    });

    suite('mkdirp', () => {
        test('wraps the low-level function', async () => {
            const dirname = 'x/y/z/spam';
            raw.setup(r => r.createDirectory(Uri.file(dirname)))
                .returns(() => Promise.resolve());

            await filesystem.mkdirp(dirname);

            verifyAll();
        });

        test('creates missing parent directories', async () => {
            const dirname = 'x/y/z/spam';
            raw.setup(r => r.createDirectory(Uri.file(dirname)))
                .throws(FileSystemError.FileNotFound(dirname))
                .verifiable(TypeMoq.Times.exactly(2));
            raw.setup(r => r.dirname(dirname))
                .returns(() => 'x/y/z');
            raw.setup(r => r.createDirectory(Uri.file('x/y/z')))
                .throws(FileSystemError.FileNotFound('x/y/z'))
                .verifiable(TypeMoq.Times.exactly(2));
            raw.setup(r => r.dirname('x/y/z'))
                .returns(() => 'x/y');
            raw.setup(r => r.createDirectory(Uri.file('x/y')))
                .returns(() => Promise.resolve());
            raw.setup(r => r.createDirectory(Uri.file('x/y/z')))
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.exactly(2));
            raw.setup(r => r.createDirectory(Uri.file(dirname)))
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.exactly(2));

            await filesystem.mkdirp(dirname);

            verifyAll();
        });
    });

    suite('rmtree', () => {
        test('wraps the low-level function', async () => {
            const dirname = 'x/y/z/spam';
            const uri = Uri.file(dirname);
            const stat = createMockStat();
            raw.setup(r => r.stat(uri))
                .returns(() => Promise.resolve(stat.object));
            raw.setup(r => r.delete(uri, { recursive: true, useTrash: false }))
                .returns(() => Promise.resolve());

            await filesystem.rmtree(dirname);

            verifyAll();
            stat.verifyAll();
        });

        test('fails if the directory does not exist', async () => {
            const dirname = 'x/y/z/spam';
            raw.setup(r => r.stat(Uri.file(dirname)))
                .throws(new Error('file not found'));

            const promise = filesystem.rmtree(dirname);

            await expect(promise).to.eventually.be.rejected;
            verifyAll();
        });
    });

    suite('rmfile', () => {
        test('wraps the low-level function', async () => {
            const filename = 'x/y/z/spam.py';
            raw.setup(r => r.delete(Uri.file(filename), { recursive: false, useTrash: false }))
                .returns(() => Promise.resolve());

            await filesystem.rmfile(filename);

            verifyAll();
        });
    });

    suite('chmod', () => {
        test('wraps the low-level function', async () => {
            const filename = 'x/y/z/spam.py';
            const mode = 'w';
            raw.setup(r => r.chmod(filename, mode))
                .returns(() => Promise.resolve());

            await filesystem.chmod(filename, mode);

            verifyAll();
        });
    });

    suite('stat', () => {
        test('wraps the low-level function', async () => {
            const filename = 'x/y/z/spam.py';
            //tslint:disable-next-line:no-any
            const expected: FileStat = { type: FileType.File } as any;
            raw.setup(r => r.stat(Uri.file(filename)))
                .returns(() => Promise.resolve(expected));

            const stat = await filesystem.stat(filename);

            expect(stat).to.equal(expected);
            verifyAll();
        });
    });

    suite('lstat', () => {
        test('wraps the low-level function', async () => {
            const filename = 'x/y/z/spam.py';
            const expected: FileStat = {
                type: FileType.File,
                size: 10,
                ctime: 101,
                mtime: 102
            //tslint:disable-next-line:no-any
            } as any;
            setupOldStat(expected);
            raw.setup(r => r.lstat(filename))
                .returns(() => Promise.resolve(oldStat.object));

            const stat = await filesystem.lstat(filename);

            expect(stat).to.deep.equal(expected);
            verifyAll();
        });
    });

    suite('listdir', () => {
        test('mixed', async () => {
            const dirname = 'x/y/z/spam';
            const expected: [string, FileType][] = [
                ['dev1', FileType.Unknown],
                ['w', FileType.Directory],
                ['spam.py', FileType.File],
                ['other', FileType.SymbolicLink | FileType.File]
            ];
            raw.setup(r => r.readDirectory(Uri.file(dirname)))
                .returns(() => Promise.resolve(expected));

            const entries = await filesystem.listdir(dirname);

            expect(entries).to.deep.equal(expected);
            verifyAll();
        });

        test('empty', async () => {
            const dirname = 'x/y/z/spam';
            const expected: [string, FileType][] = [];
            raw.setup(r => r.readDirectory(Uri.file(dirname)))
                .returns(() => Promise.resolve(expected));

            const entries = await filesystem.listdir(dirname);

            expect(entries).to.deep.equal(expected);
            verifyAll();
        });

        test('fails if the low-level call fails', async () => {
            const dirname = 'x/y/z/spam';
            raw.setup(r => r.readDirectory(Uri.file(dirname)))
                .throws(new Error('file not found'));

            const promise = filesystem.listdir(dirname);

            await expect(promise).to.eventually.be.rejected;
            verifyAll();
        });
    });

    suite('copyFile', () => {
        test('read/write streams are used properly', async () => {
            const src = 'x/y/z/spam.py';
            const dest = 'x/y/z/spam.py.bak';
            raw.setup(r => r.dirname(dest))
                .returns(() => 'x/y/z');
            const stat = createMockStat();
            raw.setup(r => r.stat(Uri.file('x/y/z')))
                .returns(() => Promise.resolve(stat.object));
            raw.setup(r => r.copy(Uri.file(src), Uri.file(dest), { overwrite: true }))
                .returns(() => Promise.resolve());

            await filesystem.copyFile(src, dest);

            verifyAll();
            stat.verifyAll();
        });

        test('fails if the parent directory does not exist', async () => {
            const src = '/tmp/spam.py';
            const dest = '/tmp/__does_not_exist__/spam.py';
            raw.setup(r => r.dirname(dest))
                .returns(() => '/tmp/__does_not_exist__');
            raw.setup(r => r.stat(Uri.file('/tmp/__does_not_exist__')))
                .throws(new Error('file not found'));

            const promise = filesystem.copyFile(src, dest);

            await expect(promise).to.eventually.be.rejected;
            verifyAll();
        });
    });

    suite('statSync', () => {
        test('wraps the low-level function', () => {
            const filename = 'x/y/z/spam.py';
            const expected: FileStat = {
                type: FileType.File,
                size: 10,
                ctime: 101,
                mtime: 102
            //tslint:disable-next-line:no-any
            } as any;
            setupOldStat(expected);
            raw.setup(r => r.statSync(filename))
                .returns(() => oldStat.object);

            const stat = filesystem.statSync(filename);

            expect(stat).to.deep.equal(expected);
            verifyAll();
        });
    });

    suite('readTextSync', () => {
        test('wraps the low-level function', () => {
            const filename = 'x/y/z/spam.py';
            const expected = '<text>';
            raw.setup(r => r.readFileSync(filename, TypeMoq.It.isAny()))
                .returns(() => expected);

            const text = filesystem.readTextSync(filename);

            expect(text).to.equal(expected);
            verifyAll();
        });

        test('always UTF-8', async () => {
            const filename = 'x/y/z/spam.py';
            const expected = '<text>';
            raw.setup(r => r.readFileSync(filename, 'utf8'))
                .returns(() => expected);

            const text = filesystem.readTextSync(filename);

            expect(text).to.equal(expected);
            verifyAll();
        });
    });

    suite('createWriteStream', () => {
        test('wraps the low-level function', () => {
            const filename = 'x/y/z/spam.py';
            //tslint:disable-next-line:no-any
            const expected: WriteStream = {} as any;
            raw.setup(r => r.createWriteStream(filename))
                .returns(() => expected);

            const stream = filesystem.createWriteStream(filename);

            expect(stream).to.equal(expected);
            verifyAll();
        });
    });
});

interface IDeps {
    getHashString(data: string): string;
    glob(pat: string): Promise<string[]>;
}

suite('FileSystem Utils', () => {
    let stat: TypeMoq.IMock<FileStat>;
    let filesystem: TypeMoq.IMock<IRawFileSystem>;
    let path: TypeMoq.IMock<IFileSystemPaths>;
    let tmp: TypeMoq.IMock<ITempFileSystem>;
    let deps: TypeMoq.IMock<IDeps>;
    let utils: IFileSystemUtils;
    setup(() => {
        stat = createMockStat();
        filesystem = TypeMoq.Mock.ofType<IRawFileSystem>(undefined, TypeMoq.MockBehavior.Strict);
        path = TypeMoq.Mock.ofType<IFileSystemPaths>(undefined, TypeMoq.MockBehavior.Strict);
        tmp = TypeMoq.Mock.ofType<ITempFileSystem>(undefined, TypeMoq.MockBehavior.Strict);
        deps = TypeMoq.Mock.ofType<IDeps>(undefined, TypeMoq.MockBehavior.Strict);
        utils = new FileSystemUtils(
            filesystem.object,
            path.object,
            tmp.object,
            ((data: string) => deps.object.getHashString(data)),
            ((p: string) => deps.object.glob(p))
        );
    });
    function verifyAll() {
        filesystem.verifyAll();
        path.verifyAll();
        stat.verifyAll();
    }

    suite('arePathsSame', () => {
        function setFakes(
            path1: string, path2: string,
            norm1: string, norm2: string
        ) {
            if (path1 === path2) {
                throw Error('must be different filenames');
            }
            path.setup(p => p.normCase(path1))
                .returns(() => norm1);
            path.setup(p => p.normCase(path2))
                .returns(() => norm2);
        }

        test('identical', () => {
            const filename = 'x/y/z/spam.py';
            // No calls get made.

            const result = utils.arePathsSame(filename, filename);

            expect(result).to.equal(true);
            verifyAll();
        });

        test('not the same', () => {
            const file1 = 'x/y/z/spam.py';
            const file2 = 'a/b/c/spam.py';
            setFakes(
                file1, file2,
                'x/y/z/spam.py', 'a/b/c/spam.py'
            );

            const result = utils.arePathsSame(file1, file2);

            expect(result).to.equal(false);
            verifyAll();
        });

        test('equal with different separators', () => {
            const file1 = 'x/y/z/spam.py';
            const file2 = 'x\\y\\z\\spam.py';
            setFakes(
                file1, file2,
                'x/y/z/spam.py', 'x/y/z/spam.py'
            );

            const result = utils.arePathsSame(file1, file2);

            expect(result).to.equal(true);
            verifyAll();
        });

        test('equal with different case', () => {
            const file1 = 'x/y/z/spam.py';
            const file2 = 'x/Y/z/Spam.py';
            setFakes(
                file1, file2,
                'x/y/z/spam.py', 'x/y/z/spam.py'
            );

            const result = utils.arePathsSame(file1, file2);

            expect(result).to.equal(true);
            verifyAll();
        });
    });

    suite('pathExists', () => {
        test('file missing (any)', async () => {
            const filename = 'x/y/z/spam.py';
            filesystem.setup(f => f.stat(filename))
                .throws(new Error('file not found'));

            const exists = await utils.pathExists(filename);

            expect(exists).to.equal(false);
            verifyAll();
        });

        Object.keys(FileType).forEach(ft => {
            test(`file missing (${ft})`, async () => {
                const filename = 'x/y/z/spam.py';
                filesystem.setup(f => f.stat(filename))
                    .throws(new Error('file not found'));

                //tslint:disable-next-line:no-any
                const exists = await utils.pathExists(filename, ft as any as FileType);

                expect(exists).to.equal(false);
                verifyAll();
            });
        });

        test('any', async () => {
            const filename = 'x/y/z/spam.py';
            filesystem.setup(f => f.stat(filename))
                .returns(() => Promise.resolve(stat.object));

            const exists = await utils.pathExists(filename);

            expect(exists).to.equal(true);
            verifyAll();
        });

        test('want file, got file', async () => {
            const filename = 'x/y/z/spam.py';
            filesystem.setup(f => f.stat(filename))
                .returns(() => Promise.resolve(stat.object));
            stat.setup(s => s.type)
                .returns(() => FileType.File);

            const exists = await utils.pathExists(filename, FileType.File);

            expect(exists).to.equal(true);
            verifyAll();
        });

        test('want file, not file', async () => {
            const filename = 'x/y/z/spam.py';
            filesystem.setup(f => f.stat(filename))
                .returns(() => Promise.resolve(stat.object));
            stat.setup(s => s.type)
                .returns(() => FileType.Directory);

            const exists = await utils.pathExists(filename, FileType.File);

            expect(exists).to.equal(false);
            verifyAll();
        });

        test('want directory, got directory', async () => {
            const dirname = 'x/y/z/spam';
            filesystem.setup(f => f.stat(dirname))
                .returns(() => Promise.resolve(stat.object));
            stat.setup(s => s.type)
                .returns(() => FileType.Directory);

            const exists = await utils.pathExists(dirname, FileType.Directory);

            expect(exists).to.equal(true);
            verifyAll();
        });

        test('want directory, not directory', async () => {
            const dirname = 'x/y/z/spam';
            filesystem.setup(f => f.stat(dirname))
                .returns(() => Promise.resolve(stat.object));
            stat.setup(s => s.type)
                .returns(() => FileType.File);

            const exists = await utils.pathExists(dirname, FileType.Directory);

            expect(exists).to.equal(false);
            verifyAll();
        });

        test('symlink', async () => {
            const filename = 'x/y/z/spam.py';
            filesystem.setup(f => f.stat(filename))
                .returns(() => Promise.resolve(stat.object));
            stat.setup(s => s.type)
                .returns(() => FileType.SymbolicLink);

            const exists = await utils.pathExists(filename, FileType.SymbolicLink);

            expect(exists).to.equal(true);
            verifyAll();
        });

        test('unknown', async () => {
            const filename = 'x/y/z/spam.py';
            filesystem.setup(f => f.stat(filename))
                .returns(() => Promise.resolve(stat.object));
            stat.setup(s => s.type)
                .returns(() => FileType.Unknown);

            const exists = await utils.pathExists(filename, FileType.Unknown);

            expect(exists).to.equal(true);
            verifyAll();
        });
    });

    suite('fileExists', () => {
        test('want file, got file', async () => {
            const filename = 'x/y/z/spam.py';
            filesystem.setup(f => f.stat(filename))
                .returns(() => Promise.resolve(stat.object));
            stat.setup(s => s.type)
                .returns(() => FileType.File);

            const exists = await utils.fileExists(filename);

            expect(exists).to.equal(true);
            verifyAll();
        });
    });

    suite('directoryExists', () => {
        test('want directory, got directory', async () => {
            const dirname = 'x/y/z/spam';
            filesystem.setup(f => f.stat(dirname))
                .returns(() => Promise.resolve(stat.object));
            stat.setup(s => s.type)
                .returns(() => FileType.Directory);

            const exists = await utils.directoryExists(dirname);

            expect(exists).to.equal(true);
            verifyAll();
        });
    });

    suite('getSubDirectories', () => {
        test('mixed types', async () => {
            const dirname = 'x/y/z/spam';
            const files: [string, FileType][] = [
                ['w', FileType.Directory],
                ['spam.py', FileType.File],
                ['v', FileType.Directory],
                ['eggs.py', FileType.File],
                ['dev1', FileType.Unknown],
                ['other', FileType.SymbolicLink],
                ['data.json', FileType.File]
            ];
            filesystem.setup(f => f.listdir(dirname))
                .returns(() => Promise.resolve(files));
            ['w', 'v'].forEach(name => {
                path.setup(p => p.join(dirname, name))
                    .returns(() => `${dirname}/${name}`);
            });

            const results = await utils.getSubDirectories(dirname);

            expect(results).to.deep.equal([
                'x/y/z/spam/w',
                'x/y/z/spam/v'
            ]);
            verifyAll();
        });

        test('empty if the raw call fails', async () => {
            const dirname = 'x/y/z/spam';
            filesystem.setup(f => f.listdir(dirname))
                .throws(new Error('directory not found'));

            const entries = await utils.getSubDirectories(dirname);

            expect(entries).to.deep.equal([]);
            verifyAll();
        });
    });

    suite('getFiles', () => {
        test('mixed types', async () => {
            const dirname = 'x/y/z/spam';
            const files: [string, FileType][] = [
                ['w', FileType.Directory],
                ['spam.py', FileType.File],
                ['v', FileType.Directory],
                ['eggs.py', FileType.File],
                ['dev1', FileType.Unknown],
                ['other', FileType.SymbolicLink],
                ['data.json', FileType.File]
            ];
            filesystem.setup(f => f.listdir(dirname))
                .returns(() => Promise.resolve(files));
            ['spam.py', 'eggs.py', 'data.json'].forEach(name => {
                path.setup(p => p.join(dirname, name))
                    .returns(() => `${dirname}/${name}`);
            });

            const results = await utils.getFiles(dirname);

            expect(results).to.deep.equal([
                'x/y/z/spam/spam.py',
                'x/y/z/spam/eggs.py',
                'x/y/z/spam/data.json'
            ]);
            verifyAll();
        });

        test('empty if the raw call fails', async () => {
            const dirname = 'x/y/z/spam';
            filesystem.setup(f => f.listdir(dirname))
                .throws(new Error('directory not found'));

            const entries = await utils.getFiles(dirname);

            expect(entries).to.deep.equal([]);
            verifyAll();
        });
    });

    suite('isDirReadonly', () => {
        test('is readonly', async () => {
            const dirname = 'x/y/z/spam';
            tmp.setup(t => t.createFile('___vscpTest___', dirname))
                .throws(new Error('operation not permitted'));
            filesystem.setup(f => f.stat(dirname))
                //tslint:disable-next-line:no-any
                .returns(() => Promise.resolve({} as any as FileStat));

            const isReadonly = await utils.isDirReadonly(dirname);

            expect(isReadonly).to.equal(true);
            verifyAll();
        });

        test('is not readonly', async () => {
            const disposable = TypeMoq.Mock.ofType<Disposable>(undefined, TypeMoq.MockBehavior.Strict);
            const dirname = 'x/y/z/spam';
            const filename = 'x/y/z/spam/a713Gb___vscpTest___';
            const tmpFile = {
                filePath: filename,
                dispose: () => disposable.object.dispose()
            };
            tmp.setup(t => t.createFile('___vscpTest___', dirname))
                .returns(() => Promise.resolve(tmpFile));
            disposable.setup(d => d.dispose())
                .returns(() => { /* do nothing */ });

            const isReadonly = await utils.isDirReadonly(dirname);

            expect(isReadonly).to.equal(false);
            verifyAll();
            disposable.verifyAll();
        });

        test('directory does not exist', async () => {
            const dirname = 'x/y/z/spam';
            tmp.setup(t => t.createFile('___vscpTest___', dirname))
                .throws(new Error('file not found'));
            filesystem.setup(f => f.stat(dirname))
                .throws(new Error('file not found'));

            const promise = utils.isDirReadonly(dirname);

            await expect(promise).to.eventually.be.rejected;
            verifyAll();
        });
    });

    suite('getFileHash', () => {
        test('Getting hash for non existent file should throw error', async () => {
            const filename = 'some unknown file';
            filesystem.setup(f => f.lstat(filename))
                .throws(new Error('file not found'));

            const promise = utils.getFileHash(filename);

            await expect(promise).to.eventually.be.rejected;
            verifyAll();
        });

        test('Getting hash for a file should return non-empty string', async () => {
            const filename = 'x/y/z/spam.py';
            filesystem.setup(f => f.lstat(filename))
                .returns(() => Promise.resolve(stat.object));
            stat.setup(s => s.ctime)
                .returns(() => 101);
            stat.setup(s => s.mtime)
                .returns(() => 102);
            const expected = '<hash>';
            deps.setup(d => d.getHashString('101-102'))
                .returns(() => expected);

            const hash = await utils.getFileHash(filename);

            expect(hash).to.equal(expected);
            verifyAll();
        });
    });

    suite('search', () => {
        test('found matches', async () => {
            const pattern = `x/y/z/spam.*`;
            const expected: string[] = [
                'x/y/z/spam.py',
                'x/y/z/spam.pyc',
                'x/y/z/spam.so'
            ];
            deps.setup(d => d.glob(pattern))
                .returns(() => Promise.resolve(expected));

            const files = await utils.search(pattern);

            expect(files).to.deep.equal(expected);
            verifyAll();
        });

        test('no matches (empty)', async () => {
            const pattern = `x/y/z/spam.*`;
            deps.setup(d => d.glob(pattern))
                .returns(() => Promise.resolve([]));

            const files = await utils.search(pattern);

            expect(files).to.deep.equal([]);
            verifyAll();
        });

        test('no matches (undefined)', async () => {
            const pattern = `x/y/z/spam.*`;
            deps.setup(d => d.glob(pattern))
                //tslint:disable-next-line:no-any
                .returns(() => Promise.resolve(undefined as any as string[]));

            const files = await utils.search(pattern);

            expect(files).to.deep.equal([]);
            verifyAll();
        });

        test('failed', async () => {
            const pattern = `x/y/z/spam.*`;
            const err = new Error('something went wrong');
            deps.setup(d => d.glob(pattern))
                .throws(err);

            const promise = utils.search(pattern);

            await expect(promise).to.eventually.be.rejected;
            verifyAll();
        });
    });
});
