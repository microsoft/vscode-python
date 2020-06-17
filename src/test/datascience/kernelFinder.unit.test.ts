// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as assert from 'assert';
import { expect } from 'chai';
import * as path from 'path';
import { anything, instance, mock, when } from 'ts-mockito';
import * as typemoq from 'typemoq';

import { Uri } from 'vscode';
import { IWorkspaceService } from '../../client/common/application/types';
import { IFileSystem, IPlatformService } from '../../client/common/platform/types';
import { IExtensionContext, IInstaller, IPathUtils, Resource } from '../../client/common/types';
import { Architecture } from '../../client/common/utils/platform';
import { defaultKernelSpecName } from '../../client/datascience/jupyter/kernels/helpers';
import { JupyterKernelSpec } from '../../client/datascience/jupyter/kernels/jupyterKernelSpec';
import { KernelFinder } from '../../client/datascience/kernel-launcher/kernelFinder';
import { IKernelFinder } from '../../client/datascience/kernel-launcher/types';
import { IJupyterKernelSpec } from '../../client/datascience/types';
import { IInterpreterLocatorService, IInterpreterService } from '../../client/interpreter/contracts';
import { InterpreterType, PythonInterpreter } from '../../client/pythonEnvironments/info';

suite('Kernel Finder', () => {
    let interpreterService: typemoq.IMock<IInterpreterService>;
    let interpreterLocator: typemoq.IMock<IInterpreterLocatorService>;
    let fileSystem: typemoq.IMock<IFileSystem>;
    let platformService: typemoq.IMock<IPlatformService>;
    let pathUtils: typemoq.IMock<IPathUtils>;
    let context: typemoq.IMock<IExtensionContext>;
    let installer: IInstaller;
    let workspaceService: IWorkspaceService;
    let kernelFinder: IKernelFinder;
    let activeInterpreter: PythonInterpreter;
    let interpreters: PythonInterpreter[] = [];
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

    function setupFileSystem() {
        fileSystem
            .setup((fs) => fs.writeFile(typemoq.It.isAnyString(), typemoq.It.isAnyString()))
            .returns(() => Promise.resolve());
        fileSystem.setup((fs) => fs.getSubDirectories(typemoq.It.isAnyString())).returns(() => Promise.resolve(['']));
        fileSystem
            .setup((fs) => fs.search(typemoq.It.isAnyString(), typemoq.It.isAnyString(), typemoq.It.isAny()))
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
            .setup((fs) => fs.writeFile(typemoq.It.isAnyString(), typemoq.It.isAnyString()))
            .returns(() => Promise.resolve());
        fileSystem.setup((fs) => fs.getSubDirectories(typemoq.It.isAnyString())).returns(() => Promise.resolve(['']));
    }

    setup(() => {
        pathUtils = typemoq.Mock.ofType<IPathUtils>();
        pathUtils.setup((pu) => pu.home).returns(() => './');

        context = typemoq.Mock.ofType<IExtensionContext>();
        context.setup((c) => c.globalStoragePath).returns(() => './');
        fileSystem = typemoq.Mock.ofType<IFileSystem>();

        installer = mock<IInstaller>();
        when(installer.isInstalled(anything(), anything())).thenResolve(true);

        platformService = typemoq.Mock.ofType<IPlatformService>();
        platformService.setup((ps) => ps.isWindows).returns(() => true);
        platformService.setup((ps) => ps.isMac).returns(() => true);
    });

    suite('listKernelSpecs', () => {
        let activeKernelA: IJupyterKernelSpec;
        let activeKernelB: IJupyterKernelSpec;
        let interpreter0Kernel: IJupyterKernelSpec;
        let interpreter1Kernel: IJupyterKernelSpec;
        let globalKernel: IJupyterKernelSpec;
        let loadError = false;
        setup(() => {
            activeInterpreter = {
                path: context.object.globalStoragePath,
                displayName: 'activeInterpreter',
                sysPrefix: 'active',
                envName: '1',
                sysVersion: '3.1.1.1',
                architecture: Architecture.x64,
                type: InterpreterType.Unknown
            };
            interpreters = [];
            for (let i = 0; i < 2; i += 1) {
                interpreters.push({
                    path: `${context.object.globalStoragePath}_${i}`,
                    sysPrefix: `Interpreter${i}`,
                    envName: '1',
                    sysVersion: '3.1.1.1',
                    architecture: Architecture.x64,
                    type: InterpreterType.Unknown
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
                .setup((fs) => fs.writeFile(typemoq.It.isAnyString(), typemoq.It.isAnyString()))
                .returns(() => Promise.resolve());
            fileSystem
                .setup((fs) => fs.getSubDirectories(typemoq.It.isAnyString()))
                .returns(() => Promise.resolve(['']));
            fileSystem
                .setup((fs) => fs.search(typemoq.It.isAnyString(), activePath, typemoq.It.isAny()))
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
                .setup((fs) => fs.search(typemoq.It.isAnyString(), interpreter0Path, typemoq.It.isAny()))
                .returns(() => Promise.resolve([path.join(interpreter0Kernel.name, 'kernel.json')]));
            fileSystem
                .setup((fs) => fs.search(typemoq.It.isAnyString(), interpreter1Path, typemoq.It.isAny()))
                .returns(() => Promise.resolve([path.join(interpreter1Kernel.name, 'kernel.json')]));

            const globalPath = path.join('usr', 'share', 'jupyter', 'kernels');
            const globalFullPath = path.join(globalPath, globalKernel.name, 'kernel.json');
            fileSystem
                .setup((fs) => fs.search(typemoq.It.isAnyString(), globalPath, typemoq.It.isAny()))
                .returns(() => Promise.resolve([path.join(globalKernel.name, 'kernel.json')]));

            // Empty global paths
            const globalAPath = path.join('usr', 'local', 'share', 'jupyter', 'kernels');
            fileSystem
                .setup((fs) => fs.search(typemoq.It.isAnyString(), globalAPath, typemoq.It.isAny()))
                .returns(() => Promise.resolve([]));
            const globalBPath = path.join('Library', 'Jupyter', 'kernels');
            fileSystem
                .setup((fs) => fs.search(typemoq.It.isAnyString(), globalBPath, typemoq.It.isAny()))
                .returns(() => Promise.resolve([]));

            // Set the file system to return our kernelspec json
            fileSystem
                .setup((fs) => fs.readFile(typemoq.It.isAnyString()))
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
                        default:
                            return Promise.resolve('');
                    }
                });

            kernelFinder = new KernelFinder(
                interpreterService.object,
                interpreterLocator.object,
                platformService.object,
                fileSystem.object,
                pathUtils.object,
                instance(installer),
                context.object,
                instance(workspaceService)
            );
        });

        test('Basic listKernelSpecs', async () => {
            setupFindFileSystem();
            const specs = await kernelFinder.listKernelSpecs(resource);
            expect(specs[0]).to.deep.include(activeKernelA);
            expect(specs[1]).to.deep.include(activeKernelB);
            expect(specs[2]).to.deep.include(interpreter0Kernel);
            expect(specs[3]).to.deep.include(interpreter1Kernel);
            expect(specs[4]).to.deep.include(globalKernel);
            fileSystem.reset();
        });

        test('listKernelSpecs load error', async () => {
            setupFindFileSystem();
            loadError = true;
            const specs = await kernelFinder.listKernelSpecs(resource);
            expect(specs[0]).to.deep.include(activeKernelB);
            expect(specs[1]).to.deep.include(interpreter0Kernel);
            expect(specs[2]).to.deep.include(interpreter1Kernel);
            expect(specs[3]).to.deep.include(globalKernel);
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

            fileSystem = typemoq.Mock.ofType<IFileSystem>();

            activeInterpreter = {
                path: context.object.globalStoragePath,
                displayName: 'activeInterpreter',
                sysPrefix: '1',
                envName: '1',
                sysVersion: '3.1.1.1',
                architecture: Architecture.x64,
                type: InterpreterType.Unknown
            };
            for (let i = 0; i < 10; i += 1) {
                interpreters.push({
                    path: `${context.object.globalStoragePath}_${i}`,
                    sysPrefix: '1',
                    envName: '1',
                    sysVersion: '3.1.1.1',
                    architecture: Architecture.x64,
                    type: InterpreterType.Unknown
                });
            }
            interpreters.push(activeInterpreter);
            resource = Uri.file(context.object.globalStoragePath);

            workspaceService = mock<IWorkspaceService>();

            kernelFinder = new KernelFinder(
                interpreterService.object,
                interpreterLocator.object,
                platformService.object,
                fileSystem.object,
                pathUtils.object,
                instance(installer),
                context.object,
                instance(workspaceService)
            );
        });

        test('KernelSpec is in cache', async () => {
            setupFileSystem();
            fileSystem
                .setup((fs) => fs.readFile(typemoq.It.isAnyString()))
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
                .setup((fs) => fs.readFile(typemoq.It.isAnyString()))
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

        test('No kernel name given. Default spec returned should match the interpreter selected.', async () => {
            setupFileSystem();

            // Create a second active interpreter to return on the second call
            const activeInterpreter2 = {
                path: context.object.globalStoragePath,
                displayName: 'activeInterpreter2',
                sysPrefix: '1',
                envName: '1',
                sysVersion: '3.1.1.1',
                architecture: Architecture.x64,
                type: InterpreterType.Unknown
            };
            // Record a second call to getActiveInterpreter, will play after the first
            interpreterService
                .setup((is) => is.getActiveInterpreter(typemoq.It.isAny()))
                .returns(() => Promise.resolve(activeInterpreter2));

            fileSystem
                .setup((fs) => fs.readFile(typemoq.It.isAnyString()))
                .returns((pathParam: string) => {
                    if (pathParam.includes(cacheFile)) {
                        return Promise.resolve('[]');
                    }
                    return Promise.resolve(JSON.stringify(kernel));
                });
            let spec = await kernelFinder.findKernelSpec(resource);
            expect(spec.display_name).to.equal(activeInterpreter.displayName);

            spec = await kernelFinder.findKernelSpec(resource);
            expect(spec.display_name).to.equal(activeInterpreter2.displayName);
            fileSystem.reset();
        });

        test('KernelSpec is in the interpreters', async () => {
            setupFileSystem();
            fileSystem
                .setup((fs) => fs.search(typemoq.It.isAnyString(), typemoq.It.isAnyString(), typemoq.It.isAny()))
                .returns(() => Promise.resolve([]));
            fileSystem
                .setup((fs) => fs.readFile(typemoq.It.isAnyString()))
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
                .setup((fs) => fs.search(typemoq.It.isAnyString(), typemoq.It.isAnyString(), typemoq.It.isAny()))
                .returns(() => Promise.resolve([kernelName]));
            fileSystem
                .setup((fs) => fs.readFile(typemoq.It.isAnyString()))
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

        test('KernelSpec not found, returning default', async () => {
            setupFileSystem();
            fileSystem
                .setup((fs) => fs.readFile(typemoq.It.isAnyString()))
                .returns((pathParam: string) => {
                    if (pathParam.includes(cacheFile)) {
                        return Promise.resolve('[]');
                    }
                    return Promise.resolve('{}');
                });
            // get default kernel
            const spec = await kernelFinder.findKernelSpec(resource);
            assert.equal(spec.name.includes('python_defaultSpec'), true);
            fileSystem.reset();
        });

        test('Kernel metadata already has a default spec, return the same default spec', async () => {
            setupFileSystem();
            fileSystem
                .setup((fs) => fs.readFile(typemoq.It.isAnyString()))
                .returns((pathParam: string) => {
                    if (pathParam.includes(cacheFile)) {
                        return Promise.resolve('[]');
                    }
                    return Promise.resolve('{}');
                });
            // get default kernel
            const spec = await kernelFinder.findKernelSpec(resource, {
                name: defaultKernelSpecName,
                display_name: 'TargetDisplayName'
            });
            assert.equal(spec.name.includes(defaultKernelSpecName), true);
            expect(spec.display_name).to.equals('TargetDisplayName');
            fileSystem.reset();
        });

        test('KernelSpec not found, returning default, then search for it again and find it in the cache', async () => {
            setupFileSystem();
            fileSystem
                .setup((fs) => fs.readFile(typemoq.It.isAnyString()))
                .returns((pathParam: string) => {
                    if (pathParam.includes(cacheFile)) {
                        return Promise.resolve('[]');
                    }
                    return Promise.resolve('{}');
                });

            // get default kernel
            const spec = await kernelFinder.findKernelSpec(resource);
            assert.equal(spec.name.includes('python_defaultSpec'), true);
            fileSystem.reset();

            setupFileSystem();
            fileSystem
                .setup((fs) => fs.readFile(typemoq.It.isAnyString()))
                .returns((pathParam: string) => {
                    if (pathParam.includes(cacheFile)) {
                        return Promise.resolve(`["${spec.path}"]`);
                    }
                    return Promise.resolve(JSON.stringify(spec));
                })
                .verifiable(typemoq.Times.once());

            // get the same kernel, but from cache
            const spec2 = await kernelFinder.findKernelSpec(resource, { name: spec.name, display_name: '' });
            assert.notStrictEqual(spec, spec2);

            fileSystem.verifyAll();
            fileSystem.reset();
        });

        test('Look for KernelA with no cache, find KernelA and KenelB, then search for KernelB and find it in cache', async () => {
            setupFileSystem();
            fileSystem
                .setup((fs) => fs.readFile(typemoq.It.isAnyString()))
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
            assert.equal(spec.name.includes('kernelA'), true);
            fileSystem.reset();

            setupFileSystem();
            fileSystem
                .setup((fs) => fs.search(typemoq.It.isAnyString(), typemoq.It.isAnyString(), typemoq.It.isAny()))
                .verifiable(typemoq.Times.never()); // this never executing means the kernel was found in cache
            fileSystem
                .setup((fs) => fs.readFile(typemoq.It.isAnyString()))
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
            assert.equal(spec2.name.includes('kernelB'), true);
        });
    });
});
