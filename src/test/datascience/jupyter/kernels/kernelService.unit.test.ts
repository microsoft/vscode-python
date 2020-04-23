// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Kernel } from '@jupyterlab/services';
import { assert } from 'chai';
import { cloneDeep } from 'lodash';
import * as path from 'path';
import * as sinon from 'sinon';
import { anything, capture, instance, mock, verify, when } from 'ts-mockito';
import { CancellationToken } from 'vscode';
import { PYTHON_LANGUAGE } from '../../../../client/common/constants';
import { ProductInstaller } from '../../../../client/common/installer/productInstaller';
import { FileSystem } from '../../../../client/common/platform/fileSystem';
import { IFileSystem } from '../../../../client/common/platform/types';
import { PythonExecutionFactory } from '../../../../client/common/process/pythonExecutionFactory';
import { IPythonExecutionFactory, IPythonExecutionService } from '../../../../client/common/process/types';
import { IInstaller, InstallerResponse, Product, ReadWrite } from '../../../../client/common/types';
import { Architecture } from '../../../../client/common/utils/platform';
import { JupyterSessionManager } from '../../../../client/datascience/jupyter/jupyterSessionManager';
import { JupyterKernelSpec } from '../../../../client/datascience/jupyter/kernels/jupyterKernelSpec';
import { KernelService } from '../../../../client/datascience/jupyter/kernels/kernelService';
import {
    IJupyterKernelSpec,
    IJupyterSessionManager,
    IJupyterSubCommandExecutionService
} from '../../../../client/datascience/types';
import { EnvironmentActivationService } from '../../../../client/interpreter/activation/service';
import { IEnvironmentActivationService } from '../../../../client/interpreter/activation/types';
import { IInterpreterService, InterpreterType, PythonInterpreter } from '../../../../client/interpreter/contracts';
import { InterpreterService } from '../../../../client/interpreter/interpreterService';
import { FakeClock } from '../../../common';

