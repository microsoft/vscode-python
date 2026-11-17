// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as sinon from 'sinon';
import { Extension } from 'vscode';
import * as extensionsApi from '../../client/common/vscodeApis/extensionsApi';
import { ENVS_EXTENSION_ID, getPythonToolsApi } from '../../client/envExt/api.internal';
import { PythonToolsApi } from '../../client/envExt/pythonToolsApi';

suite('Private Python tools API compatibility', () => {
    let provider: PythonToolsApi;
    let extension: { isActive: boolean; exports: unknown; activate: sinon.SinonStub };
    let getExtension: sinon.SinonStub;

    setup(() => {
        provider = {
            version: 1,
            configureEnvironment: sinon.stub().throws(new Error('Must not configure during feature detection')),
            getEnvironment: sinon.stub().throws(new Error('Must not query during feature detection')),
            installPackages: sinon.stub().throws(new Error('Must not install during feature detection')),
        };
        extension = {
            isActive: true,
            exports: { __pythonTools: provider },
            activate: sinon.stub().resolves(),
        };
        getExtension = sinon
            .stub(extensionsApi, 'getExtension')
            .withArgs(ENVS_EXTENSION_ID)
            .returns((extension as unknown) as Extension<unknown>);
    });

    teardown(() => sinon.restore());

    test('accepts the version-1 flat provider without requiring public API events', async () => {
        expect(await getPythonToolsApi()).to.equal(provider);
        sinon.assert.notCalled(extension.activate);
    });

    test('activates before reading exports', async () => {
        extension.isActive = false;
        extension.exports = undefined;
        extension.activate.callsFake(async () => {
            extension.isActive = true;
            extension.exports = { __pythonTools: provider };
        });

        expect(await getPythonToolsApi()).to.equal(provider);
        sinon.assert.calledOnce(extension.activate);
    });

    test('returns unavailable for a missing or disabled extension', async () => {
        getExtension.returns(undefined);

        expect(await getPythonToolsApi()).to.equal(undefined);
        sinon.assert.notCalled(extension.activate);
    });

    for (const exports of [undefined, null, false, {}, { environments: { __pythonTools: {} } }]) {
        test(`returns unavailable for missing flat exports: ${JSON.stringify(exports)}`, async () => {
            extension.exports = exports;

            expect(await getPythonToolsApi()).to.equal(undefined);
        });
    }

    for (const version of [undefined, 0, 2, '1']) {
        test(`rejects incompatible version ${String(version)}`, async () => {
            extension.exports = { __pythonTools: { ...provider, version } };

            expect(await getPythonToolsApi()).to.equal(undefined);
        });
    }

    for (const member of ['configureEnvironment', 'getEnvironment', 'installPackages']) {
        test(`rejects a missing ${member} method`, async () => {
            extension.exports = { __pythonTools: { ...provider, [member]: undefined } };

            expect(await getPythonToolsApi()).to.equal(undefined);
        });
        test(`rejects a non-callable ${member} method`, async () => {
            extension.exports = { __pythonTools: { ...provider, [member]: true } };

            expect(await getPythonToolsApi()).to.equal(undefined);
        });
    }

    for (const value of [undefined, null, true, 'version-1']) {
        test(`rejects a non-object provider: ${String(value)}`, async () => {
            extension.exports = { __pythonTools: value };

            expect(await getPythonToolsApi()).to.equal(undefined);
        });
    }
});
