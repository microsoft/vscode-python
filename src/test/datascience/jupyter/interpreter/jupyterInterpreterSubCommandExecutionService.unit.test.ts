// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert, expect, use } from 'chai';
import * as chaiPromise from 'chai-as-promised';
import { Subject } from 'rxjs/Subject';
import { anything, capture, deepEqual, instance, mock, verify, when } from 'ts-mockito';
import { ProductNames } from '../../../../client/common/installer/productNames';
import { FileSystem } from '../../../../client/common/platform/fileSystem';
import { PathUtils } from '../../../../client/common/platform/pathUtils';
import { IFileSystem } from '../../../../client/common/platform/types';
import { PythonExecutionFactory } from '../../../../client/common/process/pythonExecutionFactory';
import { PythonExecutionService } from '../../../../client/common/process/pythonProcess';
import { IPythonExecutionService, ObservableExecutionResult, Output } from '../../../../client/common/process/types';
import { Product } from '../../../../client/common/types';
import { DataScience } from '../../../../client/common/utils/localize';
import { noop } from '../../../../client/common/utils/misc';
import { PythonDaemonModule } from '../../../../client/datascience/constants';
import { JupyterInterpreterDependencyService } from '../../../../client/datascience/jupyter/interpreter/jupyterInterpreterDependencyService';
import { JupyterInterpreterService } from '../../../../client/datascience/jupyter/interpreter/jupyterInterpreterService';
import { JupyterInterpreterSubCommandExecutionService } from '../../../../client/datascience/jupyter/interpreter/jupyterInterpreterSubCommandExecutionService';
import { IInterpreterService } from '../../../../client/interpreter/contracts';
import { InterpreterService } from '../../../../client/interpreter/interpreterService';
import { MockOutputChannel } from '../../../mockClasses';
import { createPythonInterpreter } from '../../../utils/interpreters';
use(chaiPromise);

