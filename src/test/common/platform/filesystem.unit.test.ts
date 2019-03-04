// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect, use } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { FileSystem } from '../../../client/common/platform/fileSystem';
import { IFileSystem, IPlatformService, TemporaryFile } from '../../../client/common/platform/types';
// tslint:disable-next-line:no-require-imports no-var-requires
const assertArrays = require('chai-arrays');
use(assertArrays);

// tslint:disable-next-line:max-func-body-length
suite('FileSystem', () => {
    let platformService: TypeMoq.IMock<IPlatformService>;
    let fileSystem: IFileSystem;
    const fileToAppendTo = path.join(__dirname, 'created_for_testing_dummy.txt');
    setup(() => {
        platformService = TypeMoq.Mock.ofType<IPlatformService>();
        fileSystem = new FileSystem(platformService.object);
        cleanTestFiles();
    });
    teardown(cleanTestFiles);
    function cleanTestFiles() {
        if (fs.existsSync(fileToAppendTo)) {
            fs.unlinkSync(fileToAppendTo);
        }
    }
    test('ReadFile returns contents of a file', async () => {
        const file = __filename;
        const expectedContents = await fs.readFile(file).then(buffer => buffer.toString());
        const content = await fileSystem.readFile(file);

        expect(content).to.be.equal(expectedContents);
    });

    test('ReadFile throws an exception if file does not exist', async () => {
        const readPromise = fs.readFile('xyz', { encoding: 'utf8' });
        await expect(readPromise).to.be.rejectedWith();
    });

    function caseSensitivityFileCheck(isWindows: boolean, isOsx: boolean, isLinux: boolean) {
        platformService.setup(p => p.isWindows).returns(() => isWindows);
        platformService.setup(p => p.isMac).returns(() => isOsx);
        platformService.setup(p => p.isLinux).returns(() => isLinux);
        const path1 = 'c:\\users\\Peter Smith\\my documents\\test.txt';
        const path2 = 'c:\\USERS\\Peter Smith\\my documents\\test.TXT';
        const path3 = 'c:\\USERS\\Peter Smith\\my documents\\test.exe';

        if (isWindows) {
            expect(fileSystem.arePathsSame(path1, path2)).to.be.equal(true, 'file paths do not match (windows)');
        } else {
            expect(fileSystem.arePathsSame(path1, path2)).to.be.equal(false, 'file match (non windows)');
        }

        expect(fileSystem.arePathsSame(path1, path1)).to.be.equal(true, '1. file paths do not match');
        expect(fileSystem.arePathsSame(path2, path2)).to.be.equal(true, '2. file paths do not match');
        expect(fileSystem.arePathsSame(path1, path3)).to.be.equal(false, '2. file paths do not match');
    }

    test('Case sensitivity is ignored when comparing file names on windows', async () => {
        caseSensitivityFileCheck(true, false, false);
    });

    test('Case sensitivity is not ignored when comparing file names on osx', async () => {
        caseSensitivityFileCheck(false, true, false);
    });

    test('Case sensitivity is not ignored when comparing file names on linux', async () => {
        caseSensitivityFileCheck(false, false, true);
    });
    test('Check existence of files synchronously', async () => {
        expect(fileSystem.fileExistsSync(__filename)).to.be.equal(true, 'file not found');
    });

    test('Test appending to file', async () => {
        const dataToAppend = `Some Data\n${new Date().toString()}\nAnd another line`;
        fileSystem.appendFileSync(fileToAppendTo, dataToAppend);
        const fileContents = await fileSystem.readFile(fileToAppendTo);
        expect(fileContents).to.be.equal(dataToAppend);
    });
    test('Test searching for files', async () => {
        const files = await fileSystem.search(path.join(__dirname, '*.js'));
        expect(files).to.be.array();
        expect(files.length).to.be.at.least(1);
        const expectedFileName = __filename.replace(/\\/g, '/');
        const fileName = files[0].replace(/\\/g, '/');
        expect(fileName).to.equal(expectedFileName);
    });
    test('Ensure creating a temporary file results in a unique temp file path', async () => {
        const tempFile = await fileSystem.createTemporaryFile('.tmp');
        const tempFile2 = await fileSystem.createTemporaryFile('.tmp');
        expect(tempFile.filePath).to.not.equal(tempFile2.filePath, 'Temp files must be unique, implementation of createTemporaryFile is off.');
    });
    test('Ensure writing to a temp file is supported via file stream', async () => {
        await fileSystem.createTemporaryFile('.tmp').then((tf: TemporaryFile) => {
            expect(tf).to.not.equal(undefined, 'Error trying to create a temporary file');
            const writeStream = fileSystem.createWriteStream(tf.filePath);
            writeStream.write('hello', 'utf8', (err: Error) => {
                expect(err).to.equal(undefined, `Failed to write to a temp file, error is ${err}`);
            });
        }, (failReason) => {
            expect(failReason).to.equal('No errors occured', `Failed to create a temporary file with error ${failReason}`);
        });
    });
    test('Ensure chmod works against a temporary file', async () => {
        await fileSystem.createTemporaryFile('.tmp').then(async (fl: TemporaryFile) => {
            await fileSystem.chmod(fl.filePath, '7777').then(
                (success: void) => {
                    // cannot check for success other than we got here, chmod in Windows won't have any effect on the file itself.
                },
                (failReason) => {
                    expect(failReason).to.equal('There was no error using chmod', `Failed to perform chmod operation successfully, got error ${failReason}`);
                });
        });
    });
});
