// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as path from 'path';
import { anything, instance, mock, when } from 'ts-mockito';
import { Uri, WorkspaceFolder } from 'vscode';
import { IWorkspaceService } from '../../../../../client/common/application/types';
import { WorkspaceService } from '../../../../../client/common/application/workspace';
import { FileSystem } from '../../../../../client/common/platform/fileSystem';
import { PathUtils } from '../../../../../client/common/platform/pathUtils';
import { IFileSystem } from '../../../../../client/common/platform/types';
import { IPathUtils } from '../../../../../client/common/types';
import { DebugConfigStrings } from '../../../../../client/common/utils/localize';
import { MultiStepInput } from '../../../../../client/common/utils/multiStepInput';
import { DebuggerTypeName } from '../../../../../client/debugger/constants';
import { DjangoLaunchDebugConfigurationProvider } from '../../../../../client/debugger/extension/configuration/providers/djangoLaunch';
import { DebugConfigurationState } from '../../../../../client/debugger/extension/types';

suite('Debugging - Configuration Provider Django', () => {
    let fs: IFileSystem;
    let workspaceService: IWorkspaceService;
    let pathUtils: IPathUtils;
    let provider: TestDjangoLaunchDebugConfigurationProvider;
    let input: MultiStepInput<DebugConfigurationState>;
    class TestDjangoLaunchDebugConfigurationProvider extends DjangoLaunchDebugConfigurationProvider {
        public resolveVariables(pythonPath: string, resource: Uri | undefined): string {
            return super.resolveVariables(pythonPath, resource);
        }

        public async getManagePyPath(folder: WorkspaceFolder): Promise<string | undefined> {
            return super.getManagePyPath(folder);
        }
    }
    setup(() => {
        fs = mock(FileSystem);
        workspaceService = mock(WorkspaceService);
        pathUtils = mock(PathUtils);
        input = mock<MultiStepInput<DebugConfigurationState>>(MultiStepInput);
        provider = new TestDjangoLaunchDebugConfigurationProvider(
            instance(fs),
            instance(workspaceService),
            instance(pathUtils),
        );
    });
    test("getManagePyPath should return undefined if file doesn't exist", async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const managePyPath = path.join(folder.uri.fsPath, 'manage.py');
        when(fs.fileExists(managePyPath)).thenResolve(false);

        const file = await provider.getManagePyPath(folder);

        expect(file).to.be.equal(undefined, 'Should return undefined');
    });
    test('getManagePyPath should file path', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const managePyPath = path.join(folder.uri.fsPath, 'manage.py');

        when(pathUtils.separator).thenReturn('-');
        when(fs.fileExists(managePyPath)).thenResolve(true);

        const file = await provider.getManagePyPath(folder);

        expect(file).to.be.equal('${workspaceFolder}-manage.py');
    });
    test('Resolve variables (with resource)', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        when(workspaceService.getWorkspaceFolder(anything())).thenReturn(folder);

        const resolvedPath = provider.resolveVariables('${workspaceFolder}/one.py', Uri.file(''));

        expect(resolvedPath).to.be.equal(`${folder.uri.fsPath}/one.py`);
    });
    test('Validation of path should return errors if path is undefined', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };

        const error = await provider.validateManagePy(folder, '');

        expect(error).to.be.length.greaterThan(1);
    });
    test('Validation of path should return errors if path is empty', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };

        const error = await provider.validateManagePy(folder, '', '');

        expect(error).to.be.length.greaterThan(1);
    });
    test('Validation of path should return errors if resolved path is empty', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        provider.resolveVariables = () => '';

        const error = await provider.validateManagePy(folder, '', 'x');

        expect(error).to.be.length.greaterThan(1);
    });
    test("Validation of path should return errors if resolved path doesn't exist", async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        provider.resolveVariables = () => 'xyz';

        when(fs.fileExists('xyz')).thenResolve(false);
        const error = await provider.validateManagePy(folder, '', 'x');

        expect(error).to.be.length.greaterThan(1);
    });
    test('Validation of path should return errors if resolved path is non-python', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        provider.resolveVariables = () => 'xyz.txt';

        when(fs.fileExists('xyz.txt')).thenResolve(true);
        const error = await provider.validateManagePy(folder, '', 'x');

        expect(error).to.be.length.greaterThan(1);
    });
    test('Validation of path should return errors if resolved path is python', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        provider.resolveVariables = () => 'xyz.py';

        when(fs.fileExists('xyz.py')).thenResolve(true);
        const error = await provider.validateManagePy(folder, '', 'x');

        expect(error).to.be.equal(undefined, 'should not have errors');
    });
    test('Launch JSON with valid python path', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const state = { config: {}, folder };
        provider.getManagePyPath = () => Promise.resolve('xyz.py');
        when(pathUtils.separator).thenReturn('-');

        await provider.buildConfiguration(instance(input), state);

        const config = {
            name: DebugConfigStrings.django.snippet.name(),
            type: DebuggerTypeName,
            request: 'launch',
            program: 'xyz.py',
            args: ['runserver'],
            django: true,
        };

        expect(state.config).to.be.deep.equal(config);
    });
    test('Launch JSON with selected managepy path', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const state = { config: {}, folder };
        provider.getManagePyPath = () => Promise.resolve(undefined);
        when(pathUtils.separator).thenReturn('-');
        when(input.showInputBox(anything())).thenResolve('hello');

        await provider.buildConfiguration(instance(input), state);

        const config = {
            name: DebugConfigStrings.django.snippet.name(),
            type: DebuggerTypeName,
            request: 'launch',
            program: 'hello',
            args: ['runserver'],
            django: true,
        };

        expect(state.config).to.be.deep.equal(config);
    });
    test('Launch JSON with default managepy path', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const state = { config: {}, folder };
        provider.getManagePyPath = () => Promise.resolve(undefined);
        const workspaceFolderToken = '${workspaceFolder}';
        const defaultProgram = `${workspaceFolderToken}-manage.py`;

        when(pathUtils.separator).thenReturn('-');
        when(input.showInputBox(anything())).thenResolve();

        await provider.buildConfiguration(instance(input), state);

        const config = {
            name: DebugConfigStrings.django.snippet.name(),
            type: DebuggerTypeName,
            request: 'launch',
            program: defaultProgram,
            args: ['runserver'],
            django: true,
        };

        expect(state.config).to.be.deep.equal(config);
    });
});
