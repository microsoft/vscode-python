// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { assert, expect } from 'chai';
import * as path from 'path';
import { anything, instance, mock, when } from 'ts-mockito';
import * as typemoq from 'typemoq';

import { Uri } from 'vscode';
import { IWorkspaceService } from '../../client/common/application/types';
import { IPlatformService } from '../../client/common/platform/types';
import { PythonExecutionFactory } from '../../client/common/process/pythonExecutionFactory';
import { IExtensionContext, IPathUtils, Resource } from '../../client/common/types';
import { Architecture } from '../../client/common/utils/platform';
import { IEnvironmentVariablesProvider } from '../../client/common/variables/types';
import { JupyterKernelSpec } from '../../client/datascience/jupyter/kernels/jupyterKernelSpec';
import { KernelFinder } from '../../client/datascience/kernel-launcher/kernelFinder';
import { IKernelFinder } from '../../client/datascience/kernel-launcher/types';
import { IDataScienceFileSystem, IJupyterKernelSpec } from '../../client/datascience/types';
import { IInterpreterLocatorService, IInterpreterService } from '../../client/interpreter/contracts';
import { EnvironmentType, PythonEnvironment } from '../../client/pythonEnvironments/info';

suite('Kernel Finder', () => {
    let interpreterService: typemoq.IMock<IInterpreterService>;
    let interpreterLocator: typemoq.IMock<IInterpreterLocatorService>;
    let fileSystem: typemoq.IMock<IDataScienceFileSystem>;
    let platformService: typemoq.IMock<IPlatformService>;
    let pathUtils: typemoq.IMock<IPathUtils>;
    let context: typemoq.IMock<IExtensionContext>;
    let envVarsProvider: typemoq.IMock<IEnvironmentVariablesProvider>;
    let workspaceService: IWorkspaceService;
    let kernelFinder: IKernelFinder;
    let activeInterpreter: PythonEnvironment;
    let interpreters: PythonEnvironment[] = [];
    let resource: Resource;
    const kernelName = 'testKernel';
    const testKernelMetadata = { name: 'testKernel', display_name: 'Test Display Name' };
    const cacheFile = 'kernelSpecPathCache.json';
    const kernel: JupyterKernelSpec = {
        name: 'testKernel',
        language: 'python',
        path: '<python path>',
        display_name: 'Python 3',
        metadata: {},
        env: {},
        argv: ['<python path>', '-m', 'ipykernel_launcher', '-f', '{connection_file}'],
        specFile: path.join('1', 'share', 'jupyter', 'kernels', kernelName, 'kernel.json')
    };
    // Change this to your actual JUPYTER_PATH value and see it appearing on the paths in the kernelFinder
    let JupyterPathEnvVar = '';

    function setupFileSystem() {
        fileSystem
            .setup((fs) => fs.writeLocalFile(typemoq.It.isAnyString(), typemoq.It.isAnyString()))
            .returns(() => Promise.resolve());
        // fileSystem.setup((fs) => fs.getSubDirectories(typemoq.It.isAnyString())).returns(() => Promise.resolve(['']));
        fileSystem
            .setup((fs) => fs.searchLocal(typemoq.It.isAnyString(), typemoq.It.isAnyString(), typemoq.It.isAny()))
            .returns(() =>
                Promise.resolve([
                    path.join(kernel.name, 'kernel.json'),
                    path.join('kernelA', 'kernel.json'),
                    path.join('kernelB', 'kernel.json')
                ])
            );
    }

    function setupFindFileSystem() {
        fileSystem
            .setup((fs) => fs.writeLocalFile(typemoq.It.isAnyString(), typemoq.It.isAnyString()))
            .returns(() => Promise.resolve());
        // fileSystem.setup((fs) => fs.getSubDirectories(typemoq.It.isAnyString())).returns(() => Promise.resolve(['']));
    }

    setup(() => {
        pathUtils = typemoq.Mock.ofType<IPathUtils>();
        pathUtils.setup((pu) => pu.home).returns(() => './');

        context = typemoq.Mock.ofType<IExtensionContext>();
        context.setup((c) => c.globalStoragePath).returns(() => './');
        fileSystem = typemoq.Mock.ofType<IDataScienceFileSystem>();

        platformService = typemoq.Mock.ofType<IPlatformService>();
        platformService.setup((ps) => ps.isWindows).returns(() => true);
        platformService.setup((ps) => ps.isMac).returns(() => true);

        envVarsProvider = typemoq.Mock.ofType<IEnvironmentVariablesProvider>();
        envVarsProvider
            .setup((e) => e.getEnvironmentVariables(typemoq.It.isAny()))
            .returns(() => Promise.resolve({ JUPYTER_PATH: JupyterPathEnvVar }));
    });

    suite('listKernelSpecs', () => {
        let activeKernelA: IJupyterKernelSpec;
        let activeKernelB: IJupyterKernelSpec;
        let interpreter0Kernel: IJupyterKernelSpec;
        let interpreter1Kernel: IJupyterKernelSpec;
        let globalKernel: IJupyterKernelSpec;
        let jupyterPathKernelA: IJupyterKernelSpec;
        let jupyterPathKernelB: IJupyterKernelSpec;
        let loadError = false;
        setup(() => {
            JupyterPathEnvVar = `Users/testuser/jupyterPathDirA${path.delimiter}Users/testuser/jupyterPathDirB`;

            activeInterpreter = {
                path: context.object.globalStoragePath,
                displayName: 'activeInterpreter',
                sysPrefix: 'active',
                envName: '1',
                sysVersion: '3.1.1.1',
                architecture: Architecture.x64,
                envType: EnvironmentType.Unknown
            };
            interpreters = [];
            for (let i = 0; i < 2; i += 1) {
                interpreters.push({
                    path: `${context.object.globalStoragePath}_${i}`,
                    sysPrefix: `Interpreter${i}`,
                    envName: '1',
                    sysVersion: '3.1.1.1',
                    architecture: Architecture.x64,
                    envType: EnvironmentType.Unknown
                });
            }

            // Our defaultresource
            resource = Uri.file('abc');

            // Set our active interpreter
            interpreterService = typemoq.Mock.ofType<IInterpreterService>();
            interpreterService
                .setup((is) => is.getActiveInterpreter(typemoq.It.isAny()))
                .returns(() => Promise.resolve(activeInterpreter));

            // Set our workspace interpreters
            interpreterLocator = typemoq.Mock.ofType<IInterpreterLocatorService>();
            interpreterLocator
                .setup((il) => il.getInterpreters(typemoq.It.isAny(), typemoq.It.isAny()))
                .returns(() => Promise.resolve(interpreters));

            activeKernelA = {
                name: 'activeKernelA',
                language: 'python',
                path: '<python path>',
                display_name: 'Python 3',
                metadata: {},
                env: {},
                argv: ['<python path>', '-m', 'ipykernel_launcher', '-f', '{connection_file}']
            };

            activeKernelB = {
                name: 'activeKernelB',
                language: 'python',
                path: '<python path>',
                display_name: 'Python 3',
                metadata: {},
                env: {},
                argv: ['<python path>', '-m', 'ipykernel_launcher', '-f', '{connection_file}']
            };

            interpreter0Kernel = {
                name: 'interpreter0Kernel',
                language: 'python',
                path: '<python path>',
                display_name: 'Python 3',
                metadata: {},
                env: {},
                argv: ['<python path>', '-m', 'ipykernel_launcher', '-f', '{connection_file}']
            };

            interpreter1Kernel = {
                name: 'interpreter1Kernel',
                language: 'python',
                path: '<python path>',
                display_name: 'Python 3',
                metadata: {},
                env: {},
                argv: ['<python path>', '-m', 'ipykernel_launcher', '-f', '{connection_file}']
            };

            globalKernel = {
                name: 'globalKernel',
                language: 'python',
                path: '<python path>',
                display_name: 'Python 3',
                metadata: {},
                env: {},
                argv: ['<python path>', '-m', 'ipykernel_launcher', '-f', '{connection_file}']
            };

            jupyterPathKernelA = {
                name: 'jupyterPathKernelA',
                language: 'python',
                path: '<python path>',
                display_name: 'Python 3',
                metadata: {},
                env: {},
                argv: ['<python path>', '-m', 'ipykernel_launcher', '-f', '{connection_file}']
            };

            jupyterPathKernelB = {
                name: 'jupyterPathKernelB',
                language: 'python',
                path: '<python path>',
                display_name: 'Python 3',
                metadata: {},
                env: {},
                argv: ['<python path>', '-m', 'ipykernel_launcher', '-f', '{connection_file}']
            };

            platformService.reset();
            platformService.setup((ps) => ps.isWindows).returns(() => false);
            platformService.setup((ps) => ps.isMac).returns(() => true);

            workspaceService = mock<IWorkspaceService>();
            when(workspaceService.getWorkspaceFolderIdentifier(anything(), resource.fsPath)).thenReturn(
                resource.fsPath
            );

            // Setup file system
            const activePath = path.join('active', 'share', 'jupyter', 'kernels');
            const activePathA = path.join(activePath, activeKernelA.name, 'kernel.json');
            const activePathB = path.join(activePath, activeKernelB.name, 'kernel.json');
            fileSystem
                .setup((fs) => fs.writeLocalFile(typemoq.It.isAnyString(), typemoq.It.isAnyString()))
                .returns(() => Promise.resolve());
            // fileSystem
            //     .setup((fs) => fs.getSubDirectories(typemoq.It.isAnyString()))
            //     .returns(() => Promise.resolve(['']));
            fileSystem
                .setup((fs) => fs.searchLocal(typemoq.It.isAnyString(), activePath, typemoq.It.isAny()))
                .returns(() =>
                    Promise.resolve([
                        path.join(activeKernelA.name, 'kernel.json'),
                        path.join(activeKernelB.name, 'kernel.json')
                    ])
                );
            const interpreter0Path = path.join('Interpreter0', 'share', 'jupyter', 'kernels');
            const interpreter0FullPath = path.join(interpreter0Path, interpreter0Kernel.name, 'kernel.json');
            const interpreter1Path = path.join('Interpreter1', 'share', 'jupyter', 'kernels');
            const interpreter1FullPath = path.join(interpreter1Path, interpreter1Kernel.name, 'kernel.json');
            fileSystem
                .setup((fs) => fs.searchLocal(typemoq.It.isAnyString(), interpreter0Path, typemoq.It.isAny()))
                .returns(() => Promise.resolve([path.join(interpreter0Kernel.name, 'kernel.json')]));
            fileSystem
                .setup((fs) => fs.searchLocal(typemoq.It.isAnyString(), interpreter1Path, typemoq.It.isAny()))
                .returns(() => Promise.resolve([path.join(interpreter1Kernel.name, 'kernel.json')]));

            // Global path setup
            const globalPath = path.join('usr', 'share', 'jupyter', 'kernels');
            const globalFullPath = path.join(globalPath, globalKernel.name, 'kernel.json');
            fileSystem
                .setup((fs) => fs.searchLocal(typemoq.It.isAnyString(), globalPath, typemoq.It.isAny()))
                .returns(() => Promise.resolve([path.join(globalKernel.name, 'kernel.json')]));

            // Empty global paths
            const globalAPath = path.join('usr', 'local', 'share', 'jupyter', 'kernels');
            fileSystem
                .setup((fs) => fs.searchLocal(typemoq.It.isAnyString(), globalAPath, typemoq.It.isAny()))
                .returns(() => Promise.resolve([]));
            const globalBPath = path.join('Library', 'Jupyter', 'kernels');
            fileSystem
                .setup((fs) => fs.searchLocal(typemoq.It.isAnyString(), globalBPath, typemoq.It.isAny()))
                .returns(() => Promise.resolve([]));

            // Jupyter path setup
            const jupyterPathKernelAPath = path.join('Users', 'testuser', 'jupyterPathDirA', 'kernels');
            const jupyterPathKernelAFullPath = path.join(
                jupyterPathKernelAPath,
                jupyterPathKernelA.name,
                'kernel.json'
            );
            const jupyterPathKernelBPath = path.join('Users', 'testuser', 'jupyterPathDirB', 'kernels');
            const jupyterPathKernelBFullPath = path.join(
                jupyterPathKernelBPath,
                jupyterPathKernelB.name,
                'kernel.json'
            );
            fileSystem
                .setup((fs) => fs.searchLocal(typemoq.It.isAnyString(), jupyterPathKernelAPath, typemoq.It.isAny()))
                .returns(() => Promise.resolve([path.join(jupyterPathKernelA.name, 'kernel.json')]));
            fileSystem
                .setup((fs) => fs.searchLocal(typemoq.It.isAnyString(), jupyterPathKernelBPath, typemoq.It.isAny()))
                .returns(() => Promise.resolve([path.join(jupyterPathKernelB.name, 'kernel.json')]));

            // Set the file system to return our kernelspec json
            fileSystem
                .setup((fs) => fs.readLocalFile(typemoq.It.isAnyString()))
                .returns((param: string) => {
                    switch (param) {
                        case activePathA:
                            if (!loadError) {
                                return Promise.resolve(JSON.stringify(activeKernelA));
                            } else {
                                return Promise.resolve('');
                            }
                        case activePathB:
                            return Promise.resolve(JSON.stringify(activeKernelB));
                        case interpreter0FullPath:
                            return Promise.resolve(JSON.stringify(interpreter0Kernel));
                        case interpreter1FullPath:
                            return Promise.resolve(JSON.stringify(interpreter1Kernel));
                        case globalFullPath:
                            return Promise.resolve(JSON.stringify(globalKernel));
                        case jupyterPathKernelAFullPath:
                            return Promise.resolve(JSON.stringify(jupyterPathKernelA));
                        case jupyterPathKernelBFullPath:
                            return Promise.resolve(JSON.stringify(jupyterPathKernelB));
                        default:
                            return Promise.resolve('');
                    }
                });

            const executionFactory = mock(PythonExecutionFactory);

            kernelFinder = new KernelFinder(
                interpreterService.object,
                interpreterLocator.object,
                platformService.object,
                fileSystem.object,
                pathUtils.object,
                context.object,
                instance(workspaceService),
                instance(executionFactory),
                envVarsProvider.object
            );
        });

        test('Basic listKernelSpecs', async () => {
            setupFindFileSystem();
            const specs = await kernelFinder.listKernelSpecs(resource);
            expect(specs[0]).to.deep.include(activeKernelA);
            expect(specs[1]).to.deep.include(activeKernelB);
            expect(specs[2]).to.deep.include(interpreter0Kernel);
            expect(specs[3]).to.deep.include(interpreter1Kernel);
            expect(specs[4]).to.deep.include(jupyterPathKernelA);
            expect(specs[5]).to.deep.include(jupyterPathKernelB);
            expect(specs[6]).to.deep.include(globalKernel);
            fileSystem.reset();
        });

        test('listKernelSpecs load error', async () => {
            setupFindFileSystem();
            loadError = true;
            const specs = await kernelFinder.listKernelSpecs(resource);
            expect(specs[0]).to.deep.include(activeKernelB);
            expect(specs[1]).to.deep.include(interpreter0Kernel);
            expect(specs[2]).to.deep.include(interpreter1Kernel);
            expect(specs[3]).to.deep.include(jupyterPathKernelA);
            expect(specs[4]).to.deep.include(jupyterPathKernelB);
            expect(specs[5]).to.deep.include(globalKernel);
            fileSystem.reset();
        });
    });

    suite('findKernelSpec', () => {
        setup(() => {
            interpreterService = typemoq.Mock.ofType<IInterpreterService>();
            interpreterService
                .setup((is) => is.getActiveInterpreter(typemoq.It.isAny()))
                .returns(() => Promise.resolve(activeInterpreter));
            interpreterService
                .setup((is) => is.getInterpreterDetails(typemoq.It.isAny()))
                .returns(() => Promise.resolve(activeInterpreter));

            interpreterLocator = typemoq.Mock.ofType<IInterpreterLocatorService>();
            interpreterLocator
                .setup((il) => il.getInterpreters(typemoq.It.isAny(), typemoq.It.isAny()))
                .returns(() => Promise.resolve(interpreters));

            fileSystem = typemoq.Mock.ofType<IDataScienceFileSystem>();

            activeInterpreter = {
                path: context.object.globalStoragePath,
                displayName: 'activeInterpreter',
                sysPrefix: '1',
                envName: '1',
                sysVersion: '3.1.1.1',
                architecture: Architecture.x64,
                envType: EnvironmentType.Unknown
            };
            for (let i = 0; i < 10; i += 1) {
                interpreters.push({
                    path: `${context.object.globalStoragePath}_${i}`,
                    sysPrefix: '1',
                    envName: '1',
                    sysVersion: '3.1.1.1',
                    architecture: Architecture.x64,
                    envType: EnvironmentType.Unknown
                });
            }
            interpreters.push(activeInterpreter);
            resource = Uri.file(context.object.globalStoragePath);

            workspaceService = mock<IWorkspaceService>();
            const executionFactory = mock(PythonExecutionFactory);

            kernelFinder = new KernelFinder(
                interpreterService.object,
                interpreterLocator.object,
                platformService.object,
                fileSystem.object,
                pathUtils.object,
                context.object,
                instance(workspaceService),
                instance(executionFactory),
                envVarsProvider.object
            );
        });

        test('KernelSpec is in cache', async () => {
            setupFileSystem();
            fileSystem
                .setup((fs) => fs.readLocalFile(typemoq.It.isAnyString()))
                .returns((param: string) => {
                    if (param.includes(cacheFile)) {
                        return Promise.resolve(`["${kernel.name}"]`);
                    }
                    return Promise.resolve(JSON.stringify(kernel));
                });
            const spec = await kernelFinder.findKernelSpec(resource, testKernelMetadata);
            assert.deepEqual(spec, kernel, 'The found kernel spec is not the same.');
            fileSystem.reset();
        });

        test('KernelSpec is in the active interpreter', async () => {
            setupFileSystem();
            fileSystem
                .setup((fs) => fs.readLocalFile(typemoq.It.isAnyString()))
                .returns((pathParam: string) => {
                    if (pathParam.includes(cacheFile)) {
                        return Promise.resolve('[]');
                    }
                    return Promise.resolve(JSON.stringify(kernel));
                });
            const spec = await kernelFinder.findKernelSpec(resource, testKernelMetadata);
            expect(spec).to.deep.include(kernel);
            fileSystem.reset();
        });

        test('No kernel name given, then return undefined.', async () => {
            setupFileSystem();

            // Create a second active interpreter to return on the second call
            const activeInterpreter2 = {
                path: context.object.globalStoragePath,
                displayName: 'activeInterpreter2',
                sysPrefix: '1',
                envName: '1',
                sysVersion: '3.1.1.1',
                architecture: Architecture.x64,
                envType: EnvironmentType.Unknown
            };
            // Record a second call to getActiveInterpreter, will play after the first
            interpreterService
                .setup((is) => is.getActiveInterpreter(typemoq.It.isAny()))
                .returns(() => Promise.resolve(activeInterpreter2));

            fileSystem
                .setup((fs) => fs.readLocalFile(typemoq.It.isAnyString()))
                .returns((pathParam: string) => {
                    if (pathParam.includes(cacheFile)) {
                        return Promise.resolve('[]');
                    }
                    return Promise.resolve(JSON.stringify(kernel));
                });
            const spec = await kernelFinder.findKernelSpec(resource);
            assert.isUndefined(spec);
            fileSystem.reset();
        });

        test('KernelSpec is in the interpreters', async () => {
            setupFileSystem();
            fileSystem
                .setup((fs) => fs.searchLocal(typemoq.It.isAnyString(), typemoq.It.isAnyString(), typemoq.It.isAny()))
                .returns(() => Promise.resolve([]));
            fileSystem
                .setup((fs) => fs.readLocalFile(typemoq.It.isAnyString()))
                .returns((pathParam: string) => {
                    if (pathParam.includes(cacheFile)) {
                        return Promise.resolve('[]');
                    }
                    return Promise.resolve(JSON.stringify(kernel));
                });
            const spec = await kernelFinder.findKernelSpec(activeInterpreter, testKernelMetadata);
            expect(spec).to.deep.include(kernel);
            fileSystem.reset();
        });

        test('KernelSpec is in disk', async () => {
            setupFileSystem();
            fileSystem
                .setup((fs) => fs.searchLocal(typemoq.It.isAnyString(), typemoq.It.isAnyString(), typemoq.It.isAny()))
                .returns(() => Promise.resolve([kernelName]));
            fileSystem
                .setup((fs) => fs.readLocalFile(typemoq.It.isAnyString()))
                .returns((pathParam: string) => {
                    if (pathParam.includes(cacheFile)) {
                        return Promise.resolve('[]');
                    }
                    return Promise.resolve(JSON.stringify(kernel));
                });
            interpreterService
                .setup((is) => is.getActiveInterpreter(typemoq.It.isAny()))
                .returns(() => Promise.resolve(undefined));
            const spec = await kernelFinder.findKernelSpec(activeInterpreter, testKernelMetadata);
            expect(spec).to.deep.include(kernel);
            fileSystem.reset();
        });

        test('KernelSpec not found, returning undefined', async () => {
            setupFileSystem();
            fileSystem
                .setup((fs) => fs.readLocalFile(typemoq.It.isAnyString()))
                .returns((pathParam: string) => {
                    if (pathParam.includes(cacheFile)) {
                        return Promise.resolve('[]');
                    }
                    return Promise.resolve('{}');
                });
            // get default kernel
            const spec = await kernelFinder.findKernelSpec(resource);
            assert.isUndefined(spec);
            fileSystem.reset();
        });

        test('Look for KernelA with no cache, find KernelA and KenelB, then search for KernelB and find it in cache', async () => {
            setupFileSystem();
            fileSystem
                .setup((fs) => fs.readLocalFile(typemoq.It.isAnyString()))
                .returns((pathParam: string) => {
                    if (pathParam.includes(cacheFile)) {
                        return Promise.resolve('[]');
                    } else if (pathParam.includes('kernelA')) {
                        const specA = {
                            ...kernel,
                            name: 'kernelA'
                        };
                        return Promise.resolve(JSON.stringify(specA));
                    }
                    return Promise.resolve('');
                });

            const spec = await kernelFinder.findKernelSpec(resource, { name: 'kernelA', display_name: '' });
            assert.equal(spec!.name.includes('kernelA'), true);
            fileSystem.reset();

            setupFileSystem();
            fileSystem
                .setup((fs) => fs.searchLocal(typemoq.It.isAnyString(), typemoq.It.isAnyString(), typemoq.It.isAny()))
                .verifiable(typemoq.Times.never()); // this never executing means the kernel was found in cache
            fileSystem
                .setup((fs) => fs.readLocalFile(typemoq.It.isAnyString()))
                .returns((pathParam: string) => {
                    if (pathParam.includes(cacheFile)) {
                        return Promise.resolve(
                            JSON.stringify([
                                path.join('kernels', kernel.name, 'kernel.json'),
                                path.join('kernels', 'kernelA', 'kernel.json'),
                                path.join('kernels', 'kernelB', 'kernel.json')
                            ])
                        );
                    } else if (pathParam.includes('kernelB')) {
                        const specB = {
                            ...kernel,
                            name: 'kernelB'
                        };
                        return Promise.resolve(JSON.stringify(specB));
                    }
                    return Promise.resolve('{}');
                });
            const spec2 = await kernelFinder.findKernelSpec(resource, { name: 'kernelB', display_name: '' });
            assert.equal(spec2!.name.includes('kernelB'), true);
        });
    });
});
