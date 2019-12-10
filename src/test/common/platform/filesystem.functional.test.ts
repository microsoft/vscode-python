// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:max-func-body-length

import { expect, use } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import { FileSystem } from '../../../client/common/platform/fileSystem';
import { PlatformService } from '../../../client/common/platform/platformService';
import { IFileSystem, TemporaryFile } from '../../../client/common/platform/types';
// tslint:disable:no-require-imports no-var-requires
const assertArrays = require('chai-arrays');
use(require('chai-as-promised'));
use(assertArrays);

suite('FileSystem', () => {
    let fileSystem: IFileSystem;
    setup(() => {
        fileSystem = new FileSystem(
            new PlatformService()
        );
    });

    suite('path-related', () => {
        suite('directorySeparatorChar', () => {
            test('value', () => {
                const sep = fileSystem.directorySeparatorChar;

                expect(sep).to.equal(path.sep);
            });
        });

        suite('arePathsSame', () => {
            test('', () => {
                // XXX
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
            test('', async () => {
                // XXX
            });
        });

        suite('deleteDirectory', () => {
            test('', async () => {
                // XXX
            });
        });

        suite('readFile', () => {
            test('returns contents of a file', async () => {
                const filename = __filename;
                const expected = await fs.readFile(filename, 'utf8');

                const text = await fileSystem.readFile(filename);

                expect(text).to.be.equal(expected);
            });

            test('throws an exception if file does not exist', async () => {
                const readPromise = fileSystem.readFile('xyz');

                await expect(readPromise).to.be.rejectedWith();
            });

            test('', async () => {
                // XXX
            });
        });

        suite('writeFile', () => {
            test('', async () => {
                // XXX
            });
        });

        suite('appendFile', () => {
            test('', async () => {
                // XXX
            });
        });

        suite('copyFile', () => {
            test('', async () => {
                // XXX
            });
        });

        suite('deleteFile', () => {
            test('', async () => {
                // XXX
            });
        });

        suite('chmod', () => {
            test('', async () => {
                // XXX
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
            test('', async () => {
                // XXX
            });
        });

        suite('appendFileSync', () => {
            const fileToAppendTo = path.join(__dirname, 'created_for_testing_dummy.txt');
            setup(cleanTestFiles);
            teardown(cleanTestFiles);
            function cleanTestFiles() {
                if (fs.existsSync(fileToAppendTo)) {
                    fs.unlinkSync(fileToAppendTo);
                }
            }

            test('appending to a file works', async () => {
                const dataToAppend = `Some Data\n${new Date().toString()}\nAnd another line`;

                fileSystem.appendFileSync(fileToAppendTo, dataToAppend);

                const actual = await fs.readFile(fileToAppendTo, 'utf8');
                expect(actual).to.be.equal(dataToAppend);
            });

            test('', async () => {
                // XXX
            });
        });

        suite('createReadStream', () => {
            test('', async () => {
                // XXX
            });
        });

        suite('createWriteStream', () => {
            test('', async () => {
                // XXX
            });
        });
    });

    suite('utils', () => {
        suite('fileExists', () => {
            test('', async () => {
                // XXX
            });
        });

        suite('directoryExists', () => {
            test('', async () => {
                // XXX
            });
        });

        suite('getSubDirectories', () => {
            test('', async () => {
                // XXX
            });
        });

        suite('getFiles', () => {
            test('', async () => {
                // XXX
            });
        });

        suite('getFileHash', () => {
            test('Getting hash for non existent file should throw error', async () => {
                const promise = fileSystem.getFileHash('some unknown file');

                await expect(promise).to.eventually.be.rejected;
            });

            test('Getting hash for a file should return non-empty string', async () => {
                const hash = await fileSystem.getFileHash(__filename);

                expect(hash).to.be.length.greaterThan(0); // weak
            });

            test('', async () => {
                // XXX
            });
        });

        suite('search', () => {
            test('Test searching for files', async () => {
                const expected = __filename.replace(/\\/g, '/');
                const searchPattern = `${path.basename(__filename, __filename.substring(__filename.length - 3))}.*`;

                const files = await fileSystem.search(path.join(__dirname, searchPattern));

                expect(files).to.be.array();
                expect(files.length).to.be.at.least(1);
                const fileName = files[0].replace(/\\/g, '/');
                expect(fileName).to.equal(expected);
            });

            test('', async () => {
                // XXX
            });
        });

        suite('createTemporaryFile', () => {
            test('Ensure creating a temporary file results in a unique temp file path', async () => {
                const tempFile = await fileSystem.createTemporaryFile('.tmp');
                const tempFile2 = await fileSystem.createTemporaryFile('.tmp');

                expect(tempFile.filePath).to.not.equal(tempFile2.filePath, 'Temp files must be unique, implementation of createTemporaryFile is off.');
            });

            test('Ensure chmod works against a temporary file', async () => {
                await fileSystem.createTemporaryFile('.tmp')
                    .then(async (fl: TemporaryFile) => {
                        await fileSystem.chmod(fl.filePath, '7777')
                            .then(
                                (_success: void) => {
                                    // cannot check for success other than we got here, chmod in Windows won't have any effect on the file itself.
                                },
                                (failReason) => {
                                    expect(failReason).to.equal('There was no error using chmod', `Failed to perform chmod operation successfully, got error ${failReason}`);
                                }
                            );
                    });
            });

            test('Ensure writing to a temp file is supported via file stream', async () => {
                await fileSystem.createTemporaryFile('.tmp')
                    .then(
                        (tf: TemporaryFile) => {
                            expect(tf).to.not.equal(undefined, 'Error trying to create a temporary file');
                            const writeStream = fileSystem.createWriteStream(tf.filePath);
                            writeStream.write('hello', 'utf8', (err: Error | null | undefined) => {
                                expect(err).to.equal(undefined, `Failed to write to a temp file, error is ${err}`);
                            });
                        },
                        (failReason) => {
                            expect(failReason).to.equal('No errors occurred', `Failed to create a temporary file with error ${failReason}`);
                        }
                    );
            });

            test('', async () => {
                // XXX
            });
        });

        suite('isDirReadonly', () => {
            test('', async () => {
                // XXX
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
