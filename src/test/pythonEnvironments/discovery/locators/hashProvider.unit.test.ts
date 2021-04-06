// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';
import * as fsapi from 'fs-extra';
import * as hashApi from '../../../../client/common/platform/fileSystem';
import { getInterpreterHash } from '../../../../client/pythonEnvironments/discovery/locators/services/hashProvider';

use(chaiAsPromised);

suite('Interpreters - Interpreter Hash Provider', () => {
    let fsLStatStub: sinon.SinonStub;
    let hashStub: sinon.SinonStub;
    setup(() => {
        fsLStatStub = sinon.stub(fsapi, 'lstat');
        hashStub = sinon.stub(hashApi, 'getHashString');
        hashStub.resolves('hash');
    });
    teardown(() => {
        fsLStatStub.restore();
        hashStub.restore();
    });
    test('Get hash from fs', async () => {
        const pythonPath = 'some/python.exe';
        const now = Date.now();
        fsLStatStub.withArgs(pythonPath).resolves({
            ctime: now,
            mtime: now,
        });
        const hash = await getInterpreterHash(pythonPath);

        expect(hash).to.equal('hash');
        expect(fsLStatStub.calledOnceWith(pythonPath)).to.equal(true);
    });
    test('Get hash from fs for windows store python', async () => {
        const pythonPath = 'winstore/python.exe';
        const now = Date.now();
        fsLStatStub.withArgs(pythonPath).throws({ code: 'UNKNOWN' });
        fsLStatStub.withArgs('winstore').resolves({
            ctime: now,
            mtime: now,
        });
        const hash = await getInterpreterHash(pythonPath);

        expect(hash).to.equal('hash');
        expect(fsLStatStub.calledTwice).to.equal(true);
    });
    test('Exception from getInterpreterHash will be bubbled up', async () => {
        const pythonPath = 'winstore/python.exe';
        fsLStatStub.withArgs(pythonPath).rejects({ code: 'UNKNOWN' });
        fsLStatStub.withArgs('winstore').rejects(new Error('Kaboom'));
        const promise = getInterpreterHash(pythonPath);

        await expect(promise).to.eventually.be.rejectedWith('Kaboom');
    });
});