// tslint:disable-next-line: max-func-body-length
suite('xData Science - Jupyter InterpreterSubCommandExecutionService', () => {
    let jupyterInterpreter: JupyterInterpreterService;
    let interperterService: IInterpreterService;
    let jupyterDependencyService: JupyterInterpreterDependencyService;
    let fs: IFileSystem;
    let execService: IPythonExecutionService;
    let jupyterInterpreterExecutionService: JupyterInterpreterSubCommandExecutionService;
    const selectedJupyterInterpreter = createPythonInterpreter({ displayName: 'JupyterInterpreter' });
    const activePythonInterpreter = createPythonInterpreter({ displayName: 'activePythonInterpreter' });
    let notebookStartResult: ObservableExecutionResult<string>;
    setup(() => {
        interperterService = mock(InterpreterService);
        jupyterInterpreter = mock(JupyterInterpreterService);
        jupyterDependencyService = mock(JupyterInterpreterDependencyService);
        fs = mock(FileSystem);
        const execFactory = mock(PythonExecutionFactory);
        execService = mock(PythonExecutionService);
        when(execFactory.createDaemon(deepEqual({ daemonModule: PythonDaemonModule, pythonPath: selectedJupyterInterpreter.path }))).thenResolve(instance(execService));
        when(execFactory.createActivatedEnvironment(anything())).thenResolve(instance(execService));
        // tslint:disable-next-line: no-any
        (instance(execService) as any).then = undefined;
        const output = new MockOutputChannel('');
        const pathUtils = mock(PathUtils);
        notebookStartResult = {
            dispose: noop,
            proc: undefined,
            out: new Subject<Output<string>>().asObservable()
        };
        jupyterInterpreterExecutionService = new JupyterInterpreterSubCommandExecutionService(
            instance(jupyterInterpreter),
            instance(interperterService),
            instance(jupyterDependencyService),
            instance(fs),
            instance(execFactory),
            output,
            instance(pathUtils)
        );

        // tslint:disable-next-line: no-any
        when(execService.execModuleObservable('jupyter', anything(), anything())).thenResolve(notebookStartResult as any);
        when(interperterService.getActiveInterpreter()).thenResolve(activePythonInterpreter);
        when(interperterService.getActiveInterpreter(undefined)).thenResolve(activePythonInterpreter);
    });
    suite('Interpreter is not selected', () => {
        setup(() => {
            when(jupyterInterpreter.getSelectedInterpreter()).thenResolve(undefined);
            when(jupyterInterpreter.getSelectedInterpreter(anything())).thenResolve(undefined);
        });
        test('Returns selected interpreter', async () => {
            const interpreter = await jupyterInterpreterExecutionService.getSelectedInterpreter(undefined);
            assert.isUndefined(interpreter);
        });
        test('Notebook is not supported', async () => {
            const isSupported = await jupyterInterpreterExecutionService.isNotebookSupported(undefined);
            assert.isFalse(isSupported);
        });
        test('Export is not supported', async () => {
            const isSupported = await jupyterInterpreterExecutionService.isExportSupported(undefined);
            assert.isFalse(isSupported);
        });
        test('Install missing dependencies into active interpreter', async () => {
            await jupyterInterpreterExecutionService.installMissingDependencies(undefined);
            verify(jupyterDependencyService.installMissingDependencies(activePythonInterpreter, undefined)).once();
        });
        test('Display picker if no interpreters are seleced', async () => {
            when(interperterService.getActiveInterpreter(undefined)).thenResolve(undefined);
            await jupyterInterpreterExecutionService.installMissingDependencies(undefined);
            verify(jupyterInterpreter.selectInterpreter()).once();
        });
        test('Jupyter cannot be started because no interpreter has been selected', async () => {
            when(interperterService.getActiveInterpreter(undefined)).thenResolve(undefined);
            const reason = await jupyterInterpreterExecutionService.getReasonForJupyterNotebookNotBeingSupported(undefined);
            assert.equal(reason, DataScience.selectJupyterInterpreter());
        });
        test('Jupyter cannot be started because jupyter is not installed', async () => {
            const expectedReason = DataScience.libraryRequiredToLaunchJupyterNotInstalled().format(ProductNames.get(Product.jupyter)!);
            when(jupyterDependencyService.getDependenciesNotInstalled(activePythonInterpreter, undefined)).thenResolve([Product.jupyter]);
            const reason = await jupyterInterpreterExecutionService.getReasonForJupyterNotebookNotBeingSupported(undefined);
            assert.equal(reason, expectedReason);
        });
        test('Jupyter cannot be started because notebook is not installed', async () => {
            const expectedReason = DataScience.libraryRequiredToLaunchJupyterNotInstalled().format(ProductNames.get(Product.notebook)!);
            when(jupyterDependencyService.getDependenciesNotInstalled(activePythonInterpreter, undefined)).thenResolve([Product.notebook]);
            const reason = await jupyterInterpreterExecutionService.getReasonForJupyterNotebookNotBeingSupported(undefined);
            assert.equal(reason, expectedReason);
        });
        test('Cannot start notebook', async () => {
            const promise = jupyterInterpreterExecutionService.startNotebook([], {});

            await expect(promise).to.eventually.be.rejectedWith(DataScience.selectJupyterInterpreter());
        });
        test('Cannot launch notebook file in jupyter notebook', async () => {
            const promise = jupyterInterpreterExecutionService.launchNotebook('some.ipynb');

            await expect(promise).to.eventually.be.rejectedWith(DataScience.selectJupyterInterpreter());
        });
        test('Cannot export notebook to python', async () => {
            const promise = jupyterInterpreterExecutionService.exportNotebookToPython('somefile.ipynb');

            await expect(promise).to.eventually.be.rejectedWith(DataScience.selectJupyterInterpreter());
        });
    });
    suite('Interpreter is selected', () => {
        setup(() => {
            when(jupyterInterpreter.getSelectedInterpreter()).thenResolve(selectedJupyterInterpreter);
            when(jupyterInterpreter.getSelectedInterpreter(anything())).thenResolve(selectedJupyterInterpreter);
        });
        test('Returns selected interpreter', async () => {
            const interpreter = await jupyterInterpreterExecutionService.getSelectedInterpreter(undefined);

            assert.deepEqual(interpreter, selectedJupyterInterpreter);
        });
        test('If ds dependencies are not installed, then notebook is not supported', async () => {
            when(jupyterDependencyService.areDependenciesInstalled(selectedJupyterInterpreter, anything())).thenResolve(false);

            const isSupported = await jupyterInterpreterExecutionService.isNotebookSupported(undefined);

            assert.isFalse(isSupported);
        });
        test('If ds dependencies are installed, then notebook is supported', async () => {
            when(jupyterInterpreter.getSelectedInterpreter(anything())).thenResolve(selectedJupyterInterpreter);
            when(jupyterDependencyService.areDependenciesInstalled(selectedJupyterInterpreter, anything())).thenResolve(true);

            const isSupported = await jupyterInterpreterExecutionService.isNotebookSupported(undefined);

            assert.isOk(isSupported);
        });
        test('Install missing dependencies into jupyter interpreter', async () => {
            await jupyterInterpreterExecutionService.installMissingDependencies(undefined);

            verify(jupyterDependencyService.installMissingDependencies(selectedJupyterInterpreter, undefined)).once();
        });
        test('Jupyter cannot be started because jupyter is not installed', async () => {
            const expectedReason = DataScience.libraryRequiredToLaunchJupyterNotInstalled().format(ProductNames.get(Product.jupyter)!);
            when(jupyterDependencyService.getDependenciesNotInstalled(selectedJupyterInterpreter, undefined)).thenResolve([Product.jupyter]);

            const reason = await jupyterInterpreterExecutionService.getReasonForJupyterNotebookNotBeingSupported(undefined);

            assert.equal(reason, expectedReason);
        });
        test('Jupyter cannot be started because notebook is not installed', async () => {
            const expectedReason = DataScience.libraryRequiredToLaunchJupyterNotInstalled().format(ProductNames.get(Product.notebook)!);
            when(jupyterDependencyService.getDependenciesNotInstalled(selectedJupyterInterpreter, undefined)).thenResolve([Product.notebook]);

            const reason = await jupyterInterpreterExecutionService.getReasonForJupyterNotebookNotBeingSupported(undefined);

            assert.equal(reason, expectedReason);
        });
        test('Jupyter cannot be started because kernelspec is not available', async () => {
            when(jupyterDependencyService.getDependenciesNotInstalled(selectedJupyterInterpreter, undefined)).thenResolve([Product.kernelspec]);

            const reason = await jupyterInterpreterExecutionService.getReasonForJupyterNotebookNotBeingSupported(undefined);

            assert.equal(reason, DataScience.jupyterKernelSpecModuleNotFound());
        });
        test('Can start jupyer notebook', async () => {
            const output = await jupyterInterpreterExecutionService.startNotebook([], {});

            assert.isOk(output === notebookStartResult);
            const moduleName = capture(execService.execModuleObservable).first()[0];
            const args = capture(execService.execModuleObservable).first()[1];
            assert.equal(moduleName, 'jupyter');
            assert.equal(args[0], 'notebook');
        });
        test('Can launch notebook file in jupyter notebook', async () => {
            const file = 'somefile.ipynb';
            when(execService.execModule('jupyter', anything(), anything())).thenResolve();

            await jupyterInterpreterExecutionService.launchNotebook(file);

            verify(execService.execModule('jupyter', deepEqual(['notebook', `--NotebookApp.file_to_run=${file}`]), anything())).once();
        });
        test('Cannot export notebook to python if module is not installed', async () => {
            const file = 'somefile.ipynb';
            when(jupyterDependencyService.isExportSupported(selectedJupyterInterpreter, anything())).thenResolve(false);

            const promise = jupyterInterpreterExecutionService.exportNotebookToPython(file);

            await expect(promise).to.eventually.be.rejectedWith(DataScience.jupyterNbConvertNotSupported());
        });
        test('Export notebook to python', async () => {
            const file = 'somefile.ipynb';
            const convertOutput = 'converted';
            when(jupyterDependencyService.isExportSupported(selectedJupyterInterpreter, anything())).thenResolve(true);
            when(execService.execModule('jupyter', deepEqual(['nbconvert', file, '--to', 'python', '--stdout']), anything())).thenResolve({ stdout: convertOutput });

            const output = await jupyterInterpreterExecutionService.exportNotebookToPython(file);

            assert.equal(output, convertOutput);
        });
    });
    // test('Should return a matching spec from a jupyter process for a given kernelspec', async () => {
    //     const kernelSpecs = {
    //         K1: {
    //             resource_dir: 'dir1',
    //             spec: { argv: [], display_name: 'disp1', language: PYTHON_LANGUAGE, metadata: { interpreter: { path: 'Some Path', envName: 'MyEnvName' } } }
    //         },
    //         K2: {
    //             resource_dir: 'dir2',
    //             spec: { argv: [], display_name: 'disp2', language: PYTHON_LANGUAGE, metadata: { interpreter: { path: 'Some Path2', envName: 'MyEnvName2' } } }
    //         }
    //     };
    //     when(kernelSpecCmd.exec(deepEqual(['list', '--json']), anything())).thenResolve({ stdout: JSON.stringify({ kernelspecs: kernelSpecs }) });
    //     when(fs.fileExists(path.join('dir1', 'kernel.json'))).thenResolve(false);
    //     when(fs.fileExists(path.join('dir2', 'kernel.json'))).thenResolve(true);
    //     const specs = await jupyterInterpreterExecutionService.getKernelSpecs();

    //     assert.equal(specs.length, 1);
    //     verify(kernelSpecCmd.exec(deepEqual(['list', '--json']), anything())).once();
    // });
});
