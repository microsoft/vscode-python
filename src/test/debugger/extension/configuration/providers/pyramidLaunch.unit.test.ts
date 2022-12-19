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
import { resolveVariables } from '../../../../../client/debugger/extension/configuration/utils/common';
import * as pyramidLaunch from '../../../../../client/debugger/extension/configuration/providers/pyramidLaunch';
import { DebugConfigurationState } from '../../../../../client/debugger/extension/types';
import * as workspaceApis from '../../../../../client/common/vscodeApis/workspaceApis';

suite('Debugging - Configuration Provider Pyramid', () => {
    let input: MultiStepInput<DebugConfigurationState>;
    let pathExistsStub: sinon.SinonStub;
    let pathSeparatorStub: sinon.SinonStub;
    let workspaceStub: sinon.SinonStub;

    setup(() => {
        input = mock<MultiStepInput<DebugConfigurationState>>(MultiStepInput);
        pathExistsStub = sinon.stub(fs, 'pathExists');
        pathSeparatorStub = sinon.stub(path, 'sep');
        workspaceStub = sinon.stub(workspaceApis, 'getWorkspaceFolder');
    });
    teardown(() => {
        sinon.restore();
    });
    test("getDevelopmentIniPath should return undefined if file doesn't exist", async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const managePyPath = path.join(folder.uri.fsPath, 'development.ini');
        pathExistsStub.withArgs(managePyPath).resolves(false);
        const file = await pyramidLaunch.getDevelopmentIniPath(folder);

        expect(file).to.be.equal(undefined, 'Should return undefined');
    });
    test('getDevelopmentIniPath should file path', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const managePyPath = path.join(folder.uri.fsPath, 'development.ini');
        pathSeparatorStub.value('-');
        pathExistsStub.withArgs(managePyPath).resolves(true);
        const file = await pyramidLaunch.getDevelopmentIniPath(folder);

        expect(file).to.be.equal('${workspaceFolder}-development.ini');
    });
    test('Resolve variables (with resource)', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        workspaceStub.returns(folder);
        const resolvedPath = resolveVariables('${workspaceFolder}/one.py', undefined, folder);

        expect(resolvedPath).to.be.equal(`${folder.uri.fsPath}/one.py`);
    });
    test('Validation of path should return errors if path is undefined', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const error = await pyramidLaunch.validateIniPath(folder, '');

        expect(error).to.be.length.greaterThan(1);
    });
    test('Validation of path should return errors if path is empty', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const error = await pyramidLaunch.validateIniPath(folder, '', '');

        expect(error).to.be.length.greaterThan(1);
    });
    test('Validation of path should return errors if resolved path is empty', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const error = await pyramidLaunch.validateIniPath(folder, '', 'x');

        expect(error).to.be.length.greaterThan(1);
    });
    test("Validation of path should return errors if resolved path doesn't exist", async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        pathExistsStub.withArgs('xyz').resolves(false);
        const error = await pyramidLaunch.validateIniPath(folder, '', 'x');

        expect(error).to.be.length.greaterThan(1);
    });
    test('Validation of path should return errors if resolved path is non-ini', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        pathExistsStub.withArgs('xyz.txt').resolves(true);
        const error = await pyramidLaunch.validateIniPath(folder, '', 'x');

        expect(error).to.be.length.greaterThan(1);
    });
    test('Validation of path should not return errors if resolved path is ini', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        pathExistsStub.withArgs('xyz.ini').resolves(true);
        const error = await pyramidLaunch.validateIniPath(folder, '', 'xyz.ini');

        expect(error).to.be.equal(undefined, 'should not have errors');
    });
    test('Launch JSON with valid ini path', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const state = { config: {}, folder };
        pathSeparatorStub.value('-');

        await pyramidLaunch.buildPyramidLaunchConfiguration(instance(input), state);

        const config = {
            name: DebugConfigStrings.pyramid.snippet.name,
            type: DebuggerTypeName,
            request: 'launch',
            module: 'pyramid.scripts.pserve',
            args: ['${workspaceFolder}-development.ini'],
            pyramid: true,
            jinja: true,
            justMyCode: true,
        };

        expect(state.config).to.be.deep.equal(config);
    });
    test('Launch JSON with selected ini path', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const state = { config: {}, folder };
        pathSeparatorStub.value('-');
        when(input.showInputBox(anything())).thenResolve('hello');

        await pyramidLaunch.buildPyramidLaunchConfiguration(instance(input), state);

        const config = {
            name: DebugConfigStrings.pyramid.snippet.name,
            type: DebuggerTypeName,
            request: 'launch',
            module: 'pyramid.scripts.pserve',
            args: ['hello'],
            pyramid: true,
            jinja: true,
            justMyCode: true,
        };

        expect(state.config).to.be.deep.equal(config);
    });
    test('Launch JSON with default ini path', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const state = { config: {}, folder };
        const workspaceFolderToken = '${workspaceFolder}';
        const defaultIni = `${workspaceFolderToken}-development.ini`;

        pathSeparatorStub.value('-');
        when(input.showInputBox(anything())).thenResolve();

        await pyramidLaunch.buildPyramidLaunchConfiguration(instance(input), state);

        const config = {
            name: DebugConfigStrings.pyramid.snippet.name,
            type: DebuggerTypeName,
            request: 'launch',
            module: 'pyramid.scripts.pserve',
            args: [defaultIni],
            pyramid: true,
            jinja: true,
            justMyCode: true,
        };

        expect(state.config).to.be.deep.equal(config);
    });
});
