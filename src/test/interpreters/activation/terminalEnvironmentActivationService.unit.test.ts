// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert } from 'chai';
import * as path from 'path';
import { anything, capture, deepEqual, instance, mock, verify, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { EXTENSION_ROOT_DIR, terminalNamePrefixNotToAutoActivate } from '../../../client/common/constants';
import { FileSystem } from '../../../client/common/platform/fileSystem';
import { IFileSystem } from '../../../client/common/platform/types';
import { TerminalServiceFactory } from '../../../client/common/terminal/factory';
import { TerminalService } from '../../../client/common/terminal/service';
import { ITerminalService, ITerminalServiceFactory } from '../../../client/common/terminal/types';
import { Architecture } from '../../../client/common/utils/platform';
import { EnvironmentVariablesProvider } from '../../../client/common/variables/environmentVariablesProvider';
import { IEnvironmentVariablesProvider } from '../../../client/common/variables/types';
import { TerminalEnvironmentActivationService } from '../../../client/interpreter/activation/terminalEnvironmentActivationService';
import { IEnvironmentActivationService } from '../../../client/interpreter/activation/types';
import { InterpreterType, PythonInterpreter } from '../../../client/interpreter/contracts';
import { noop } from '../../core';

// tslint:disable-next-line: max-func-body-length
suite('Interpreters Activation - Python Environment Variables (using terminals)', () => {
    let envActivationService: IEnvironmentActivationService;
    let terminalFactory: ITerminalServiceFactory;
    let fs: IFileSystem;
    let envVarsProvider: IEnvironmentVariablesProvider;
    const jsonFile = path.join('hello', 'output.json');
    let terminal: ITerminalService;
    const mockInterpreter: PythonInterpreter = {
        architecture: Architecture.Unknown,
        path: '',
        sysPrefix: '',
        sysVersion: '',
        type: InterpreterType.Conda
    };
    setup(() => {
        terminalFactory = mock(TerminalServiceFactory);
        terminal = mock(TerminalService);
        fs = mock(FileSystem);
        envVarsProvider = mock(EnvironmentVariablesProvider);

        when(terminalFactory.getTerminalService(anything())).thenReturn(instance(terminal));
        when(fs.createTemporaryFile(anything())).thenResolve({ dispose: noop, filePath: jsonFile });
        when(terminal.sendCommand(anything(), anything(), anything(), anything())).thenResolve();
        envActivationService = new TerminalEnvironmentActivationService(instance(terminalFactory), instance(fs), instance(envVarsProvider));
    });

    [undefined, Uri.file('some Resource')].forEach(resource => {
        [undefined, mockInterpreter].forEach(interpreter => {
            suite(resource ? 'With a resource' : 'Without a resource', () => {
                suite(interpreter ? 'With an interpreter' : 'Without an interpreter', () => {
                    test('Should create a terminal with user defined custom env vars', async () => {
                        const customEnv = { HELLO: '1' };
                        when(envVarsProvider.getCustomEnvironmentVariables(resource)).thenResolve(customEnv);

                        await envActivationService.getActivatedEnvironmentVariables(resource, interpreter);

                        const termArgs = capture(terminalFactory.getTerminalService).first()[0];
                        assert.equal(termArgs?.env, customEnv);
                    });
                    test('Should destroy the created terminal', async () => {
                        const customEnv = { HELLO: '1' };
                        when(envVarsProvider.getCustomEnvironmentVariables(resource)).thenResolve(customEnv);

                        await envActivationService.getActivatedEnvironmentVariables(resource, interpreter);

                        verify(terminal.dispose()).once();
                    });
                    test('Should create a terminal with correct arguments', async () => {
                        when(envVarsProvider.getCustomEnvironmentVariables(resource)).thenResolve(undefined);

                        await envActivationService.getActivatedEnvironmentVariables(resource, interpreter);

                        const termArgs = capture(terminalFactory.getTerminalService).first()[0];
                        assert.isUndefined(termArgs?.env);
                        assert.equal(termArgs?.resource, resource);
                        assert.deepEqual(termArgs?.interpreter, interpreter);
                        assert.isTrue(termArgs?.hideFromUser);
                        assert.isTrue(termArgs?.title?.startsWith(terminalNamePrefixNotToAutoActivate));
                    });
                    test('Should create a terminal with correct arguments', async () => {
                        when(envVarsProvider.getCustomEnvironmentVariables(resource)).thenResolve(undefined);

                        await envActivationService.getActivatedEnvironmentVariables(resource, interpreter);

                        const termArgs = capture(terminalFactory.getTerminalService).first()[0];
                        assert.isUndefined(termArgs?.env);
                        assert.equal(termArgs?.resource, resource);
                        assert.deepEqual(termArgs?.interpreter, interpreter);
                        assert.isTrue(termArgs?.hideFromUser);
                        assert.isTrue(termArgs?.title?.startsWith(terminalNamePrefixNotToAutoActivate));
                    });
                    test('Should execute python file in terminal (that is what dumps variables into json)', async () => {
                        when(envVarsProvider.getCustomEnvironmentVariables(resource)).thenResolve(undefined);
                        const pyFile = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'printEnvVariablesToFile.py');

                        await envActivationService.getActivatedEnvironmentVariables(resource, interpreter);

                        const cmd = interpreter?.path || 'python';
                        verify(terminal.sendCommand(cmd, deepEqual([pyFile.fileToCommandArgument(), jsonFile.fileToCommandArgument()]), anything(), false)).once();
                    });
                    test('Should return activated environment variables', async () => {
                        when(envVarsProvider.getCustomEnvironmentVariables(resource)).thenResolve(undefined);
                        when(fs.readFile(jsonFile)).thenResolve(JSON.stringify({ WOW: '1' }));

                        const vars = await envActivationService.getActivatedEnvironmentVariables(resource, interpreter);

                        assert.deepEqual(vars, { WOW: '1' });
                    });
                });
            });
        });
    });
});
