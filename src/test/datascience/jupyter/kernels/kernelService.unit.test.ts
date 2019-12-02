// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Kernel } from '@jupyterlab/services';
import { assert } from 'chai';
import { cloneDeep } from 'lodash';
import * as path from 'path';
import * as sinon from 'sinon';
import { anything, capture, deepEqual, instance, mock, reset, verify, when } from 'ts-mockito';
import { CancellationToken } from 'vscode';
import { PYTHON_LANGUAGE } from '../../../../client/common/constants';
import { FileSystem } from '../../../../client/common/platform/fileSystem';
import { IFileSystem } from '../../../../client/common/platform/types';
import { ProcessServiceFactory } from '../../../../client/common/process/processFactory';
import { IProcessServiceFactory } from '../../../../client/common/process/types';
import { ReadWrite } from '../../../../client/common/types';
import { noop } from '../../../../client/common/utils/misc';
import { Architecture } from '../../../../client/common/utils/platform';
import { JupyterCommands } from '../../../../client/datascience/constants';
import { InterpreterJupyterNotebookCommand } from '../../../../client/datascience/jupyter/jupyterCommand';
import { JupyterCommandFinder, ModuleExistsStatus } from '../../../../client/datascience/jupyter/jupyterCommandFinder';
import { JupyterExecutionBase } from '../../../../client/datascience/jupyter/jupyterExecution';
import { JupyterSessionManager } from '../../../../client/datascience/jupyter/jupyterSessionManager';
import { JupyterKernelSpec } from '../../../../client/datascience/jupyter/kernels/jupyterKernelSpec';
import { KernelService } from '../../../../client/datascience/jupyter/kernels/kernelService';
import { IJupyterCommand, IJupyterExecution, IJupyterKernelSpec, IJupyterSessionManager } from '../../../../client/datascience/types';
import { EnvironmentActivationService } from '../../../../client/interpreter/activation/service';
import { IEnvironmentActivationService } from '../../../../client/interpreter/activation/types';
import { IInterpreterService, InterpreterType, PythonInterpreter } from '../../../../client/interpreter/contracts';
import { InterpreterService } from '../../../../client/interpreter/interpreterService';

