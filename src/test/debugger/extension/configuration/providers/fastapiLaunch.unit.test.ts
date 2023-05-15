// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as sinon from 'sinon';
import { anything, instance, mock, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { DebugConfigStrings } from '../../../../../client/common/utils/localize';
import { MultiStepInput } from '../../../../../client/common/utils/multiStepInput';
import { DebuggerTypeName } from '../../../../../client/debugger/constants';
import * as fastApiLaunch from '../../../../../client/debugger/extension/configuration/providers/fastapiLaunch';
import { DebugConfigurationState } from '../../../../../client/debugger/extension/types';

suite('Debugging - Configuration Provider FastAPI', () => {
    let input: MultiStepInput<DebugConfigurationState>;
    let pathExistsStub: sinon.SinonStub;

    setup(() => {
        input = mock<MultiStepInput<DebugConfigurationState>>(MultiStepInput);
        pathExistsStub = sinon.stub(fs, 'pathExists');
    });
    teardown(() => {
        sinon.restore();
    });
    test("getApplicationPath should return undefined if file doesn't exist", async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const appPyPath = path.join(folder.uri.fsPath, 'main.py');
        pathExistsStub.withArgs(appPyPath).resolves(false);
        const file = await fastApiLaunch.getApplicationPath(folder);

        expect(file).to.be.equal(undefined, 'Should return undefined');
    });
    test('getApplicationPath should find path', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const appPyPath = path.join(folder.uri.fsPath, 'main.py');
        pathExistsStub.withArgs(appPyPath).resolves(true);
        const file = await fastApiLaunch.getApplicationPath(folder);

        expect(file).to.be.equal('main.py');
    });
    test('Launch JSON with valid python path', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const state = { config: {}, folder };

        await fastApiLaunch.buildFastAPILaunchDebugConfiguration(instance(input), state);

        const config = {
            name: DebugConfigStrings.fastapi.snippet.name,
            type: DebuggerTypeName,
            request: 'launch',
            module: 'uvicorn',
            args: ['main:app', '--reload'],
            jinja: true,
            justMyCode: true,
        };

        expect(state.config).to.be.deep.equal(config);
    });
    test('Launch JSON with selected app path', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const state = { config: {}, folder };

        when(input.showInputBox(anything())).thenResolve('main');

        await fastApiLaunch.buildFastAPILaunchDebugConfiguration(instance(input), state);

        const config = {
            name: DebugConfigStrings.fastapi.snippet.name,
            type: DebuggerTypeName,
            request: 'launch',
            module: 'uvicorn',
            args: ['main:app', '--reload'],
            jinja: true,
            justMyCode: true,
        };

        expect(state.config).to.be.deep.equal(config);
    });
});
