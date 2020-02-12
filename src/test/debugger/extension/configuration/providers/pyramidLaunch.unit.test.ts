// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any no-invalid-template-strings max-func-body-length

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
import { PyramidLaunchDebugConfigurationProvider } from '../../../../../client/debugger/extension/configuration/providers/pyramidLaunch';
import { DebugConfigurationState } from '../../../../../client/debugger/extension/types';

suite('Debugging - Configuration Provider Pyramid', () => {
    let fs: IFileSystem;
    let workspaceService: IWorkspaceService;
    let pathUtils: IPathUtils;
    let provider: TestPyramidLaunchDebugConfigurationProvider;
    let input: MultiStepInput<DebugConfigurationState>;
    class TestPyramidLaunchDebugConfigurationProvider extends PyramidLaunchDebugConfigurationProvider {
        // tslint:disable-next-line:no-unnecessary-override
        public resolveVariables(pythonPath: string, resource: Uri | undefined): string {
            return super.resolveVariables(pythonPath, resource);
        }
        // tslint:disable-next-line:no-unnecessary-override
        public async getDevelopmentIniPath(folder: WorkspaceFolder): Promise<string | undefined> {
            return super.getDevelopmentIniPath(folder);
        }
    }
    setup(() => {
        fs = mock(FileSystem);
        workspaceService = mock(WorkspaceService);
        pathUtils = mock(PathUtils);
        input = mock<MultiStepInput<DebugConfigurationState>>(MultiStepInput);
        provider = new TestPyramidLaunchDebugConfigurationProvider(
            instance(fs),
            instance(workspaceService),
            instance(pathUtils)
        );
    });
    test("getDevelopmentIniPath should return undefined if file doesn't exist", async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const managePyPath = path.join(folder.uri.fsPath, 'development.ini');
        when(fs.fileExists(managePyPath)).thenResolve(false);

        const file = await provider.getDevelopmentIniPath(folder);

        expect(file).to.be.equal(undefined, 'Should return undefined');
    });
    test('getDevelopmentIniPath should file path', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const managePyPath = path.join(folder.uri.fsPath, 'development.ini');

        when(pathUtils.separator).thenReturn('-');
        when(fs.fileExists(managePyPath)).thenResolve(true);

        const file = await provider.getDevelopmentIniPath(folder);

        // tslint:disable-next-line:no-invalid-template-strings
        expect(file).to.be.equal('${workspaceFolder}-development.ini');
    });
    test('Resolve variables (with resource)', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        when(workspaceService.getWorkspaceFolder(anything())).thenReturn(folder);

        const resolvedPath = provider.resolveVariables('${workspaceFolder}/one.py', Uri.file(''));

        expect(resolvedPath).to.be.equal(`${folder.uri.fsPath}/one.py`);
    });
    test('Validation of path should return errors if path is undefined', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };

        const error = await provider.validateIniPath(folder, '');

        expect(error).to.be.length.greaterThan(1);
    });
    test('Validation of path should return errors if path is empty', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };

        const error = await provider.validateIniPath(folder, '', '');

        expect(error).to.be.length.greaterThan(1);
    });
    test('Validation of path should return errors if resolved path is empty', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        provider.resolveVariables = () => '';

        const error = await provider.validateIniPath(folder, '', 'x');

        expect(error).to.be.length.greaterThan(1);
    });
    test("Validation of path should return errors if resolved path doesn't exist", async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        provider.resolveVariables = () => 'xyz';

        when(fs.fileExists('xyz')).thenResolve(false);
        const error = await provider.validateIniPath(folder, '', 'x');

        expect(error).to.be.length.greaterThan(1);
    });
    test('Validation of path should return errors if resolved path is non-ini', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        provider.resolveVariables = () => 'xyz.txt';

        when(fs.fileExists('xyz.txt')).thenResolve(true);
        const error = await provider.validateIniPath(folder, '', 'x');

        expect(error).to.be.length.greaterThan(1);
    });
    test('Validation of path should return errors if resolved path is ini', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        provider.resolveVariables = () => 'xyz.ini';

        when(fs.fileExists('xyz.ini')).thenResolve(true);
        const error = await provider.validateIniPath(folder, '', 'x');

        expect(error).to.be.equal(undefined, 'should not have errors');
    });
    test('Launch JSON with valid ini path', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const state = { config: {}, folder };
        provider.getDevelopmentIniPath = () => Promise.resolve('xyz.ini');
        when(pathUtils.separator).thenReturn('-');

        await provider.buildConfiguration(instance(input), state);

        const config = {
            name: DebugConfigStrings.pyramid.snippet.name(),
            type: DebuggerTypeName,
            request: 'launch',
            module: 'pyramid.scripts.pserve',
            args: ['xyz.ini'],
            pyramid: true,
            jinja: true
        };

        expect(state.config).to.be.deep.equal(config);
    });
    test('Launch JSON with selected ini path', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const state = { config: {}, folder };
        provider.getDevelopmentIniPath = () => Promise.resolve(undefined);
        when(pathUtils.separator).thenReturn('-');
        when(input.showInputBox(anything())).thenResolve('hello');

        await provider.buildConfiguration(instance(input), state);

        const config = {
            name: DebugConfigStrings.pyramid.snippet.name(),
            type: DebuggerTypeName,
            request: 'launch',
            module: 'pyramid.scripts.pserve',
            args: ['hello'],
            pyramid: true,
            jinja: true
        };

        expect(state.config).to.be.deep.equal(config);
    });
    test('Launch JSON with default ini path', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const state = { config: {}, folder };
        provider.getDevelopmentIniPath = () => Promise.resolve(undefined);
        const workspaceFolderToken = '${workspaceFolder}';
        const defaultIni = `${workspaceFolderToken}-development.ini`;

        when(pathUtils.separator).thenReturn('-');
        when(input.showInputBox(anything())).thenResolve();

        await provider.buildConfiguration(instance(input), state);

        const config = {
            name: DebugConfigStrings.pyramid.snippet.name(),
            type: DebuggerTypeName,
            request: 'launch',
            module: 'pyramid.scripts.pserve',
            args: [defaultIni],
            pyramid: true,
            jinja: true
        };

        expect(state.config).to.be.deep.equal(config);
    });
});
