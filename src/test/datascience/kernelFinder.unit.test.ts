// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as assert from 'assert';
import * as path from 'path';
import * as typemoq from 'typemoq';

import { performance } from 'perf_hooks';
import { CancellationTokenSource, Uri } from 'vscode';
import { IFileSystem, IPlatformService } from '../../client/common/platform/types';
import { IPathUtils, Resource } from '../../client/common/types';
import { Architecture } from '../../client/common/utils/platform';
import { EXTENSION_ROOT_DIR } from '../../client/constants';
import { KernelFinder } from '../../client/datascience/kernel-launcher/kernelFinder';
import { IKernelFinder } from '../../client/datascience/kernel-launcher/types';
import { IJupyterKernelSpec } from '../../client/datascience/types';
import { IInterpreterService, InterpreterType, PythonInterpreter } from '../../client/interpreter/contracts';
import { DataScienceIocContainer } from './dataScienceIocContainer';

suite('Kernel Finder', () => {
    let ioc: DataScienceIocContainer;
    let interpreterService: typemoq.IMock<IInterpreterService>;
    let fileSystem: IFileSystem;
    let platformService: IPlatformService;
    let pathUtils: IPathUtils;
    let kernelFinder: IKernelFinder;
    let cancelSource: CancellationTokenSource;
    let activeInterpreter: PythonInterpreter;
    const interpreters: PythonInterpreter[] = [];
    let resource: Resource;
    const kernelName = 'testKernel';
    const kernel: IJupyterKernelSpec = {
        name: 'testKernel',
        language: 'python',
        path: '',
        display_name: 'Python 3',
        metadata: {},
        argv: ['<python path>', '-m', 'ipykernel_launcher', '-f', '<connection_file>']
    };

    async function putKernelSpecInCache() {
        await fileSystem.writeFile(path.join(EXTENSION_ROOT_DIR, 'kernelSpecCache.json'), JSON.stringify([kernel]));
    }

    async function putKernelSpecInActiveInterpreter() {
        for (let i = 0; i < 10; i += 1) {
            await fileSystem.createDirectory(
                path.join(EXTENSION_ROOT_DIR, 'share/jupyter/kernels', `${i.toString()}_kernel`)
            );
        }

        await fileSystem.createDirectory(path.join(EXTENSION_ROOT_DIR, 'share/jupyter/kernels', kernelName));
        await fileSystem.writeFile(
            path.join(EXTENSION_ROOT_DIR, 'share/jupyter/kernels', kernelName, 'kernel.json'),
            JSON.stringify(kernel)
        );
    }

    async function putKernelSpecInTheLastInterpreter() {
        for (let i = 0; i < 10; i += 1) {
            await fileSystem.createDirectory(path.join(`${EXTENSION_ROOT_DIR}_${i}`, 'share/jupyter/kernels'));
        }

        for (let i = 0; i < 10; i += 1) {
            await fileSystem.createDirectory(
                path.join(EXTENSION_ROOT_DIR, 'share/jupyter/kernels', `${i.toString()}_kernel`)
            );
        }

        await fileSystem.createDirectory(path.join(EXTENSION_ROOT_DIR, 'share/jupyter/kernels', kernelName));
        await fileSystem.writeFile(
            path.join(EXTENSION_ROOT_DIR, 'share/jupyter/kernels', kernelName, 'kernel.json'),
            JSON.stringify(kernel)
        );

        if (platformService.isWindows) {
            await fileSystem.createDirectory(path.join(process.env.ALLUSERSPROFILE!, 'jupyter', 'kernels', kernelName));
            await fileSystem.writeFile(
                path.join(process.env.ALLUSERSPROFILE!, 'jupyter', 'kernels', kernelName, 'kernel.json'),
                JSON.stringify(kernel)
            );
        } else {
            await fileSystem.createDirectory(path.join('/usr/share/jupyter/kernels', kernelName));
            await fileSystem.writeFile(
                path.join('/usr/share/jupyter/kernels', kernelName, 'kernel.json'),
                JSON.stringify(kernel)
            );
        }
    }

    async function putKernelSpecInDisk() {
        await fileSystem.createDirectory(path.join(EXTENSION_ROOT_DIR, 'share/jupyter/kernels', kernelName));
        await fileSystem.writeFile(
            path.join(EXTENSION_ROOT_DIR, 'share/jupyter/kernels', kernelName, 'kernel.json'),
            JSON.stringify(kernel)
        );

        if (platformService.isWindows) {
            await fileSystem.createDirectory(path.join(process.env.ALLUSERSPROFILE!, 'jupyter', 'kernels', kernelName));
            await fileSystem.writeFile(
                path.join(process.env.ALLUSERSPROFILE!, 'jupyter', 'kernels', kernelName, 'kernel.json'),
                JSON.stringify(kernel)
            );
        } else {
            await fileSystem.createDirectory(path.join('/usr/share/jupyter/kernels', kernelName));
            await fileSystem.writeFile(
                path.join('/usr/share/jupyter/kernels', kernelName, 'kernel.json'),
                JSON.stringify(kernel)
            );
        }
    }

    async function deleteAllTestKernelSpecs() {
        const cacheExists = await fileSystem.fileExists(path.join(EXTENSION_ROOT_DIR, 'kernelSpecCache.json'));
        if (cacheExists) {
            await fileSystem.deleteFile(path.join(EXTENSION_ROOT_DIR, 'kernelSpecCache.json'));
        }

        for (let i = 0; i < 10; i += 1) {
            const extraInterpreterExists = await fileSystem.directoryExists(
                path.join(`${EXTENSION_ROOT_DIR}_${i}`, 'share/jupyter/kernels')
            );
            if (extraInterpreterExists) {
                await fileSystem.deleteDirectory(path.join(`${EXTENSION_ROOT_DIR}_${i}`, 'share/jupyter/kernels'));
            }
        }

        for (let i = 0; i < 10; i += 1) {
            const exists = await fileSystem.directoryExists(
                path.join(EXTENSION_ROOT_DIR, 'share/jupyter/kernels', `${i.toString()}_kernel`)
            );
            if (exists) {
                await fileSystem.deleteDirectory(
                    path.join(EXTENSION_ROOT_DIR, 'share/jupyter/kernels', `${i.toString()}_kernel`)
                );
            }
        }

        const interpreterExists = await fileSystem.directoryExists(
            path.join(EXTENSION_ROOT_DIR, 'share/jupyter/kernels', kernelName)
        );
        if (interpreterExists) {
            await fileSystem.deleteFile(
                path.join(EXTENSION_ROOT_DIR, 'share/jupyter/kernels', kernelName, 'kernel.json')
            );
            await fileSystem.deleteDirectory(path.join(EXTENSION_ROOT_DIR, 'share/jupyter/kernels', kernelName));
        }

        const winExists = await fileSystem.directoryExists(
            path.join(process.env.ALLUSERSPROFILE!, 'jupyter', 'kernels', kernelName)
        );
        const unixExists = await fileSystem.directoryExists(path.join('/usr/share/jupyter/kernels', kernelName));
        if (platformService.isWindows && winExists) {
            await fileSystem.deleteFile(
                path.join(process.env.ALLUSERSPROFILE!, 'jupyter', 'kernels', kernelName, 'kernel.json')
            );
            await fileSystem.deleteDirectory(path.join(process.env.ALLUSERSPROFILE!, 'jupyter', 'kernels', kernelName));
        } else if (unixExists) {
            await fileSystem.deleteFile(path.join('/usr/share/jupyter/kernels', kernelName, 'kernel.json'));
            await fileSystem.deleteDirectory(path.join('/usr/share/jupyter/kernels', kernelName));
        }
    }

    setup(() => {
        ioc = new DataScienceIocContainer();
        ioc.registerDataScienceTypes();
        platformService = ioc.serviceContainer.get<IPlatformService>(IPlatformService);
        pathUtils = ioc.serviceContainer.get<IPathUtils>(IPathUtils);
        fileSystem = ioc.serviceContainer.get<IFileSystem>(IFileSystem);

        activeInterpreter = {
            path: EXTENSION_ROOT_DIR,
            sysPrefix: '1',
            envName: '1',
            sysVersion: '3.1.1.1',
            architecture: Architecture.x64,
            type: InterpreterType.Unknown
        };
        for (let i = 0; i < 10; i += 1) {
            interpreters.push({
                path: `${EXTENSION_ROOT_DIR}_${i}`,
                sysPrefix: '1',
                envName: '1',
                sysVersion: '3.1.1.1',
                architecture: Architecture.x64,
                type: InterpreterType.Unknown
            });
        }
        interpreters.push(activeInterpreter);
        resource = Uri.file(EXTENSION_ROOT_DIR);
        cancelSource = new CancellationTokenSource();

        interpreterService = typemoq.Mock.ofType<IInterpreterService>();
        interpreterService
            .setup(is => is.getInterpreters(typemoq.It.isAny()))
            .returns(() => Promise.resolve(interpreters));
        interpreterService
            .setup(is => is.getActiveInterpreter(typemoq.It.isAny()))
            .returns(() => Promise.resolve(activeInterpreter));

        kernelFinder = new KernelFinder(interpreterService.object, platformService, fileSystem, pathUtils);
    });

    test('KernelSpec is in cache', async () => {
        await putKernelSpecInCache();
        const spec = await kernelFinder.findKernelSpec(resource, cancelSource.token, kernelName);
        assert.deepEqual(spec, kernel, 'The found kernel spec is not the same.');
        await deleteAllTestKernelSpecs();
    });

    test('KernelSpec is in the active interpreter', async () => {
        await putKernelSpecInActiveInterpreter();
        const spec = await kernelFinder.findKernelSpec(resource, cancelSource.token, kernelName);
        assert.deepEqual(spec, kernel);
        await deleteAllTestKernelSpecs();
    });

    // The test for searching in the interpreters and on disk are the slowest cases, so they race.
    // Because of that, the next two tests are prepared to pass in case either of them finishes first (without being undefined).
    test('KernelSpec is in the interpreters', async () => {
        await putKernelSpecInTheLastInterpreter();
        const spec = await kernelFinder.findKernelSpec(activeInterpreter, cancelSource.token, kernelName);
        assert.deepEqual(spec, kernel);
        await deleteAllTestKernelSpecs();
    });

    test('KernelSpec is in disk', async () => {
        await putKernelSpecInDisk();
        const spec = await kernelFinder.findKernelSpec(resource, cancelSource.token, kernelName);
        assert.deepEqual(spec, kernel);
        await deleteAllTestKernelSpecs();
    });

    test('KernelSpec not found, returning default', async () => {
        // get default kernel
        const spec = await kernelFinder.findKernelSpec(resource, cancelSource.token, kernelName);
        assert.ok(spec);
        await deleteAllTestKernelSpecs();
    });

    test('KernelSpec not found, returning default, then search for it again and find it in the cache', async () => {
        // get default kernel
        const default_0 = performance.now();
        const spec = await kernelFinder.findKernelSpec(resource, cancelSource.token, kernelName);
        const default_1 = performance.now();
        assert.ok(spec);
        // get the same kernel, but from cache
        const cache_0 = performance.now();
        const spec2 = await kernelFinder.findKernelSpec(resource, cancelSource.token, spec.name);
        const cache_1 = performance.now();
        assert.deepEqual(spec, spec2);
        // the second search should be faster

        // tslint:disable-next-line: no-console
        console.log(`default time = ${default_1 - default_0}`);
        // tslint:disable-next-line: no-console
        console.log(`cache time = ${cache_1 - cache_0}`);

        assert.equal(default_1 - default_0 > cache_1 - cache_0, true);
        await deleteAllTestKernelSpecs();
    });
});
