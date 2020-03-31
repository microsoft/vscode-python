// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:max-func-body-length chai-vague-errors

import { expect } from 'chai';
import * as fs from 'fs-extra';
import { TemporaryFileSystem } from '../../../client/common/platform/fs-temp';
import { TemporaryFile } from '../../../client/common/platform/types';
import { assertDoesNotExist, assertExists, FSFixture, WINDOWS } from './utils';

suite('FileSystem - TemporaryFileSystem', () => {
    let tmpfs: TemporaryFileSystem;
    let fix: FSFixture;
    setup(async () => {
        tmpfs = TemporaryFileSystem.withDefaults();
        fix = new FSFixture();
    });
    teardown(async () => {
        await fix.cleanUp();
    });

    suite('createFile', () => {
        async function createFile(suffix: string): Promise<TemporaryFile> {
            const tempfile = await tmpfs.createFile(suffix);
            fix.addFSCleanup(tempfile.filePath, tempfile.dispose);
            return tempfile;
        }

        test('TemporaryFile is created properly', async () => {
            const tempfile = await tmpfs.createFile('.tmp');
            fix.addFSCleanup(tempfile.filePath, tempfile.dispose);
            await assertExists(tempfile.filePath);

            expect(tempfile.filePath.endsWith('.tmp')).to.equal(true, `bad suffix on ${tempfile.filePath}`);
        });

        test('TemporaryFile is disposed properly', async () => {
            const tempfile = await createFile('.tmp');
            await assertExists(tempfile.filePath);

            tempfile.dispose();

            await assertDoesNotExist(tempfile.filePath);
        });

        test('Ensure creating a temporary file results in a unique temp file path', async () => {
            const tempFile = await createFile('.tmp');
            const tempFile2 = await createFile('.tmp');

            const filename1 = tempFile.filePath;
            const filename2 = tempFile2.filePath;

            expect(filename1).to.not.equal(filename2);
        });

        test('Ensure writing to a temp file is supported via file stream', async function () {
            if (WINDOWS) {
                // tslint:disable-next-line:no-invalid-this
                this.skip();
            }
            const tempfile = await createFile('.tmp');
            const stream = fs.createWriteStream(tempfile.filePath);
            fix.addCleanup(() => stream.destroy());
            const data = '...';

            stream.write(data, 'utf8');

            const actual = await fs.readFile(tempfile.filePath, 'utf8');
            expect(actual).to.equal(data);
        });

        test('Ensure chmod works against a temporary file', async () => {
            // Note that on Windows chmod is a noop.
            const tempfile = await createFile('.tmp');

            const promise = fs.chmod(tempfile.filePath, '7777');

            await expect(promise).to.not.eventually.be.rejected;
        });
    });
});
