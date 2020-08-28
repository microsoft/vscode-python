// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-classes-per-file max-func-body-length

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import {
    instance, mock, verify, when,
} from 'ts-mockito';
import { FileSystem } from '../../../../client/common/platform/fileSystem';
import { IFileSystem } from '../../../../client/common/platform/types';
import { InterpreterHashProvider } from '../../../../client/pythonEnvironments/discovery/locators/services/hashProvider';

use(chaiAsPromised);

suite('Interpreters - Interpreter Hash Provider', () => {
    let hashProvider: InterpreterHashProvider;
    let fs: IFileSystem;
    setup(() => {
        fs = mock(FileSystem);
        hashProvider = new InterpreterHashProvider(instance(fs));
    });
    test('Get hash from fs', async () => {
        const pythonPath = 'WindowsInterpreterPath';
        when(fs.getFileHash(pythonPath)).thenResolve('hash');

        const hash = await hashProvider.getInterpreterHash(pythonPath);

        expect(hash).to.equal('hash');
        verify(fs.getFileHash(pythonPath)).once();
    });
    test('Exceptios from fs.getFilehash will be bubbled up', async () => {
        const pythonPath = 'WindowsInterpreterPath';
        when(fs.getFileHash(pythonPath)).thenReject(new Error('Kaboom'));

        const promise = hashProvider.getInterpreterHash(pythonPath);

        verify(fs.getFileHash(pythonPath)).once();
        await expect(promise).to.eventually.be.rejectedWith('Kaboom');
    });
});
