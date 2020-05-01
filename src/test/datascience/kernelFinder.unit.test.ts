// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as assert from 'assert';
import { expect } from 'chai';
import * as path from 'path';
import { anything, instance, mock, when } from 'ts-mockito';
import * as typemoq from 'typemoq';

import { Uri } from 'vscode';
import { IFileSystem, IPlatformService } from '../../client/common/platform/types';
import { IExtensionContext, IInstaller, IPathUtils, Resource } from '../../client/common/types';
import { Architecture } from '../../client/common/utils/platform';
import { JupyterKernelSpec } from '../../client/datascience/jupyter/kernels/jupyterKernelSpec';
import { KernelFinder } from '../../client/datascience/kernel-launcher/kernelFinder';
import { IKernelFinder } from '../../client/datascience/kernel-launcher/types';
import {
    IInterpreterLocatorService,
    IInterpreterService,
    InterpreterType,
    PythonInterpreter
} from '../../client/interpreter/contracts';

suite('Kernel Finder', () => {
    let interpreterService: typemoq.IMock<IInterpreterService>;
    let interpreterLocator: typemoq.IMock<IInterpreterLocatorService>;
    let fileSystem: typemoq.IMock<IFileSystem>;
    let platformService: typemoq.IMock<IPlatformService>;
    let pathUtils: typemoq.IMock<IPathUtils>;
    let context: typemoq.IMock<IExtensionContext>;
    let installer: IInstaller;
    let kernelFinder: IKernelFinder;
    let activeInterpreter: PythonInterpreter;
    const interpreters: PythonInterpreter[] = [];
    let resource: Resource;
    const kernelName = 'testKernel';
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
            .setup((fs) => fs.search(typemoq.It.isAnyString(), typemoq.It.isAnyString()))
            .returns(() =>
                Promise.resolve([
                    path.join(kernel.name, 'kernel.json'),
                    path.join('kernelA', 'kernel.json'),
                    path.join('kernelB', 'kernel.json')
                ])
            );
    }

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
        platformService = typemoq.Mock.ofType<IPlatformService>();
        platformService.setup((ps) => ps.isWindows).returns(() => true);
        platformService.setup((ps) => ps.isMac).returns(() => true);

        pathUtils = typemoq.Mock.ofType<IPathUtils>();
        pathUtils.setup((pu) => pu.home).returns(() => './');

        context = typemoq.Mock.ofType<IExtensionContext>();
        context.setup((c) => c.globalStoragePath).returns(() => './');

        installer = mock<IInstaller>();
        when(installer.isInstalled(anything(), anything())).thenResolve(true);

        activeInterpreter = {
            path: context.object.globalStoragePath,
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

        kernelFinder = new KernelFinder(
            interpreterService.object,
            interpreterLocator.object,
            platformService.object,
            fileSystem.object,
            pathUtils.object,
            instance(installer),
            context.object
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
        const spec = await kernelFinder.findKernelSpec(resource, kernelName);
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
        const spec = await kernelFinder.findKernelSpec(resource, kernelName);
        expect(spec).to.deep.include(kernel);
        fileSystem.reset();
    });

    test('KernelSpec is in the interpreters', async () => {
        setupFileSystem();
        fileSystem
            .setup((fs) => fs.search(typemoq.It.isAnyString(), typemoq.It.isAnyString()))
            .returns(() => Promise.resolve([]));
        fileSystem
            .setup((fs) => fs.readFile(typemoq.It.isAnyString()))
            .returns((pathParam: string) => {
                if (pathParam.includes(cacheFile)) {
                    return Promise.resolve('[]');
                }
                return Promise.resolve(JSON.stringify(kernel));
            });
        const spec = await kernelFinder.findKernelSpec(activeInterpreter, kernelName);
        expect(spec).to.deep.include(kernel);
        fileSystem.reset();
    });

    test('KernelSpec is in disk', async () => {
        setupFileSystem();
        fileSystem
            .setup((fs) => fs.search(typemoq.It.isAnyString(), typemoq.It.isAnyString()))
            .returns(() => Promise.resolve([kernelName]));
        fileSystem
            .setup((fs) => fs.readFile(typemoq.It.isAnyString()))
            .returns((pathParam: string) => {
                if (pathParam.includes(cacheFile)) {
                    return Promise.resolve('[]');
                }
                return Promise.resolve(JSON.stringify(kernel));
            });
        const spec = await kernelFinder.findKernelSpec(activeInterpreter, kernelName);
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
        const spec2 = await kernelFinder.findKernelSpec(resource, spec.name);
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

        const spec = await kernelFinder.findKernelSpec(resource, 'kernelA');
        assert.equal(spec.name.includes('kernelA'), true);
        fileSystem.reset();

        setupFileSystem();
        fileSystem
            .setup((fs) => fs.search(typemoq.It.isAnyString(), typemoq.It.isAnyString()))
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
        const spec2 = await kernelFinder.findKernelSpec(resource, 'kernelB');
        assert.equal(spec2.name.includes('kernelB'), true);
    });
});
