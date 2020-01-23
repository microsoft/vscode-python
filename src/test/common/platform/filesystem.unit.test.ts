// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as fs from 'fs';
import * as fsextra from 'fs-extra';
import * as TypeMoq from 'typemoq';
import * as vscode from 'vscode';
import { RawFileSystem } from '../../../client/common/platform/fileSystem';
// prettier-ignore
import {
    FileStat, FileType, ReadStream, WriteStream
} from '../../../client/common/platform/types';

// tslint:disable:max-func-body-length chai-vague-errors

function createDummyStat(filetype: FileType): FileStat {
    //tslint:disable-next-line:no-any
    return { type: filetype } as any;
}

interface IRawFS {
    // vscode.workspace.fs
    stat(uri: vscode.Uri): Thenable<FileStat>;

    // "fs-extra"
    stat(filename: string): Promise<fs.Stats>;
    lstat(filename: string): Promise<fs.Stats>;
    readdir(dirname: string): Promise<string[]>;
    readFile(filename: string): Promise<Buffer>;
    readFile(filename: string, encoding: string): Promise<string>;
    mkdirp(dirname: string): Promise<void>;
    chmod(filePath: string, mode: string | number): Promise<void>;
    rename(src: string, tgt: string): Promise<void>;
    writeFile(filename: string, data: {}, options: {}): Promise<void>;
    appendFile(filename: string, data: {}): Promise<void>;
    unlink(filename: string): Promise<void>;
    rmdir(dirname: string): Promise<void>;
    readFileSync(path: string, encoding: string): string;
    createReadStream(filename: string): ReadStream;
    createWriteStream(filename: string): WriteStream;

    // fs paths (IFileSystemPaths)
    join(...filenames: string[]): string;
}

