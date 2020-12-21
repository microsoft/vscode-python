// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any no-invalid-template-strings max-func-body-length

import { expect } from 'chai';
import * as path from 'path';
import { anything, instance, mock, when } from 'ts-mockito';
import { Uri, WorkspaceFolder } from 'vscode';
import { FileSystem } from '../../../../../client/common/platform/fileSystem';
import { IFileSystem } from '../../../../../client/common/platform/types';
import { DebugConfigStrings } from '../../../../../client/common/utils/localize';
import { MultiStepInput } from '../../../../../client/common/utils/multiStepInput';
import { DebuggerTypeName } from '../../../../../client/debugger/constants';
import { FlaskLaunchDebugConfigurationProvider } from '../../../../../client/debugger/extension/configuration/providers/flaskLaunch';
import { DebugConfigurationState } from '../../../../../client/debugger/extension/types';

suite('Debugging - Configuration Provider Flask', () => {
    let fs: IFileSystem;
    let provider: TestFlaskLaunchDebugConfigurationProvider;
    let input: MultiStepInput<DebugConfigurationState>;
    class TestFlaskLaunchDebugConfigurationProvider extends FlaskLaunchDebugConfigurationProvider {
        // tslint:disable-next-line:no-unnecessary-override
        public async getApplicationPath(folder: WorkspaceFolder): Promise<string | undefined> {
            return super.getApplicationPath(folder);
        }
    }
    setup(() => {
        fs = mock(FileSystem);
        input = mock<MultiStepInput<DebugConfigurationState>>(MultiStepInput);
        provider = new TestFlaskLaunchDebugConfigurationProvider(instance(fs));
    });
    test("getApplicationPath should return undefined if file doesn't exist", async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const appPyPath = path.join(folder.uri.fsPath, 'app.py');
        when(fs.fileExists(appPyPath)).thenResolve(false);

        const file = await provider.getApplicationPath(folder);

        expect(file).to.be.equal(undefined, 'Should return undefined');
    });
    test('getApplicationPath should file path', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const appPyPath = path.join(folder.uri.fsPath, 'app.py');

        when(fs.fileExists(appPyPath)).thenResolve(true);

        const file = await provider.getApplicationPath(folder);

        // tslint:disable-next-line:no-invalid-template-strings
        expect(file).to.be.equal('app.py');
    });
    test('Launch JSON with valid python path', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const state = { config: {}, folder };
        provider.getApplicationPath = () => Promise.resolve('xyz.py');

        await provider.buildConfiguration(instance(input), state);

        const config = {
            name: DebugConfigStrings.flask.snippet.name(),
            type: DebuggerTypeName,
            request: 'launch',
            module: 'flask',
            env: {
                FLASK_APP: 'xyz.py',
                FLASK_ENV: 'development',
                FLASK_DEBUG: '0',
            },
            args: ['run', '--no-debugger'],
            jinja: true,
        };

        expect(state.config).to.be.deep.equal(config);
    });
    test('Launch JSON with selected app path', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const state = { config: {}, folder };
        provider.getApplicationPath = () => Promise.resolve(undefined);

        when(input.showInputBox(anything())).thenResolve('hello');

        await provider.buildConfiguration(instance(input), state);

        const config = {
            name: DebugConfigStrings.flask.snippet.name(),
            type: DebuggerTypeName,
            request: 'launch',
            module: 'flask',
            env: {
                FLASK_APP: 'hello',
                FLASK_ENV: 'development',
                FLASK_DEBUG: '0',
            },
            args: ['run', '--no-debugger'],
            jinja: true,
        };

        expect(state.config).to.be.deep.equal(config);
    });
    test('Launch JSON with default managepy path', async () => {
        const folder = { uri: Uri.parse(path.join('one', 'two')), name: '1', index: 0 };
        const state = { config: {}, folder };
        provider.getApplicationPath = () => Promise.resolve(undefined);

        when(input.showInputBox(anything())).thenResolve();

        await provider.buildConfiguration(instance(input), state);

        const config = {
            name: DebugConfigStrings.flask.snippet.name(),
            type: DebuggerTypeName,
            request: 'launch',
            module: 'flask',
            env: {
                FLASK_APP: 'app.py',
                FLASK_ENV: 'development',
                FLASK_DEBUG: '0',
            },
            args: ['run', '--no-debugger'],
            jinja: true,
        };

        expect(state.config).to.be.deep.equal(config);
    });
});