// tslint:disable-next-line: max-func-body-length
suite('Data Science - KernelService', () => {
    let kernelService: KernelService;
    let interperterService: IInterpreterService;
    let fs: IFileSystem;
    let sessionManager: IJupyterSessionManager;
    let execFactory: IPythonExecutionFactory;
    let execService: IPythonExecutionService;
    let activationHelper: IEnvironmentActivationService;
    let installer: IInstaller;
    let jupyterInterpreterExecutionService: IJupyterSubCommandExecutionService;

    function initialize() {
        interperterService = mock(InterpreterService);
        fs = mock(FileSystem);
        sessionManager = mock(JupyterSessionManager);
        activationHelper = mock(EnvironmentActivationService);
        execFactory = mock(PythonExecutionFactory);
        execService = mock<IPythonExecutionService>();
        installer = mock(ProductInstaller);
        jupyterInterpreterExecutionService = mock<IJupyterSubCommandExecutionService>();
        when(execFactory.createActivatedEnvironment(anything())).thenResolve(instance(execService));
        // tslint:disable-next-line: no-any
        (instance(execService) as any).then = undefined;

        kernelService = new KernelService(
            instance(jupyterInterpreterExecutionService),
            instance(execFactory),
            instance(interperterService),
            instance(installer),
            instance(fs),
            instance(activationHelper)
        );
    }
    setup(initialize);
    teardown(() => sinon.restore());

    test('Should not return a matching spec from a session for a given kernelspec', async () => {
        const activeKernelSpecs: IJupyterKernelSpec[] = [
            {
                argv: [],
                language: PYTHON_LANGUAGE,
                name: '1',
                path: '',
                display_name: '1',
                metadata: {},
                env: undefined
            },
            {
                argv: [],
                language: PYTHON_LANGUAGE,
                name: '2',
                path: '',
                display_name: '2',
                metadata: {},
                env: undefined
            }
        ];
        when(sessionManager.getKernelSpecs()).thenResolve(activeKernelSpecs);

        const matchingKernel = await kernelService.findMatchingKernelSpec(
            { name: 'A', display_name: 'A' },
            instance(sessionManager)
        );

        assert.isUndefined(matchingKernel);
        verify(sessionManager.getKernelSpecs()).once();
    });
    test('Should not return a matching spec from a session for a given interpeter', async () => {
        const activeKernelSpecs: IJupyterKernelSpec[] = [
            {
                argv: [],
                language: PYTHON_LANGUAGE,
                name: '1',
                path: '',
                display_name: '1',
                metadata: {},
                env: undefined
            },
            {
                argv: [],
                language: PYTHON_LANGUAGE,
                name: '2',
                path: '',
                display_name: '2',
                metadata: {},
                env: undefined
            }
        ];
        when(sessionManager.getKernelSpecs()).thenResolve(activeKernelSpecs);
        const interpreter: PythonInterpreter = {
            path: 'some Path',
            displayName: 'Hello World',
            envName: 'Hello',
            type: InterpreterType.Conda
            // tslint:disable-next-line: no-any
        } as any;

        const matchingKernel = await kernelService.findMatchingKernelSpec(interpreter, instance(sessionManager));

        assert.isUndefined(matchingKernel);
        verify(sessionManager.getKernelSpecs()).once();
    });
    test('Should not return a matching spec from a jupyter process for a given kernelspec', async () => {
        when(jupyterInterpreterExecutionService.getKernelSpecs(anything())).thenResolve([]);

        const matchingKernel = await kernelService.findMatchingKernelSpec({ name: 'A', display_name: 'A' }, undefined);

        assert.isUndefined(matchingKernel);
    });
    test('Should not return a matching spec from a jupyter process for a given interpreter', async () => {
        when(jupyterInterpreterExecutionService.getKernelSpecs(anything())).thenResolve([]);

        const interpreter: PythonInterpreter = {
            path: 'some Path',
            displayName: 'Hello World',
            envName: 'Hello',
            type: InterpreterType.Conda
            // tslint:disable-next-line: no-any
        } as any;

        const matchingKernel = await kernelService.findMatchingKernelSpec(interpreter, undefined);

        assert.isUndefined(matchingKernel);
    });
    test('Should return a matching spec from a session for a given kernelspec', async () => {
        const activeKernelSpecs: IJupyterKernelSpec[] = [
            {
                argv: [],
                language: PYTHON_LANGUAGE,
                name: '1',
                path: 'Path1',
                display_name: 'Disp1',
                metadata: {},
                env: undefined
            },
            {
                argv: [],
                language: PYTHON_LANGUAGE,
                name: '2',
                path: 'Path2',
                display_name: 'Disp2',
                metadata: {},
                env: undefined
            }
        ];
        when(sessionManager.getKernelSpecs()).thenResolve(activeKernelSpecs);

        const matchingKernel = await kernelService.findMatchingKernelSpec(
            { name: '2', display_name: 'Disp2' },
            instance(sessionManager)
        );

        assert.isOk(matchingKernel);
        assert.equal(matchingKernel?.display_name, 'Disp2');
        assert.equal(matchingKernel?.name, '2');
        assert.equal(matchingKernel?.path, 'Path2');
        assert.equal(matchingKernel?.language, PYTHON_LANGUAGE);
        verify(sessionManager.getKernelSpecs()).once();
    });
    test('Should return a matching spec from a session for a given interpreter', async () => {
        const activeKernelSpecs: IJupyterKernelSpec[] = [
            {
                argv: [],
                language: PYTHON_LANGUAGE,
                name: '1',
                path: 'Path1',
                display_name: 'Disp1',
                metadata: {},
                env: undefined
            },
            {
                argv: [],
                language: PYTHON_LANGUAGE,
                name: '2',
                path: 'Path2',
                display_name: 'Disp2',
                metadata: { interpreter: { path: 'myPath2' } },
                env: undefined
            },
            {
                argv: [],
                language: PYTHON_LANGUAGE,
                name: '3',
                path: 'Path3',
                display_name: 'Disp3',
                metadata: { interpreter: { path: 'myPath3' } },
                env: undefined
            }
        ];
        when(sessionManager.getKernelSpecs()).thenResolve(activeKernelSpecs);
        when(fs.arePathsSame('myPath2', 'myPath2')).thenReturn(true);
        const interpreter: PythonInterpreter = {
            displayName: 'Disp2',
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
        verify(sessionManager.getKernelSpecs()).once();
    });
    test('Should return a matching spec from a jupyter process for a given kernelspec', async () => {
        const kernelSpecs = [
            new JupyterKernelSpec(
                {
                    name: 'K1',
                    argv: [],
                    display_name: 'disp1',
                    language: PYTHON_LANGUAGE,
                    resources: {},
                    metadata: { interpreter: { path: 'Some Path', envName: 'MyEnvName' } }
                },
                path.join('dir1', 'kernel.json')
            ),
            new JupyterKernelSpec(
                {
                    name: 'K2',
                    argv: [],
                    display_name: 'disp2',
                    language: PYTHON_LANGUAGE,
                    resources: {},
                    metadata: { interpreter: { path: 'Some Path2', envName: 'MyEnvName2' } }
                },
                path.join('dir2', 'kernel.json')
            )
        ];
        when(jupyterInterpreterExecutionService.getKernelSpecs(anything())).thenResolve(kernelSpecs);
        const matchingKernel = await kernelService.findMatchingKernelSpec(
            { name: 'K2', display_name: 'disp2' },
            undefined
        );

        assert.isOk(matchingKernel);
        assert.equal(matchingKernel?.display_name, 'disp2');
        assert.equal(matchingKernel?.name, 'K2');
        assert.equal(matchingKernel?.metadata?.interpreter?.path, 'Some Path2');
        assert.equal(matchingKernel?.metadata?.interpreter?.envName, 'MyEnvName2');
        assert.equal(matchingKernel?.language, PYTHON_LANGUAGE);
    });
    test('Should return a matching spec from a jupyter process for a given interpreter', async () => {
        const kernelSpecs = [
            new JupyterKernelSpec(
                {
                    name: 'K1',
                    argv: [],
                    display_name: 'disp1',
                    language: PYTHON_LANGUAGE,
                    resources: {},
                    metadata: { interpreter: { path: 'Some Path', envName: 'MyEnvName' } }
                },
                path.join('dir1', 'kernel.json')
            ),
            new JupyterKernelSpec(
                {
                    name: 'K2',
                    argv: [],
                    display_name: 'disp2',
                    language: PYTHON_LANGUAGE,
                    resources: {},
                    metadata: { interpreter: { path: 'Some Path2', envName: 'MyEnvName2' } }
                },
                path.join('dir2', 'kernel.json')
            )
        ];
        when(jupyterInterpreterExecutionService.getKernelSpecs(anything())).thenResolve(kernelSpecs);
        when(fs.arePathsSame('Some Path2', 'Some Path2')).thenReturn(true);
        when(fs.fileExists(path.join('dir2', 'kernel.json'))).thenResolve(true);
        const interpreter: PythonInterpreter = {
            displayName: 'disp2',
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
        assert.deepEqual(matchingKernel?.metadata, kernelSpecs[1].metadata);
    });
    // tslint:disable-next-line: max-func-body-length
    suite('Registering Interpreters as Kernels', () => {
        let findMatchingKernelSpecStub: sinon.SinonStub<
            [PythonInterpreter, IJupyterSessionManager?, (CancellationToken | undefined)?],
            Promise<IJupyterKernelSpec | undefined>
        >;
        let fakeTimer: FakeClock;
        const interpreter: PythonInterpreter = {
            architecture: Architecture.Unknown,
            path: path.join('interpreter', 'python'),
            sysPrefix: '',
            sysVersion: '',
            type: InterpreterType.Conda,
            displayName: 'Hello'
        };
        // Marked as readonly, to ensure we do not update this in tests.
        const kernelSpecModel: Readonly<Kernel.ISpecModel> = {
            argv: ['python', '-m', 'ipykernel'],
            display_name: interpreter.displayName!,
            language: PYTHON_LANGUAGE,
            name: 'somme name',
            resources: {},
            env: {},
            metadata: {
                something: '1',
                interpreter: {
                    path: interpreter.path,
                    type: interpreter.type
                }
            }
        };
        const userKernelSpecModel: Readonly<Kernel.ISpecModel> = {
            argv: ['python', '-m', 'ipykernel'],
            display_name: interpreter.displayName!,
            language: PYTHON_LANGUAGE,
            name: 'somme name',
            resources: {},
            env: {},
            metadata: {
                something: '1'
            }
        };
        const kernelJsonFile = path.join('someFile', 'kernel.json');

        setup(() => {
            findMatchingKernelSpecStub = sinon.stub(KernelService.prototype, 'findMatchingKernelSpec');
            fakeTimer = new FakeClock();
            initialize();
        });

        teardown(() => fakeTimer.uninstall());

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
        test('Fail if installed kernel cannot be found', async () => {
            when(execService.execModule('ipykernel', anything(), anything())).thenResolve({ stdout: '' });
            when(installer.isInstalled(Product.ipykernel, interpreter)).thenResolve(true);
            findMatchingKernelSpecStub.resolves(undefined);
            fakeTimer.install();

            const promise = kernelService.registerKernel(interpreter);

            await fakeTimer.wait();
            await assert.isRejected(promise);
            verify(execService.execModule('ipykernel', anything(), anything())).once();
            const installArgs = capture(execService.execModule).first()[1] as string[];
            const kernelName = installArgs[3];
            assert.deepEqual(installArgs, [
                'install',
                '--user',
                '--name',
                kernelName,
                '--display-name',
                interpreter.displayName
            ]);
            await assert.isRejected(
                promise,
                `Kernel not created with the name ${kernelName}, display_name ${interpreter.displayName}. Output is `
            );
        });
        test('If ipykernel is not installed, then prompt to install ipykernel', async () => {
            when(execService.execModule('ipykernel', anything(), anything())).thenResolve({ stdout: '' });
            when(installer.isInstalled(Product.ipykernel, interpreter)).thenResolve(false);
            when(installer.promptToInstall(anything(), anything(), anything())).thenResolve(
                InstallerResponse.Installed
            );
            findMatchingKernelSpecStub.resolves(undefined);
            fakeTimer.install();

            const promise = kernelService.registerKernel(interpreter);

            await fakeTimer.wait();
            await assert.isRejected(promise);
            verify(execService.execModule('ipykernel', anything(), anything())).once();
            const installArgs = capture(execService.execModule).first()[1] as string[];
            const kernelName = installArgs[3];
            assert.deepEqual(installArgs, [
                'install',
                '--user',
                '--name',
                kernelName,
                '--display-name',
                interpreter.displayName
            ]);
            await assert.isRejected(
                promise,
                `Kernel not created with the name ${kernelName}, display_name ${interpreter.displayName}. Output is `
            );
            verify(installer.promptToInstall(anything(), anything(), anything())).once();
        });
        test('If ipykernel is not installed, and ipykerne installation is canclled, then do not reigster kernel', async () => {
            when(execService.execModule('ipykernel', anything(), anything())).thenResolve({ stdout: '' });
            when(installer.isInstalled(Product.ipykernel, interpreter)).thenResolve(false);
            when(installer.promptToInstall(anything(), anything(), anything())).thenResolve(InstallerResponse.Ignore);
            findMatchingKernelSpecStub.resolves(undefined);

            const kernel = await kernelService.registerKernel(interpreter);

            assert.isUndefined(kernel);
            verify(execService.execModule('ipykernel', anything(), anything())).never();
            verify(installer.promptToInstall(anything(), anything(), anything())).once();
        });
        test('Fail if installed kernel is not an instance of JupyterKernelSpec', async () => {
            when(execService.execModule('ipykernel', anything(), anything())).thenResolve({ stdout: '' });
            when(installer.isInstalled(Product.ipykernel, interpreter)).thenResolve(true);
            // tslint:disable-next-line: no-any
            findMatchingKernelSpecStub.resolves({} as any);

            const promise = kernelService.registerKernel(interpreter);

            await assert.isRejected(promise);
            verify(execService.execModule('ipykernel', anything(), anything())).once();
            const installArgs = capture(execService.execModule).first()[1] as string[];
            const kernelName = installArgs[3];
            await assert.isRejected(
                promise,
                `Kernel not registered locally, created with the name ${kernelName}, display_name ${interpreter.displayName}. Output is `
            );
        });
        test('Fail if installed kernel spec does not have a specFile setup', async () => {
            when(execService.execModule('ipykernel', anything(), anything())).thenResolve({ stdout: '' });
            when(installer.isInstalled(Product.ipykernel, interpreter)).thenResolve(true);
            // tslint:disable-next-line: no-any
            const kernel = new JupyterKernelSpec({} as any);
            findMatchingKernelSpecStub.resolves(kernel);

            const promise = kernelService.registerKernel(interpreter);

            await assert.isRejected(promise);
            verify(execService.execModule('ipykernel', anything(), anything())).once();
            const installArgs = capture(execService.execModule).first()[1] as string[];
            const kernelName = installArgs[3];
            await assert.isRejected(
                promise,
                `kernel.json not created with the name ${kernelName}, display_name ${interpreter.displayName}. Output is `
            );
        });
        test('Kernel is installed and spec file is updated with interpreter information in metadata and interpreter path in argv', async () => {
            when(execService.execModule('ipykernel', anything(), anything())).thenResolve({ stdout: '' });
            when(installer.isInstalled(Product.ipykernel, interpreter)).thenResolve(true);
            const kernel = new JupyterKernelSpec(kernelSpecModel, kernelJsonFile);
            when(fs.readFile(kernelJsonFile)).thenResolve(JSON.stringify(kernelSpecModel));
            when(fs.writeFile(kernelJsonFile, anything())).thenResolve();
            when(activationHelper.getActivatedEnvironmentVariables(undefined, interpreter, true)).thenResolve(
                undefined
            );
            findMatchingKernelSpecStub.resolves(kernel);
            const expectedKernelJsonContent: ReadWrite<Kernel.ISpecModel> = cloneDeep(kernelSpecModel);
            // Fully qualified path must be injected into `argv`.
            expectedKernelJsonContent.argv = [interpreter.path, '-m', 'ipykernel'];
            // tslint:disable-next-line: no-any
            expectedKernelJsonContent.metadata!.interpreter = interpreter as any;

            const installedKernel = await kernelService.registerKernel(interpreter);

            // tslint:disable-next-line: no-any
            assert.deepEqual(kernel, installedKernel as any);
            verify(fs.writeFile(kernelJsonFile, anything(), anything())).once();
            // Verify the contents of JSON written to the file match as expected.
            assert.deepEqual(JSON.parse(capture(fs.writeFile).first()[1] as string), expectedKernelJsonContent);
        });
        test('Kernel is installed and spec file is updated with interpreter information in metadata along with environment variables', async () => {
            when(execService.execModule('ipykernel', anything(), anything())).thenResolve({ stdout: '' });
            when(installer.isInstalled(Product.ipykernel, interpreter)).thenResolve(true);
            const kernel = new JupyterKernelSpec(kernelSpecModel, kernelJsonFile);
            when(fs.readFile(kernelJsonFile)).thenResolve(JSON.stringify(kernelSpecModel));
            when(fs.writeFile(kernelJsonFile, anything())).thenResolve();
            const envVariables = { MYVAR: '1' };
            when(activationHelper.getActivatedEnvironmentVariables(undefined, interpreter, true)).thenResolve(
                envVariables
            );
            findMatchingKernelSpecStub.resolves(kernel);
            const expectedKernelJsonContent: ReadWrite<Kernel.ISpecModel> = cloneDeep(kernelSpecModel);
            // Fully qualified path must be injected into `argv`.
            expectedKernelJsonContent.argv = [interpreter.path, '-m', 'ipykernel'];
            // tslint:disable-next-line: no-any
            expectedKernelJsonContent.metadata!.interpreter = interpreter as any;
            // tslint:disable-next-line: no-any
            expectedKernelJsonContent.env = envVariables as any;

            const installedKernel = await kernelService.registerKernel(interpreter);

            // tslint:disable-next-line: no-any
            assert.deepEqual(kernel, installedKernel as any);
            verify(fs.writeFile(kernelJsonFile, anything(), anything())).once();
            // Verify the contents of JSON written to the file match as expected.
            assert.deepEqual(JSON.parse(capture(fs.writeFile).first()[1] as string), expectedKernelJsonContent);
        });
        test('Kernel is found and spec file is updated with interpreter information in metadata along with environment variables', async () => {
            when(execService.execModule('ipykernel', anything(), anything())).thenResolve({ stdout: '' });
            when(installer.isInstalled(Product.ipykernel, interpreter)).thenResolve(true);
            const kernel = new JupyterKernelSpec(kernelSpecModel, kernelJsonFile);
            when(jupyterInterpreterExecutionService.getKernelSpecs(anything())).thenResolve([kernel]);
            when(fs.readFile(kernelJsonFile)).thenResolve(JSON.stringify(kernelSpecModel));
            when(fs.writeFile(kernelJsonFile, anything())).thenResolve();
            const envVariables = { MYVAR: '1' };
            when(activationHelper.getActivatedEnvironmentVariables(undefined, interpreter, true)).thenResolve(
                envVariables
            );
            findMatchingKernelSpecStub.resolves(kernel);
            const expectedKernelJsonContent: ReadWrite<Kernel.ISpecModel> = cloneDeep(kernelSpecModel);
            // Fully qualified path must be injected into `argv`.
            expectedKernelJsonContent.argv = [interpreter.path, '-m', 'ipykernel'];
            // tslint:disable-next-line: no-any
            expectedKernelJsonContent.metadata!.interpreter = interpreter as any;
            // tslint:disable-next-line: no-any
            expectedKernelJsonContent.env = envVariables as any;

            const installedKernel = await kernelService.searchAndRegisterKernel(interpreter, true);

            // tslint:disable-next-line: no-any
            assert.deepEqual(kernel, installedKernel as any);
            verify(fs.writeFile(kernelJsonFile, anything(), anything())).once();
            // Verify the contents of JSON written to the file match as expected.
            assert.deepEqual(JSON.parse(capture(fs.writeFile).first()[1] as string), expectedKernelJsonContent);
        });
        test('Kernel is found and spec file is not updated with interpreter information when user spec file', async () => {
            when(execService.execModule('ipykernel', anything(), anything())).thenResolve({ stdout: '' });
            when(installer.isInstalled(Product.ipykernel, interpreter)).thenResolve(true);
            const kernel = new JupyterKernelSpec(userKernelSpecModel, kernelJsonFile);
            when(jupyterInterpreterExecutionService.getKernelSpecs(anything())).thenResolve([kernel]);
            when(fs.readFile(kernelJsonFile)).thenResolve(JSON.stringify(userKernelSpecModel));
            when(fs.writeFile(kernelJsonFile, anything())).thenResolve();
            const envVariables = { MYVAR: '1' };
            when(activationHelper.getActivatedEnvironmentVariables(undefined, interpreter, true)).thenResolve(
                envVariables
            );
            findMatchingKernelSpecStub.resolves(kernel);

            const installedKernel = await kernelService.searchAndRegisterKernel(interpreter, true);

            // tslint:disable-next-line: no-any
            assert.deepEqual(kernel, installedKernel as any);
            verify(fs.writeFile(anything(), anything(), anything())).never();
        });
    });
});
