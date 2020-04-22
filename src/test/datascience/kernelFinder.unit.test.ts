// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as assert from 'assert';
import { expect } from 'chai';
import * as typemoq from 'typemoq';

import { Uri } from 'vscode';
import { IFileSystem, IPlatformService } from '../../client/common/platform/types';
import { IExtensionContext, IPathUtils, Resource } from '../../client/common/types';
import { Architecture } from '../../client/common/utils/platform';
import { KernelFinder } from '../../client/datascience/kernel-launcher/kernelFinder';
import { IKernelFinder } from '../../client/datascience/kernel-launcher/types';
import { IJupyterKernelSpec } from '../../client/datascience/types';
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
    let kernelFinder: IKernelFinder;
    let activeInterpreter: PythonInterpreter;
    const interpreters: PythonInterpreter[] = [];
    let resource: Resource;
    const kernelName = 'testKernel';
    const kernel: IJupyterKernelSpec = {
        name: 'testKernel',
        language: 'python',
        path: '<python path>',
        display_name: 'Python 3',
        argv: ['<python path>', '-m', 'ipykernel_launcher', '-f', '<connection_file>']
    };

    function setupFileSystem() {
        fileSystem
            .setup((fs) => fs.writeFile(typemoq.It.isAnyString(), typemoq.It.isAnyString()))
            .returns(() => Promise.resolve());
        fileSystem.setup((fs) => fs.getSubDirectories(typemoq.It.isAnyString())).returns(() => Promise.resolve(['']));
        fileSystem
            .setup((fs) => fs.search(typemoq.It.isAnyString(), typemoq.It.isAnyString()))
            .returns((param: string) => Promise.resolve([param]));
    }

    setup(() => {
        interpreterService = typemoq.Mock.ofType<IInterpreterService>();
        interpreterService
            .setup((is) => is.getActiveInterpreter(typemoq.It.isAny()))
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
            context.object
        );
    });

    test('KernelSpec is in cache', async () => {
        setupFileSystem();
        fileSystem
            .setup((fs) => fs.readFile(typemoq.It.isAnyString()))
            .returns(() => Promise.resolve(`[${JSON.stringify(kernel)}]`));
        const spec = await kernelFinder.findKernelSpec(resource, kernelName);
        assert.deepEqual(spec, kernel, 'The found kernel spec is not the same.');
        fileSystem.reset();
    });

    test('KernelSpec is in the active interpreter', async () => {
        setupFileSystem();
        fileSystem
            .setup((fs) => fs.readFile(typemoq.It.isAnyString()))
            .returns((pathParam: string) => {
                if (pathParam.includes('kernelSpecCache.json')) {
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
                if (pathParam.includes('kernelSpecCache.json')) {
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
                if (pathParam.includes('kernelSpecCache.json')) {
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
                if (pathParam.includes('kernelSpecCache.json')) {
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
                if (pathParam.includes('kernelSpecCache.json')) {
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
                if (pathParam.includes('kernelSpecCache.json')) {
                    return Promise.resolve(`[${JSON.stringify(spec)}]`);
                }
                return Promise.resolve('{}');
            })
            .verifiable(typemoq.Times.once());

        // get the same kernel, but from cache
        const spec2 = await kernelFinder.findKernelSpec(resource, spec.name);
        expect(spec).to.deep.include(spec2);

        fileSystem.verifyAll();
        fileSystem.reset();
    });
});
