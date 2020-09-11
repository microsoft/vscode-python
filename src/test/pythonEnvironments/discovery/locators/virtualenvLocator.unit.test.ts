// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as fsapi from 'fs-extra';
import * as path from 'path';
import * as sinon from 'sinon';
import { isVirtualenvEnvironment } from '../../../../client/pythonEnvironments/discovery/locators/services/virtualenvLocator';

suite('Virtualenv Locator Tests', () => {
    const envRoot = path.join('path', 'to', 'env');
    const interpreter = path.join(envRoot, 'python');
    let readDirStub: sinon.SinonStub;

    setup(() => {
        readDirStub = sinon.stub(fsapi, 'readdir');
    });

    teardown(() => {
        readDirStub.restore();
    });

    test('Interpreter folder contains an activate file', async () => {
        readDirStub.callsFake(() => Promise.resolve(['activate', 'python']));

        assert.ok(await isVirtualenvEnvironment(interpreter));
    });

    test('Interpreter folder does not contain any activate.* files', async () => {
        readDirStub.callsFake(() => Promise.resolve(['mymodule', 'python']));

        assert.strictEqual(await isVirtualenvEnvironment(interpreter), false);
    });
});