suite('Raw FileSystem', () => {
    let raw: TypeMoq.IMock<IRawFS>;
    let oldStats: TypeMoq.IMock<fs.Stats>[];
    let filesystem: RawFileSystem;
    setup(() => {
        raw = TypeMoq.Mock.ofType<IRawFS>(undefined, TypeMoq.MockBehavior.Strict);
        oldStats = [];
        filesystem = new RawFileSystem(
            // Since it's a mock we can just use it for all 3 values.
            raw.object,
            raw.object,
            raw.object
        );
    });
    function verifyAll() {
        raw.verifyAll();
        oldStats.forEach(stat => {
            stat.verifyAll();
        });
    }
    function createMockLegacyStat(): TypeMoq.IMock<fsextra.Stats> {
        const stat = TypeMoq.Mock.ofType<fsextra.Stats>(undefined, TypeMoq.MockBehavior.Strict);
        // This is necessary because passing "mock.object" to
        // Promise.resolve() triggers the lookup.
        //tslint:disable-next-line:no-any
        stat.setup((s: any) => s.then)
            .returns(() => undefined)
            .verifiable(TypeMoq.Times.atLeast(0));
        oldStats.push(stat);
        return stat;
    }
    function setupStatFileType(stat: TypeMoq.IMock<fs.Stats>, filetype: FileType) {
        // This mirrors the logic in convertFileType().
        if (filetype === FileType.File) {
            stat.setup(s => s.isFile())
                .returns(() => true)
                .verifiable(TypeMoq.Times.atLeastOnce());
        } else if (filetype === FileType.Directory) {
            stat.setup(s => s.isFile())
                .returns(() => false)
                .verifiable(TypeMoq.Times.atLeastOnce());
            stat.setup(s => s.isDirectory())
                .returns(() => true)
                .verifiable(TypeMoq.Times.atLeastOnce());
        } else if ((filetype & FileType.SymbolicLink) > 0) {
            stat.setup(s => s.isFile())
                .returns(() => false)
                .verifiable(TypeMoq.Times.atLeastOnce());
            stat.setup(s => s.isDirectory())
                .returns(() => false)
                .verifiable(TypeMoq.Times.atLeastOnce());
            stat.setup(s => s.isSymbolicLink())
                .returns(() => true)
                .verifiable(TypeMoq.Times.atLeastOnce());
        } else if (filetype === FileType.Unknown) {
            stat.setup(s => s.isFile())
                .returns(() => false)
                .verifiable(TypeMoq.Times.atLeastOnce());
            stat.setup(s => s.isDirectory())
                .returns(() => false)
                .verifiable(TypeMoq.Times.atLeastOnce());
            stat.setup(s => s.isSymbolicLink())
                .returns(() => false)
                .verifiable(TypeMoq.Times.atLeastOnce());
        } else {
            throw Error(`unsupported file type ${filetype}`);
        }
    }

    suite('stat', () => {
        test('wraps the low-level function', async () => {
            const filename = 'x/y/z/spam.py';
            const expected = createDummyStat(FileType.File);
            raw.setup(r => r.stat(vscode.Uri.file(filename))) // expect the specific filename
                .returns(() => Promise.resolve(expected));

            const stat = await filesystem.stat(filename);

            expect(stat).to.equal(expected);
            verifyAll();
        });

        test('fails if the low-level call fails', async () => {
            raw.setup(r => r.stat(TypeMoq.It.isAny())) // We don't care about the filename.
                .throws(new Error('file not found'));

            const promise = filesystem.stat('spam.py');

            await expect(promise).to.eventually.be.rejected;
            verifyAll();
        });
    });

    suite('lstat', () => {
        function copyStat(stat: FileStat, old: TypeMoq.IMock<fsextra.Stats>) {
            old.setup(s => s.size) // plug in the original value
                .returns(() => stat.size);
            old.setup(s => s.ctimeMs) // plug in the original value
                .returns(() => stat.ctime);
            old.setup(s => s.mtimeMs) // plug in the original value
                .returns(() => stat.mtime);
        }

        [
            { kind: 'file', filetype: FileType.File },
            { kind: 'dir', filetype: FileType.Directory },
            { kind: 'symlink', filetype: FileType.SymbolicLink },
            { kind: 'unknown', filetype: FileType.Unknown }
        ].forEach(testData => {
            test(`wraps the low-level function (filetype: ${testData.kind}`, async () => {
                const filename = 'x/y/z/spam.py';
                const expected: FileStat = {
                    type: testData.filetype,
                    size: 10,
                    ctime: 101,
                    mtime: 102
                    //tslint:disable-next-line:no-any
                } as any;
                const old = createMockLegacyStat();
                setupStatFileType(old, testData.filetype);
                copyStat(expected, old);
                raw.setup(r => r.lstat(filename)) // expect the specific filename
                    .returns(() => Promise.resolve(old.object));

                const stat = await filesystem.lstat(filename);

                expect(stat).to.deep.equal(expected);
                verifyAll();
            });
        });

        test('fails if the low-level call fails', async () => {
            raw.setup(r => r.lstat(TypeMoq.It.isAny())) // We don't care about the filename.
                .throws(new Error('file not found'));

            const promise = filesystem.lstat('spam.py');

            await expect(promise).to.eventually.be.rejected;
            verifyAll();
        });
    });

    suite('chmod', () => {
        test('passes through a string mode', async () => {
            const filename = 'x/y/z/spam.py';
            const mode = '755';
            raw.setup(r => r.chmod(filename, mode)) // expect the specific filename
                .returns(() => Promise.resolve());

            await filesystem.chmod(filename, mode);

            verifyAll();
        });

        test('passes through an int mode', async () => {
            const filename = 'x/y/z/spam.py';
            const mode = 0o755;
            raw.setup(r => r.chmod(filename, mode)) // expect the specific filename
                .returns(() => Promise.resolve());

            await filesystem.chmod(filename, mode);

            verifyAll();
        });

        test('fails if the low-level call fails', async () => {
            raw.setup(r => r.chmod(TypeMoq.It.isAny(), TypeMoq.It.isAny())) // We don't care about the filename.
                .throws(new Error('file not found'));

            const promise = filesystem.chmod('spam.py', 755);

            await expect(promise).to.eventually.be.rejected;
            verifyAll();
        });
    });

    suite('move', () => {
        test('wraps the low-level function', async () => {
            const src = 'x/y/z/spam.py';
            const tgt = 'x/y/spam.py';
            raw.setup(r => r.rename(src, tgt)) // expect the specific filename
                .returns(() => Promise.resolve());

            await filesystem.move(src, tgt);

            verifyAll();
        });

        test('fails if the low-level call fails', async () => {
            raw.setup(r => r.rename(TypeMoq.It.isAny(), TypeMoq.It.isAny())) // We don't care about the filename.
                .throws(new Error('file not found'));

            const promise = filesystem.move('spam', 'eggs');

            await expect(promise).to.eventually.be.rejected;
            verifyAll();
        });
    });

    suite('readData', () => {
        test('wraps the low-level function', async () => {
            const filename = 'x/y/z/spam.py';
            const expected = Buffer.from('<data>');
            raw.setup(r => r.readFile(filename)) // expect the specific filename
                .returns(() => Promise.resolve(expected));

            const data = await filesystem.readData(filename);

            expect(data).to.equal(expected);
            verifyAll();
        });

        test('fails if the low-level call fails', async () => {
            raw.setup(r => r.readFile(TypeMoq.It.isAny())) // We don't care about the filename.
                .throws(new Error('file not found'));

            const promise = filesystem.readData('spam.py');

            await expect(promise).to.eventually.be.rejected;
            verifyAll();
        });
    });

    suite('readText', () => {
        test('wraps the low-level function', async () => {
            const filename = 'x/y/z/spam.py';
            const expected = '<text>';
            raw.setup(r => r.readFile(filename, 'utf8')) // expect the specific filename
                .returns(() => Promise.resolve(expected));

            const text = await filesystem.readText(filename);

            expect(text).to.equal(expected);
            verifyAll();
        });

        test('fails if the low-level call fails', async () => {
            raw.setup(r => r.readFile(TypeMoq.It.isAny(), TypeMoq.It.isAny())) // We don't care about the filename.
                .throws(new Error('file not found'));

            const promise = filesystem.readText('spam.py');

            await expect(promise).to.eventually.be.rejected;
            verifyAll();
        });
    });

    suite('writeText', () => {
        test('wraps the low-level function', async () => {
            const filename = 'x/y/z/spam.py';
            const text = '<text>';
            raw.setup(r => r.writeFile(filename, text, { encoding: 'utf8' })) // expect the specific filename
                .returns(() => Promise.resolve());

            await filesystem.writeText(filename, text);

            verifyAll();
        });

        test('fails if the low-level call fails', async () => {
            raw.setup(r => r.writeFile(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())) // We don't care about the filename.
                .throws(new Error('file not found'));

            const promise = filesystem.writeText('spam.py', '<text>');

            await expect(promise).to.eventually.be.rejected;
            verifyAll();
        });
    });

    suite('appendText', () => {
        test('wraps the low-level function', async () => {
            const filename = 'x/y/z/spam.py';
            const text = '<text>';
            raw.setup(r => r.appendFile(filename, text)) // expect the specific filename
                .returns(() => Promise.resolve());

            await filesystem.appendText(filename, text);

            verifyAll();
        });

        test('fails if the low-level call fails', async () => {
            raw.setup(r => r.appendFile(TypeMoq.It.isAny(), TypeMoq.It.isAny())) // We don't care about the filename.
                .throws(new Error('file not found'));

            const promise = filesystem.appendText('spam.py', '<text>');

            await expect(promise).to.eventually.be.rejected;
            verifyAll();
        });
    });

    suite('copyFile', () => {
        type StreamCallbacks = {
            err(err: Error): void;
            close(): void;
        };
        function setupMocks(src: string, tgt: string): { r: StreamCallbacks; w: StreamCallbacks } {
            const callbacks = {
                //tslint:disable-next-line:no-any
                r: ({} as any) as StreamCallbacks,
                //tslint:disable-next-line:no-any
                w: ({} as any) as StreamCallbacks
            };

            const wstream = TypeMoq.Mock.ofType<fs.WriteStream>(undefined, TypeMoq.MockBehavior.Strict);
            wstream
                .setup(s => s.on('error', TypeMoq.It.isAny()))
                .callback((_e, cb) => {
                    callbacks.w.err = cb;
                })
                .returns(() => wstream.object);
            wstream
                .setup(s => s.on('close', TypeMoq.It.isAny()))
                .callback((_e, cb) => {
                    callbacks.w.close = cb;
                })
                .returns(() => wstream.object);
            wstream
                //tslint:disable-next-line:no-any
                .setup((s: any) => s.___matches) // typemoq sometimes outsmarts itself
                .returns(() => undefined);
            raw.setup(r => r.createWriteStream(tgt)) // expect the specific filename
                .returns(() => wstream.object);

            const rstream = TypeMoq.Mock.ofType<fs.ReadStream>(undefined, TypeMoq.MockBehavior.Strict);
            rstream
                .setup(s => s.on('error', TypeMoq.It.isAny()))
                .callback((_e, cb) => {
                    callbacks.r.err = cb;
                })
                .returns(() => rstream.object);
            rstream.setup(s => s.pipe(wstream.object));
            raw.setup(r => r.createReadStream(src)) // expect the specific filename
                .returns(() => rstream.object);

            return callbacks;
        }

        test('wraps the low-level function', async () => {
            const src = 'spam.py';
            const tgt = 'eggs.py';
            const cb = setupMocks(src, tgt);

            // Due to the use of deferred, we must call the handler
            // registered on the stream in order to make the promise
            // resolve.
            const promise = filesystem.copyFile(src, tgt);
            cb.w.close();
            await promise;

            verifyAll();
        });

        test('fails if createReadStream fails', async () => {
            raw.setup(r => r.createReadStream(TypeMoq.It.isAny())) // We don't care about the filename.
                .throws(new Error('file not found'));

            const promise = filesystem.copyFile('spam', 'eggs');

            await expect(promise).to.eventually.be.rejected;
            verifyAll();
        });

        test('fails if createWriteStream fails', async () => {
            const rstream = TypeMoq.Mock.ofType<fs.ReadStream>(undefined, TypeMoq.MockBehavior.Strict);
            rstream.setup(s => s.on('error', TypeMoq.It.isAny()));
            raw.setup(r => r.createReadStream(TypeMoq.It.isAny())) // We don't care about the filename.
                .throws(new Error('file not found'));

            const promise = filesystem.copyFile('spam', 'eggs');

            await expect(promise).to.eventually.be.rejected;
            verifyAll();
        });

        test('fails if read stream errors out', async () => {
            const src = 'spam.py';
            const tgt = 'eggs.py';
            const cb = setupMocks(src, tgt);

            const promise = filesystem.copyFile(src, tgt);
            cb.r.err(new Error('oops!'));

            await expect(promise).to.eventually.be.rejected;
            verifyAll();
        });

        test('fails if write stream errors out', async () => {
            const src = 'spam.py';
            const tgt = 'eggs.py';
            const cb = setupMocks(src, tgt);

            const promise = filesystem.copyFile(src, tgt);
            cb.w.err(new Error('oops!'));

            await expect(promise).to.eventually.be.rejected;
            verifyAll();
        });
    });

    suite('rmFile', () => {
        test('wraps the low-level function', async () => {
            const filename = 'x/y/z/spam.py';
            raw.setup(r => r.unlink(filename)) // expect the specific filename
                .returns(() => Promise.resolve());

            await filesystem.rmfile(filename);

            verifyAll();
        });

        test('fails if the low-level call fails', async () => {
            raw.setup(r => r.unlink(TypeMoq.It.isAny())) // We don't care about the filename.
                .throws(new Error('file not found'));

            const promise = filesystem.rmfile('spam.py');

            await expect(promise).to.eventually.be.rejected;
            verifyAll();
        });
    });

    suite('mkdirp', () => {
        test('wraps the low-level function', async () => {
            const dirname = 'x/y/z/spam';
            raw.setup(r => r.mkdirp(dirname)) // expect the specific filename
                .returns(() => Promise.resolve());

            await filesystem.mkdirp(dirname);

            verifyAll();
        });

        test('fails if the low-level call fails', async () => {
            raw.setup(r => r.mkdirp(TypeMoq.It.isAny())) // We don't care about the filename.
                .throws(new Error('file not found'));

            const promise = filesystem.mkdirp('spam');

            await expect(promise).to.eventually.be.rejected;
            verifyAll();
        });
    });

    suite('rmtree', () => {
        test('wraps the low-level function', async () => {
            const dirname = 'x/y/z/spam';
            raw.setup(r => r.rmdir(dirname)) // expect the specific filename
                .returns(() => Promise.resolve());

            await filesystem.rmtree(dirname);

            verifyAll();
        });

        test('fails if the low-level call fails', async () => {
            raw.setup(r => r.rmdir(TypeMoq.It.isAny())) // We don't care about the filename.
                .throws(new Error('file not found'));

            const promise = filesystem.rmtree('spam');

            await expect(promise).to.eventually.be.rejected;
            verifyAll();
        });
    });

    suite('listdir', () => {
        function setupForFileType(filename: string, filetype: FileType) {
            const lstat = createMockLegacyStat();
            if ((filetype & FileType.SymbolicLink) > 0) {
                lstat
                    .setup(s => s.isSymbolicLink()) // we don't care about any other type here
                    .returns(() => true);

                const stat = createMockLegacyStat();
                // filetype won't be Unknown here.
                setupStatFileType(stat, filetype - FileType.SymbolicLink);
                raw.setup(r => r.stat(filename)) // expect the specific filename
                    .returns(() => Promise.resolve(stat.object));
            } else {
                lstat
                    .setup(s => s.isSymbolicLink())
                    .returns(() => false)
                    .verifiable(TypeMoq.Times.atLeastOnce());
                setupStatFileType(lstat, filetype);
            }
            raw.setup(r => r.lstat(filename)) // expect the specific filename
                .returns(() => Promise.resolve(lstat.object));
        }

        test('mixed', async () => {
            const dirname = 'x/y/z/spam';
            const names = [
                // These match the items in "expected".
                'dev1',
                'w',
                'spam.py',
                'other'
            ];
            const expected: [string, FileType][] = [
                ['x/y/z/spam/dev1', FileType.Unknown],
                ['x/y/z/spam/w', FileType.Directory],
                ['x/y/z/spam/spam.py', FileType.File],
                ['x/y/z/spam/other', FileType.SymbolicLink | FileType.File]
            ];
            raw.setup(r => r.readdir(dirname)) // expect the specific filename
                .returns(() => Promise.resolve(names));
            names.forEach((name, i) => {
                const [filename, filetype] = expected[i];
                raw.setup(r => r.join(dirname, name)) // expect the specific filename
                    .returns(() => filename);
                setupForFileType(filename, filetype);
            });

            const entries = await filesystem.listdir(dirname);

            expect(entries).to.deep.equal(expected);
            verifyAll();
        });

        test('empty', async () => {
            const dirname = 'x/y/z/spam';
            const expected: [string, FileType][] = [];
            raw.setup(r => r.readdir(dirname)) // expect the specific filename
                .returns(() => Promise.resolve([]));

            const entries = await filesystem.listdir(dirname);

            expect(entries).to.deep.equal(expected);
            verifyAll();
        });

        test('fails if the low-level call fails', async () => {
            raw.setup(r => r.readdir(TypeMoq.It.isAny())) // We don't care about the filename.
                .throws(new Error('file not found'));

            const promise = filesystem.listdir('spam');

            await expect(promise).to.eventually.be.rejected;
            verifyAll();
        });
    });

    suite('readTextSync', () => {
        test('wraps the low-level function', () => {
            const filename = 'x/y/z/spam.py';
            const expected = '<text>';
            raw.setup(r => r.readFileSync(filename, 'utf8')) // expect the specific filename
                .returns(() => expected);

            const text = filesystem.readTextSync(filename);

            expect(text).to.equal(expected);
            verifyAll();
        });

        test('fails if the low-level call fails', async () => {
            raw.setup(r => r.readFileSync(TypeMoq.It.isAny(), TypeMoq.It.isAny())) // We don't care about the filename.
                .throws(new Error('file not found'));

            expect(() => filesystem.readTextSync('spam.py')).to.throw();

            verifyAll();
        });
    });

    suite('createReadStream', () => {
        test('wraps the low-level function', () => {
            const filename = 'x/y/z/spam.py';
            //tslint:disable-next-line:no-any
            const expected = {} as any;
            raw.setup(r => r.createReadStream(filename)) // expect the specific filename
                .returns(() => expected);

            const stream = filesystem.createReadStream(filename);

            expect(stream).to.equal(expected);
            verifyAll();
        });

        test('fails if the low-level call fails', async () => {
            raw.setup(r => r.createReadStream(TypeMoq.It.isAny())) // We don't care about the filename.
                .throws(new Error('file not found'));

            expect(() => filesystem.createReadStream('spam.py')).to.throw();

            verifyAll();
        });
    });

    suite('createWriteStream', () => {
        test('wraps the low-level function', () => {
            const filename = 'x/y/z/spam.py';
            //tslint:disable-next-line:no-any
            const expected = {} as any;
            raw.setup(r => r.createWriteStream(filename)) // expect the specific filename
                .returns(() => expected);

            const stream = filesystem.createWriteStream(filename);

            expect(stream).to.equal(expected);
            verifyAll();
        });

        test('fails if the low-level call fails', async () => {
            raw.setup(r => r.createWriteStream(TypeMoq.It.isAny())) // We don't care about the filename.
                .throws(new Error('file not found'));

            expect(() => filesystem.createWriteStream('spam.py')).to.throw();

            verifyAll();
        });
    });
});

// tslint:disable-next-line:no-suspicious-comment
// TODO(GH-8995): The FileSystem isn't unit-tesstable currently.  Once
// we address that, all its methods should have tests here.
