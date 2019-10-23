// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect, use } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import { FileSystem } from '../../../client/common/platform/fileSystem';
import { TemporaryFile } from '../../../client/common/platform/types';
// tslint:disable:no-require-imports no-var-requires
const assertArrays = require('chai-arrays');
use(require('chai-as-promised'));
use(assertArrays);

// tslint:disable-next-line:max-func-body-length
suite('FileSystem', () => {
    const fileToAppendTo = path.join(__dirname, 'created_for_testing_dummy.txt');
    setup(() => {
        cleanTestFiles(); // This smells like functional testing...
    });
    teardown(cleanTestFiles);
    function cleanTestFiles() {
        if (fs.existsSync(fileToAppendTo)) {
            fs.unlinkSync(fileToAppendTo);
        }
    }

    test('ReadFile returns contents of a file', async () => {
        const file = __filename;
        const filesystem = new FileSystem();
        const expectedContents = await fs.readFile(file).then(buffer => buffer.toString());

        const content = await filesystem.readFile(file);

        expect(content).to.be.equal(expectedContents);
    });

    test('ReadFile throws an exception if file does not exist', async () => {
        const filesystem = new FileSystem();

        const readPromise = filesystem.readFile('xyz');

        await expect(readPromise).to.be.rejectedWith();
    });

    suite('Case sensitivity', () => {
        const path1 = 'c:\\users\\Peter Smith\\my documents\\test.txt';
        const path2 = 'c:\\USERS\\Peter Smith\\my documents\\test.TXT';
        const path3 = 'c:\\USERS\\Peter Smith\\my documents\\test.exe';

        test('Case sensitivity is ignored when comparing file names on windows', () => {
            const isWindows = true;
            const filesystem = new FileSystem(isWindows);

            const same12 = filesystem.arePathsSame(path1, path2);
            const same11 = filesystem.arePathsSame(path1, path1);
            const same22 = filesystem.arePathsSame(path2, path2);
            const same13 = filesystem.arePathsSame(path1, path3);

            expect(same12).to.be.equal(true, 'file paths do not match (windows)');
            expect(same11).to.be.equal(true, '1. file paths do not match');
            expect(same22).to.be.equal(true, '2. file paths do not match');
            expect(same13).to.be.equal(false, '2. file paths do not match');
        });

        test('Case sensitivity is not ignored when comparing file names on non-Windows', () => {
            const isWindows = false;
            const filesystem = new FileSystem(isWindows);

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
});
