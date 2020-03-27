// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import * as path from 'path';
import { anything, deepEqual, instance, mock, verify, when } from 'ts-mockito';
import { PYTHON_LANGUAGE } from '../../../../client/common/constants';
import { FileSystem } from '../../../../client/common/platform/fileSystem';
import { IFileSystem } from '../../../../client/common/platform/types';
import { PythonExecutionFactory } from '../../../../client/common/process/pythonExecutionFactory';
import { PythonExecutionService } from '../../../../client/common/process/pythonProcess';
import { IPythonExecutionService } from '../../../../client/common/process/types';
import { JupyterCommands } from '../../../../client/datascience/constants';
import { InterpreterJupyterNotebookCommand } from '../../../../client/datascience/jupyter/interpreter/jupyterCommand';
import {
    JupyterCommandFinder,
    ModuleExistsStatus,
} from '../../../../client/datascience/jupyter/interpreter/jupyterCommandFinder';
import { JupyterCommandFinderInterpreterExecutionService } from '../../../../client/datascience/jupyter/interpreter/jupyterCommandInterpreterExecutionService';
import { IJupyterCommand, IJupyterSubCommandExecutionService } from '../../../../client/datascience/types';
import { IInterpreterService } from '../../../../client/interpreter/contracts';
import { InterpreterService } from '../../../../client/interpreter/interpreterService';

suite('Data Science - Jupyter CommandInterpreterExecutionService', () => {
    let cmdFinder: JupyterCommandFinder;
    let interperterService: IInterpreterService;
    let fs: IFileSystem;
    let kernelSpecCmd: IJupyterCommand;
    let execService: IPythonExecutionService;
    let jupyterInterpreterExecutionService: IJupyterSubCommandExecutionService;

    setup(() => {
        cmdFinder = mock(JupyterCommandFinder);
        interperterService = mock(InterpreterService);
        fs = mock(FileSystem);
        kernelSpecCmd = mock(InterpreterJupyterNotebookCommand);
        const execFactory = mock(PythonExecutionFactory);
        execService = mock(PythonExecutionService);
        jupyterInterpreterExecutionService = mock(JupyterCommandFinderInterpreterExecutionService);
        when(execFactory.create(anything())).thenResolve(instance(execService));
        // tslint:disable-next-line: no-any
        (instance(execService) as any).then = undefined;
        when(cmdFinder.findBestCommand(JupyterCommands.KernelSpecCommand)).thenResolve({
            status: ModuleExistsStatus.Found,
            command: instance(kernelSpecCmd),
        });

        jupyterInterpreterExecutionService = new JupyterCommandFinderInterpreterExecutionService(
            instance(cmdFinder),
            instance(interperterService),
            instance(fs),
            instance(execFactory)
        );
    });
    test('Should not return any kernelspecs', async () => {
        when(kernelSpecCmd.exec(deepEqual(['list', '--json']), anything())).thenResolve({ stdout: '{}' });

        const specs = await jupyterInterpreterExecutionService.getKernelSpecs();

        assert.deepEqual(specs, []);
    });
    test('Should return a matching spec from a jupyter process for a given kernelspec', async () => {
        const kernelSpecs = {
            K1: {
                resource_dir: 'dir1',
                spec: {
                    argv: [],
                    display_name: 'disp1',
                    language: PYTHON_LANGUAGE,
                    metadata: { interpreter: { path: 'Some Path', envName: 'MyEnvName' } },
                },
            },
            K2: {
                resource_dir: 'dir2',
                spec: {
                    argv: [],
                    display_name: 'disp2',
                    language: PYTHON_LANGUAGE,
                    metadata: { interpreter: { path: 'Some Path2', envName: 'MyEnvName2' } },
                },
            },
        };
        when(kernelSpecCmd.exec(deepEqual(['list', '--json']), anything())).thenResolve({
            stdout: JSON.stringify({ kernelspecs: kernelSpecs }),
        });
        when(fs.fileExists(path.join('dir1', 'kernel.json'))).thenResolve(false);
        when(fs.fileExists(path.join('dir2', 'kernel.json'))).thenResolve(true);
        const specs = await jupyterInterpreterExecutionService.getKernelSpecs();

        assert.equal(specs.length, 1);
        verify(kernelSpecCmd.exec(deepEqual(['list', '--json']), anything())).once();
    });
});
