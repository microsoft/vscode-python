// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Uri } from 'vscode';
import { expect } from 'chai';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as sinon from 'sinon';
import { anything, instance, mock, when } from 'ts-mockito';
import { DebugConfigStrings } from '../../../../../client/common/utils/localize';
import { MultiStepInput } from '../../../../../client/common/utils/multiStepInput';
import { DebuggerTypeName } from '../../../../../client/debugger/constants';
import { DebugConfigurationState } from '../../../../../client/debugger/extension/types';
import { resolveVariables } from '../../../../../client/debugger/extension/configuration/utils/common';
import * as djangoLaunch from '../../../../../client/debugger/extension/configuration/providers/djangoLaunch';
import * as workspaceApis from '../../../../../client/common/vscodeApis/workspaceApis';

suite('Debugging - Configuration Provider Django', () => {
    let pathExistsStub: sinon.SinonStub;
    let pathSeparatorStub: sinon.SinonStub;
    let workspaceStub: sinon.SinonStub;
    let input: MultiStepInput<DebugConfigurationState>;

    setup(() => {
        input = mock<MultiStepInput<DebugConfigurationState>>(MultiStepInput);
        pathExistsStub = sinon.stub(fs, 'pathExists');
        pathSeparatorStub = sinon.stub(path, 'sep');
        workspaceStub = sinon.stub(workspaceApis, 'getWorkspaceFolder');
    });
    teardown(() => {
        sinon.restore();
    });
    test("getManagePyPath should return undefined if file doesn't exist", async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const managePyPath = path.join(folder.uri.fsPath, 'manage.py');
        pathExistsStub.withArgs(managePyPath).resolves(false);
        const file = await djangoLaunch.getManagePyPath(folder);

        expect(file).to.be.equal(undefined, 'Should return undefined');
    });
    test('getManagePyPath should file path', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const managePyPath = path.join(folder.uri.fsPath, 'manage.py');
        pathExistsStub.withArgs(managePyPath).resolves(true);
        pathSeparatorStub.value('-');
        const file = await djangoLaunch.getManagePyPath(folder);

        expect(file).to.be.equal('${workspaceFolder}-manage.py');
    });
    test('Resolve variables (with resource)', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        workspaceStub.returns(folder);
        const resolvedPath = resolveVariables('${workspaceFolder}/one.py', undefined, folder);

        expect(resolvedPath).to.be.equal(`${folder.uri.fsPath}/one.py`);
    });
    test('Validation of path should return errors if path is undefined', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const error = await djangoLaunch.validateManagePy(folder, '');

        expect(error).to.be.length.greaterThan(1);
    });
    test('Validation of path should return errors if path is empty', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const error = await djangoLaunch.validateManagePy(folder, '', '');

        expect(error).to.be.length.greaterThan(1);
    });
    test('Validation of path should return errors if resolved path is empty', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const error = await djangoLaunch.validateManagePy(folder, '', 'x');

        expect(error).to.be.length.greaterThan(1);
    });
    test("Validation of path should return errors if resolved path doesn't exist", async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        pathExistsStub.withArgs('xyz').resolves(false);
        const error = await djangoLaunch.validateManagePy(folder, '', 'x');

        expect(error).to.be.length.greaterThan(1);
    });
    test('Validation of path should return errors if resolved path is non-python', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        pathExistsStub.withArgs('xyz.txt').resolves(true);
        const error = await djangoLaunch.validateManagePy(folder, '', 'x');

        expect(error).to.be.length.greaterThan(1);
    });
    test('Validation of path should return errors if resolved path is python', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        pathExistsStub.withArgs('xyz.py').resolves(true);
        const error = await djangoLaunch.validateManagePy(folder, '', 'xyz.py');

        expect(error).to.be.equal(undefined, 'should not have errors');
    });
    test('Launch JSON with selected managepy path', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const state = { config: {}, folder };
        pathSeparatorStub.value('-');
        when(input.showInputBox(anything())).thenResolve('hello');
        await djangoLaunch.buildDjangoLaunchDebugConfiguration(instance(input), state);

        const config = {
            name: DebugConfigStrings.django.snippet.name,
            type: DebuggerTypeName,
            request: 'launch',
            program: 'hello',
            args: ['runserver'],
            django: true,
            justMyCode: true,
        };

        expect(state.config).to.be.deep.equal(config);
    });
    test('Launch JSON with default managepy path', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const state = { config: {}, folder };
        const workspaceFolderToken = '${workspaceFolder}';
        const defaultProgram = `${workspaceFolderToken}-manage.py`;
        pathSeparatorStub.value('-');
        when(input.showInputBox(anything())).thenResolve();
        await djangoLaunch.buildDjangoLaunchDebugConfiguration(instance(input), state);

        const config = {
            name: DebugConfigStrings.django.snippet.name,
            type: DebuggerTypeName,
            request: 'launch',
            program: defaultProgram,
            args: ['runserver'],
            django: true,
            justMyCode: true,
        };

        expect(state.config).to.be.deep.equal(config);
    });
});
