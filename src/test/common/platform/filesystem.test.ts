// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:max-func-body-length chai-vague-errors
// tslint:disable:no-suspicious-comment

import { expect } from 'chai';
import * as fsextra from 'fs-extra';
import * as vscode from 'vscode';
import {
    FileSystem
} from '../../../client/common/platform/fileSystem';
import { PlatformService } from '../../../client/common/platform/platformService';
import {
    IFileSystem
} from '../../../client/common/platform/types';
import {
    assertDoesNotExist, DOES_NOT_EXIST, FSFixture, SUPPORTS_SYMLINKS
} from './utils';

// Note: all functional tests that do not trigger the VS Code "fs" API
// are found in filesystem.functional.test.ts.

import FileType = vscode.FileType;
type FileStat = vscode.FileStat;

suite('FileSystem', () => {
    let filesystem: IFileSystem;
    let fix: FSFixture;
    setup(async () => {
        filesystem = new FileSystem(
            new PlatformService()
        );
        fix = new FSFixture();

        await assertDoesNotExist(DOES_NOT_EXIST);
    });
    teardown(async () => {
        await fix.cleanUp();
    });

    suite('stat', () => {
        function convertStat(old: fsextra.Stats, filetype: FileType): FileStat {
            return {
                type: filetype,
                size: old.size,
                // TODO (https://github.com/microsoft/vscode/issues/84177)
                //   FileStat.ctime and FileStat.mtime only have 1-second resolution.
                //   So for now we round to the nearest integer.
                // TODO (https://github.com/microsoft/vscode/issues/84177)
                //   FileStat.ctime is consistently 0 instead of the actual ctime.
                ctime: 0,
                //ctime: Math.round(old.ctimeMs),
                mtime: Math.round(old.mtimeMs)
            };
        }

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

        test('fails if the file does not exist', async () => {
            const promise = filesystem.stat(DOES_NOT_EXIST);

            await expect(promise).to.eventually.be.rejected;
        });
    });
});