// tslint:disable-next-line: max-func-body-length
suite('Data Science - KernelService', () => {
    let kernelService: KernelService;
    let jupyterExecution: IJupyterExecution;
    let cmdFinder: JupyterCommandFinder;
    let processServiceFactory: IProcessServiceFactory;
    let interperterService: IInterpreterService;
    let fs: IFileSystem;
    let sessionManager: IJupyterSessionManager;
    let kernelSpecCmd: IJupyterCommand;
    let kernelCreateCmd: IJupyterCommand;
    let activationHelper: IEnvironmentActivationService;

    function initialize() {
        jupyterExecution = mock(JupyterExecutionBase);
        cmdFinder = mock(JupyterCommandFinder);
        processServiceFactory = mock(ProcessServiceFactory);
        interperterService = mock(InterpreterService);
        fs = mock(FileSystem);
        sessionManager = mock(JupyterSessionManager);
        kernelSpecCmd = mock(InterpreterJupyterNotebookCommand);
        kernelCreateCmd = mock(InterpreterJupyterNotebookCommand);
        activationHelper = mock(EnvironmentActivationService);
        when(cmdFinder.findBestCommand(JupyterCommands.KernelSpecCommand)).thenResolve({ status: ModuleExistsStatus.Found, command: instance(kernelSpecCmd) });
        when(cmdFinder.findBestCommand(JupyterCommands.KernelCreateCommand, anything())).thenResolve({ status: ModuleExistsStatus.Found, command: instance(kernelCreateCmd) });

        kernelService = new KernelService(
            instance(jupyterExecution),
            instance(cmdFinder),
            { push: noop, dispose: async () => noop() },
            instance(processServiceFactory),
            instance(interperterService),
            instance(fs),
            instance(activationHelper)
        );
    }
    setup(initialize);
    teardown(() => sinon.restore());

    test('Should not return a matching spec from a session for a given kernelspec', async () => {
        const activeKernelSpecs: IJupyterKernelSpec[] = [
            { dispose: async () => noop(), language: PYTHON_LANGUAGE, name: '1', path: '', display_name: '1', metadata: {} },
            { dispose: async () => noop(), language: PYTHON_LANGUAGE, name: '2', path: '', display_name: '2', metadata: {} }
        ];
        when(sessionManager.getActiveKernelSpecs()).thenResolve(activeKernelSpecs);

        const matchingKernel = await kernelService.findMatchingKernelSpec({ name: 'A', display_name: 'A' }, instance(sessionManager));

        assert.isUndefined(matchingKernel);
        verify(sessionManager.getActiveKernelSpecs()).once();
    });
    test('Should not return a matching spec from a session for a given interpeter', async () => {
        const activeKernelSpecs: IJupyterKernelSpec[] = [
            { dispose: async () => noop(), language: PYTHON_LANGUAGE, name: '1', path: '', display_name: '1', metadata: {} },
            { dispose: async () => noop(), language: PYTHON_LANGUAGE, name: '2', path: '', display_name: '2', metadata: {} }
        ];
        when(sessionManager.getActiveKernelSpecs()).thenResolve(activeKernelSpecs);
        const interpreter: PythonInterpreter = {
            path: 'some Path',
            displayName: 'Hello World',
            envName: 'Hello',
            type: InterpreterType.Conda
            // tslint:disable-next-line: no-any
        } as any;

        const matchingKernel = await kernelService.findMatchingKernelSpec(interpreter, instance(sessionManager));

        assert.isUndefined(matchingKernel);
        verify(sessionManager.getActiveKernelSpecs()).once();
    });
    test('Should not return a matching spec from a jupyter process for a given kernelspec', async () => {
        when(kernelSpecCmd.exec(deepEqual(['list', '--json']), anything())).thenResolve({ stdout: '{}' });

        const matchingKernel = await kernelService.findMatchingKernelSpec({ name: 'A', display_name: 'A' }, undefined);

        assert.isUndefined(matchingKernel);
        verify(kernelSpecCmd.exec(deepEqual(['list', '--json']), anything())).once();
    });
    test('Should not return a matching spec from a jupyter process for a given interpreter', async () => {
        when(kernelSpecCmd.exec(deepEqual(['list', '--json']), anything())).thenResolve({ stdout: '{}' });

        const interpreter: PythonInterpreter = {
            path: 'some Path',
            displayName: 'Hello World',
            envName: 'Hello',
            type: InterpreterType.Conda
            // tslint:disable-next-line: no-any
        } as any;

        const matchingKernel = await kernelService.findMatchingKernelSpec(interpreter, undefined);

        assert.isUndefined(matchingKernel);
        verify(kernelSpecCmd.exec(deepEqual(['list', '--json']), anything())).once();
    });
    test('Should return a matching spec from a session for a given kernelspec', async () => {
        const activeKernelSpecs: IJupyterKernelSpec[] = [
            { dispose: async () => noop(), language: PYTHON_LANGUAGE, name: '1', path: 'Path1', display_name: 'Disp1', metadata: {} },
            { dispose: async () => noop(), language: PYTHON_LANGUAGE, name: '2', path: 'Path2', display_name: 'Disp2', metadata: {} }
        ];
        when(sessionManager.getActiveKernelSpecs()).thenResolve(activeKernelSpecs);

        const matchingKernel = await kernelService.findMatchingKernelSpec({ name: '2', display_name: 'Disp2' }, instance(sessionManager));

        assert.isOk(matchingKernel);
        assert.equal(matchingKernel?.display_name, 'Disp2');
        assert.equal(matchingKernel?.name, '2');
        assert.equal(matchingKernel?.path, 'Path2');
        assert.equal(matchingKernel?.language, PYTHON_LANGUAGE);
        verify(sessionManager.getActiveKernelSpecs()).once();
    });
    test('Should return a matching spec from a session for a given interpreter', async () => {
        const activeKernelSpecs: IJupyterKernelSpec[] = [
            { dispose: async () => noop(), language: PYTHON_LANGUAGE, name: '1', path: 'Path1', display_name: 'Disp1', metadata: {} },
            { dispose: async () => noop(), language: PYTHON_LANGUAGE, name: '2', path: 'Path2', display_name: 'Disp2', metadata: { interpreter: { path: 'myPath2' } } },
            { dispose: async () => noop(), language: PYTHON_LANGUAGE, name: '3', path: 'Path3', display_name: 'Disp3', metadata: { interpreter: { path: 'myPath3' } } }
        ];
        when(sessionManager.getActiveKernelSpecs()).thenResolve(activeKernelSpecs);
        when(fs.arePathsSame('myPath2', 'myPath2')).thenReturn(true);
        const interpreter: PythonInterpreter = {
            path: 'myPath2',
            sysPrefix: 'xyz',
            type: InterpreterType.Conda,
            sysVersion: '',
            architecture: Architecture.Unknown
        };

        const matchingKernel = await kernelService.findMatchingKernelSpec(interpreter, instance(sessionManager));

        assert.isOk(matchingKernel);
        assert.equal(matchingKernel?.display_name, 'Disp2');
        assert.equal(matchingKernel?.name, '2');
        assert.equal(matchingKernel?.path, 'Path2');
        assert.deepEqual(matchingKernel?.metadata, activeKernelSpecs[1].metadata);
        assert.equal(matchingKernel?.language, PYTHON_LANGUAGE);
        verify(sessionManager.getActiveKernelSpecs()).once();
    });
    test('Should return a matching spec from a jupyter process for a given kernelspec', async () => {
        const kernelSpecs = {
            K1: { resource_dir: 'dir1', spec: { display_name: 'disp1', language: PYTHON_LANGUAGE, metadata: { interpreter: { path: 'Some Path', envName: 'MyEnvName' } } } },
            K2: { resource_dir: 'dir2', spec: { display_name: 'disp2', language: PYTHON_LANGUAGE, metadata: { interpreter: { path: 'Some Path2', envName: 'MyEnvName2' } } } }
        };
        when(kernelSpecCmd.exec(deepEqual(['list', '--json']), anything())).thenResolve({ stdout: JSON.stringify(kernelSpecs) });
        when(fs.fileExists(path.join('dir2', 'kernel.json'))).thenResolve(true);
        const matchingKernel = await kernelService.findMatchingKernelSpec({ name: 'K2', display_name: 'disp2' }, undefined);

        assert.isOk(matchingKernel);
        assert.equal(matchingKernel?.display_name, 'disp2');
        assert.equal(matchingKernel?.name, 'K2');
        assert.equal(matchingKernel?.metadata?.interpreter?.path, 'Some Path2');
        assert.equal(matchingKernel?.metadata?.interpreter?.envName, 'MyEnvName2');
        assert.equal(matchingKernel?.language, PYTHON_LANGUAGE);
        verify(kernelSpecCmd.exec(deepEqual(['list', '--json']), anything())).once();
    });
    test('Should return a matching spec from a jupyter process for a given interpreter', async () => {
        const kernelSpecs = {
            K1: { resource_dir: 'dir1', spec: { display_name: 'disp1', language: PYTHON_LANGUAGE, metadata: { interpreter: { path: 'Some Path', envName: 'MyEnvName' } } } },
            K2: { resource_dir: 'dir2', spec: { display_name: 'disp2', language: PYTHON_LANGUAGE, metadata: { interpreter: { path: 'Some Path2', envName: 'MyEnvName2' } } } }
        };
        when(kernelSpecCmd.exec(deepEqual(['list', '--json']), anything())).thenResolve({ stdout: JSON.stringify(kernelSpecs) });
        when(fs.arePathsSame('Some Path2', 'Some Path2')).thenReturn(true);
        when(fs.fileExists(path.join('dir2', 'kernel.json'))).thenResolve(true);
        const interpreter: PythonInterpreter = {
            path: 'Some Path2',
            sysPrefix: 'xyz',
            type: InterpreterType.Conda,
            sysVersion: '',
            architecture: Architecture.Unknown
        };

        const matchingKernel = await kernelService.findMatchingKernelSpec(interpreter, undefined);

        assert.isOk(matchingKernel);
        assert.equal(matchingKernel?.display_name, 'disp2');
        assert.equal(matchingKernel?.name, 'K2');
        assert.equal(matchingKernel?.metadata?.interpreter?.path, 'Some Path2');
        assert.equal(matchingKernel?.metadata?.interpreter?.envName, 'MyEnvName2');
        assert.equal(matchingKernel?.language, PYTHON_LANGUAGE);
        assert.deepEqual(matchingKernel?.metadata, kernelSpecs.K2.spec.metadata);
        verify(kernelSpecCmd.exec(deepEqual(['list', '--json']), anything())).once();
    });
    // tslint:disable-next-line: max-func-body-length
    suite('Registering Interpreters as Kernels', () => {
        let findMatchingKernelSpecStub: sinon.SinonStub<
            [PythonInterpreter, IJupyterSessionManager | undefined, (CancellationToken | undefined)?],
            Promise<IJupyterKernelSpec | undefined>
        >;
        const interpreter: PythonInterpreter = {
            architecture: Architecture.Unknown,
            path: 'pyPath',
            sysPrefix: '',
            sysVersion: '',
            type: InterpreterType.Conda,
            displayName: 'Hello'
        };
        const interpreterPathHash = 'SomeHash';
        const installedKernelName = `${interpreter.displayName || ''}_${interpreterPathHash}`.replace(/[^A-Za-z0-9]/g, '');
        const kernelInstallArgs = ['install', '--user', '--name', installedKernelName, '--display-name', interpreter.displayName];
        // Marked as readonly, to ensure we do not update this in tests.
        const kernelSpecModel: Readonly<Kernel.ISpecModel> = {
            argv: ['python', '-m', 'ipykernel'],
            display_name: interpreter.displayName!,
            language: PYTHON_LANGUAGE,
            name: installedKernelName,
            resources: {},
            env: {},
            metadata: {
                something: '1'
            }
        };
        const kernelJsonFile = path.join('someFile', 'kernel.json');

        setup(() => {
            findMatchingKernelSpecStub = sinon.stub(KernelService.prototype, 'findMatchingKernelSpec');
            initialize();
            when(fs.getFileHash(interpreter.path)).thenResolve(interpreterPathHash);
        });

        test('Fail if interpreter does not have a display name', async () => {
            const invalidInterpreter: PythonInterpreter = {
                architecture: Architecture.Unknown,
                path: '',
                sysPrefix: '',
                sysVersion: '',
                type: InterpreterType.Conda
            };

            const promise = kernelService.registerKernel(invalidInterpreter);

            await assert.isRejected(promise, 'Interpreter does not have a display name');
        });
        test('Fail if kernel create command is not found', async () => {
            reset(cmdFinder);
            when(cmdFinder.findBestCommand(JupyterCommands.KernelCreateCommand, anything())).thenResolve({ status: ModuleExistsStatus.NotFound });

            const promise = kernelService.registerKernel(interpreter);
            await assert.isRejected(promise, 'Command not found to install the kernel');
        });
        test('Fail if kernel create command is found and command is not defined', async () => {
            reset(cmdFinder);
            when(cmdFinder.findBestCommand(JupyterCommands.KernelCreateCommand, anything())).thenResolve({ status: ModuleExistsStatus.Found });

            const promise = kernelService.registerKernel(interpreter);
            await assert.isRejected(promise, 'Command not found to install the kernel');
        });
        test('Fail if installed kernel cannot be found', async () => {
            when(kernelCreateCmd.exec(deepEqual(kernelInstallArgs), anything())).thenResolve({ stdout: '' });
            findMatchingKernelSpecStub.resolves(undefined);

            const promise = kernelService.registerKernel(interpreter);
            await assert.isRejected(promise, `Kernel not created with the name ${installedKernelName}, display_name ${interpreter.displayName}. Output is `);
        });
        test('Fail if installed kernel is not an instance of JupyterKernelSpec', async () => {
            when(kernelCreateCmd.exec(deepEqual(kernelInstallArgs), anything())).thenResolve({ stdout: '' });
            // tslint:disable-next-line: no-any
            findMatchingKernelSpecStub.resolves({} as any);

            const promise = kernelService.registerKernel(interpreter);
            await assert.isRejected(promise, `Kernel not registered locally, created with the name ${installedKernelName}, display_name ${interpreter.displayName}. Output is `);
        });
        test('Fail if installed kernel spec does not have a specFile setup', async () => {
            when(kernelCreateCmd.exec(deepEqual(kernelInstallArgs), anything())).thenResolve({ stdout: '' });
            // tslint:disable-next-line: no-any
            const kernel = new JupyterKernelSpec({} as any);
            findMatchingKernelSpecStub.resolves(kernel);

            const promise = kernelService.registerKernel(interpreter);
            await assert.isRejected(promise, `kernel.json not created with the name ${installedKernelName}, display_name ${interpreter.displayName}. Output is `);
        });
        test('Kernel is installed and spec file is updated with interpreter information in metadata', async () => {
            when(kernelCreateCmd.exec(deepEqual(kernelInstallArgs), anything())).thenResolve({ stdout: '' });

            const kernel = new JupyterKernelSpec(kernelSpecModel, kernelJsonFile);

            when(fs.readFile(kernelJsonFile)).thenResolve(JSON.stringify(kernelSpecModel));
            when(fs.writeFile(kernelJsonFile, anything())).thenResolve();
            when(activationHelper.getActivatedEnvironmentVariables(undefined, interpreter, true)).thenResolve(undefined);
            findMatchingKernelSpecStub.resolves(kernel);
            const expectedKernelJsonContent: ReadWrite<Kernel.ISpecModel> = cloneDeep(kernelSpecModel);
            // tslint:disable-next-line: no-any
            expectedKernelJsonContent.metadata!.interpreter = interpreter as any;

            const installedKernel = await kernelService.registerKernel(interpreter);

            assert.deepEqual(kernel, installedKernel);
            verify(fs.writeFile(kernelJsonFile, anything())).once();
            // Verify the contents of JSON written to the file match as expected.
            assert.deepEqual(JSON.parse(capture(fs.writeFile).first()[1] as string), expectedKernelJsonContent);
        });
        test('Kernel is installed and spec file is updated with interpreter information in metadata along with environment variables', async () => {
            when(kernelCreateCmd.exec(deepEqual(kernelInstallArgs), anything())).thenResolve({ stdout: '' });

            const kernel = new JupyterKernelSpec(kernelSpecModel, kernelJsonFile);

            when(fs.readFile(kernelJsonFile)).thenResolve(JSON.stringify(kernelSpecModel));
            when(fs.writeFile(kernelJsonFile, anything())).thenResolve();
            const envVariables = { MYVAR: '1' };
            when(activationHelper.getActivatedEnvironmentVariables(undefined, interpreter, true)).thenResolve(envVariables);
            findMatchingKernelSpecStub.resolves(kernel);
            const expectedKernelJsonContent: ReadWrite<Kernel.ISpecModel> = cloneDeep(kernelSpecModel);
            // tslint:disable-next-line: no-any
            expectedKernelJsonContent.metadata!.interpreter = interpreter as any;
            // tslint:disable-next-line: no-any
            expectedKernelJsonContent.env = envVariables as any;

            const installedKernel = await kernelService.registerKernel(interpreter);

            assert.deepEqual(kernel, installedKernel);
            verify(fs.writeFile(kernelJsonFile, anything())).once();
            // Verify the contents of JSON written to the file match as expected.
            assert.deepEqual(JSON.parse(capture(fs.writeFile).first()[1] as string), expectedKernelJsonContent);
        });
    });
});
