// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { expect } from 'chai';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { Uri } from 'vscode';
import { IWorkspaceService } from '../../../client/common/application/types';
import { IFileSystem, IPlatformService } from '../../../client/common/platform/types';
import { IProcessService, IProcessServiceFactory } from '../../../client/common/process/types';
import { ITerminalActivationCommandProvider } from '../../../client/common/terminal/types';
import { ICurrentProcess, IPathUtils } from '../../../client/common/types';
import { InterpreterType, IPipEnvService } from '../../../client/interpreter/contracts';
import { VirtualEnvironmentManager } from '../../../client/interpreter/virtualEnvs';
import { IServiceContainer } from '../../../client/ioc/types';

// tslint:disable-next-line:max-func-body-length
suite('Virtual Environment Manager', () => {
    let process: TypeMoq.IMock<ICurrentProcess>;
    let processService: TypeMoq.IMock<IProcessService>;
    let pathUtils: TypeMoq.IMock<IPathUtils>;
    let virtualEnvMgr: VirtualEnvironmentManager;
    let fs: TypeMoq.IMock<IFileSystem>;
    let workspace: TypeMoq.IMock<IWorkspaceService>;
    let pipEnvService: TypeMoq.IMock<IPipEnvService>;
    let terminalActivation: TypeMoq.IMock<ITerminalActivationCommandProvider>;
    let platformService: TypeMoq.IMock<IPlatformService>;

    setup(() => {
        const serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        process = TypeMoq.Mock.ofType<ICurrentProcess>();
        processService = TypeMoq.Mock.ofType<IProcessService>();
        const processFactory = TypeMoq.Mock.ofType<IProcessServiceFactory>();
        pathUtils = TypeMoq.Mock.ofType<IPathUtils>();
        fs = TypeMoq.Mock.ofType<IFileSystem>();
        workspace = TypeMoq.Mock.ofType<IWorkspaceService>();
        pipEnvService = TypeMoq.Mock.ofType<IPipEnvService>();
        terminalActivation = TypeMoq.Mock.ofType<ITerminalActivationCommandProvider>();
        platformService = TypeMoq.Mock.ofType<IPlatformService>();

        processService.setup((p) => (p as any).then).returns(() => undefined);
        processFactory.setup((p) => p.create(TypeMoq.It.isAny())).returns(() => Promise.resolve(processService.object));
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IProcessServiceFactory)))
            .returns(() => processFactory.object);
        serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(ICurrentProcess))).returns(() => process.object);
        serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(IPathUtils))).returns(() => pathUtils.object);
        serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(IFileSystem))).returns(() => fs.object);
        serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(IWorkspaceService))).returns(() => workspace.object);
        serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(IPipEnvService))).returns(() => pipEnvService.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(ITerminalActivationCommandProvider), TypeMoq.It.isAny()))
            .returns(() => terminalActivation.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IPlatformService), TypeMoq.It.isAny()))
            .returns(() => platformService.object);

        virtualEnvMgr = new VirtualEnvironmentManager(serviceContainer.object);
    });

    test('Get PyEnv Root from PYENV_ROOT', async () => {
        process
            .setup((p) => p.env)
            .returns(() => {
                return { PYENV_ROOT: 'yes' };
            })
            .verifiable(TypeMoq.Times.once());

        const pyenvRoot = await virtualEnvMgr.getPyEnvRoot();

        process.verifyAll();
        expect(pyenvRoot).to.equal('yes');
    });

    test('Get PyEnv Root from current PYENV_ROOT', async () => {
        process
            .setup((p) => p.env)
            .returns(() => {
                return {};
            })
            .verifiable(TypeMoq.Times.once());
        processService
            .setup((p) => p.exec(TypeMoq.It.isValue('pyenv'), TypeMoq.It.isValue(['root'])))
            .returns(() => Promise.resolve({ stdout: 'PROC' }))
            .verifiable(TypeMoq.Times.once());

        const pyenvRoot = await virtualEnvMgr.getPyEnvRoot();

        process.verifyAll();
        processService.verifyAll();
        expect(pyenvRoot).to.equal('PROC');
    });

    test('Get default PyEnv Root path', async () => {
        process
            .setup((p) => p.env)
            .returns(() => {
                return {};
            })
            .verifiable(TypeMoq.Times.once());
        processService
            .setup((p) => p.exec(TypeMoq.It.isValue('pyenv'), TypeMoq.It.isValue(['root'])))
            .returns(() => Promise.resolve({ stdout: '', stderr: 'err' }))
            .verifiable(TypeMoq.Times.once());
        pathUtils
            .setup((p) => p.home)
            .returns(() => 'HOME')
            .verifiable(TypeMoq.Times.once());
        const pyenvRoot = await virtualEnvMgr.getPyEnvRoot();

        process.verifyAll();
        processService.verifyAll();
        expect(pyenvRoot).to.equal(path.join('HOME', '.pyenv'));
    });

    test('Get Environment Type, detects venv', async () => {
        const pythonPath = path.join('a', 'b', 'c', 'python');
        const dir = path.dirname(pythonPath);

        fs.setup((f) => f.fileExists(TypeMoq.It.isValue(path.join(dir, 'pyvenv.cfg'))))
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.once());

        const isRecognized = await virtualEnvMgr.isVenvEnvironment(pythonPath);

        expect(isRecognized).to.be.equal(true, 'invalid value');
        fs.verifyAll();
    });
    test('Get Environment Type, does not detect venv incorrectly', async () => {
        const pythonPath = path.join('a', 'b', 'c', 'python');
        const dir = path.dirname(pythonPath);

        fs.setup((f) => f.fileExists(TypeMoq.It.isValue(path.join(dir, 'pyvenv.cfg'))))
            .returns(() => Promise.resolve(false))
            .verifiable(TypeMoq.Times.once());

        const isRecognized = await virtualEnvMgr.isVenvEnvironment(pythonPath);

        expect(isRecognized).to.be.equal(false, 'invalid value');
        fs.verifyAll();
    });

    test('Get Environment Type, detects pyenv', async () => {
        const pythonPath = path.join('py-env-root', 'b', 'c', 'python');

        process
            .setup((p) => p.env)
            .returns(() => {
                return { PYENV_ROOT: path.join('py-env-root', 'b') };
            })
            .verifiable(TypeMoq.Times.once());

        const isRecognized = await virtualEnvMgr.isPyEnvEnvironment(pythonPath);

        expect(isRecognized).to.be.equal(true, 'invalid value');
        process.verifyAll();
    });

    test('Get Environment Type, does not detect pyenv incorrectly', async () => {
        const pythonPath = path.join('a', 'b', 'c', 'python');

        process
            .setup((p) => p.env)
            .returns(() => {
                return { PYENV_ROOT: path.join('py-env-root', 'b') };
            })
            .verifiable(TypeMoq.Times.once());

        const isRecognized = await virtualEnvMgr.isPyEnvEnvironment(pythonPath);

        expect(isRecognized).to.be.equal(false, 'invalid value');
        process.verifyAll();
    });

    test('Get Environment Type, detects pipenv', async () => {
        const pythonPath = path.join('x', 'b', 'c', 'python');
        workspace
            .setup((w) => w.hasWorkspaceFolders)
            .returns(() => true)
            .verifiable(TypeMoq.Times.atLeastOnce());
        const ws = [{ uri: Uri.file('x') }];
        workspace
            .setup((w) => w.workspaceFolders)
            .returns(() => ws as any)
            .verifiable(TypeMoq.Times.atLeastOnce());
        pipEnvService
            .setup((p) => p.isRelatedPipEnvironment(TypeMoq.It.isAny(), TypeMoq.It.isValue(pythonPath)))
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.once());

        const isRecognized = await virtualEnvMgr.isPipEnvironment(pythonPath);

        expect(isRecognized).to.be.equal(true, 'invalid value');
        workspace.verifyAll();
        pipEnvService.verifyAll();
    });

    test('Get Environment Type, does not detect pipenv incorrectly', async () => {
        const pythonPath = path.join('x', 'b', 'c', 'python');
        workspace
            .setup((w) => w.hasWorkspaceFolders)
            .returns(() => true)
            .verifiable(TypeMoq.Times.atLeastOnce());
        const ws = [{ uri: Uri.file('x') }];
        workspace
            .setup((w) => w.workspaceFolders)
            .returns(() => ws as any)
            .verifiable(TypeMoq.Times.atLeastOnce());
        pipEnvService
            .setup((p) => p.isRelatedPipEnvironment(TypeMoq.It.isAny(), TypeMoq.It.isValue(pythonPath)))
            .returns(() => Promise.resolve(false))
            .verifiable(TypeMoq.Times.once());

        const isRecognized = await virtualEnvMgr.isPipEnvironment(pythonPath);

        expect(isRecognized).to.be.equal(false, 'invalid value');
        workspace.verifyAll();
        pipEnvService.verifyAll();
    });

    for (const isWindows of [true, false]) {
        const testTitleSuffix = `(${isWindows ? 'On Windows' : 'Non-Windows'}})`;
        test(`Get Environment Type, detects virtualenv ${testTitleSuffix}`, async () => {
            const pythonPath = path.join('x', 'b', 'c', 'python');
            terminalActivation
                .setup((t) => t.isShellSupported(TypeMoq.It.isAny()))
                .returns(() => true)
                .verifiable(TypeMoq.Times.atLeastOnce());
            terminalActivation
                .setup((t) =>
                    t.getActivationCommandsForInterpreter!(TypeMoq.It.isValue(pythonPath), TypeMoq.It.isAny())
                )
                .returns(() => Promise.resolve(['1']))
                .verifiable(TypeMoq.Times.atLeastOnce());

            const isRecognized = await virtualEnvMgr.isVirtualEnvironment(pythonPath);

            expect(isRecognized).to.be.equal(true, 'invalid value');
            terminalActivation.verifyAll();
        });

        test(`Get Environment Type, does not detect virtualenv incorrectly ${testTitleSuffix}`, async () => {
            const pythonPath = path.join('x', 'b', 'c', 'python');
            terminalActivation
                .setup((t) => t.isShellSupported(TypeMoq.It.isAny()))
                .returns(() => true)
                .verifiable(TypeMoq.Times.atLeastOnce());
            terminalActivation
                .setup((t) =>
                    t.getActivationCommandsForInterpreter!(TypeMoq.It.isValue(pythonPath), TypeMoq.It.isAny())
                )
                .returns(() => Promise.resolve([]))
                .verifiable(TypeMoq.Times.atLeastOnce());

            let isRecognized = await virtualEnvMgr.isVirtualEnvironment(pythonPath);

            expect(isRecognized).to.be.equal(false, 'invalid value');
            terminalActivation.verifyAll();

            terminalActivation.reset();
            terminalActivation
                .setup((t) => t.isShellSupported(TypeMoq.It.isAny()))
                .returns(() => false)
                .verifiable(TypeMoq.Times.atLeastOnce());
            terminalActivation
                .setup((t) =>
                    t.getActivationCommandsForInterpreter!(TypeMoq.It.isValue(pythonPath), TypeMoq.It.isAny())
                )
                .returns(() => Promise.resolve([]))
                .verifiable(TypeMoq.Times.never());

            isRecognized = await virtualEnvMgr.isVirtualEnvironment(pythonPath);

            expect(isRecognized).to.be.equal(false, 'invalid value');
            terminalActivation.verifyAll();
        });
    }
    test('Get Environment Type, does not detect the type', async () => {
        const pythonPath = path.join('x', 'b', 'c', 'python');
        virtualEnvMgr.isPipEnvironment = () => Promise.resolve(false);
        virtualEnvMgr.isPyEnvEnvironment = () => Promise.resolve(false);
        virtualEnvMgr.isVenvEnvironment = () => Promise.resolve(false);
        virtualEnvMgr.isVirtualEnvironment = () => Promise.resolve(false);

        const envType = await virtualEnvMgr.getEnvironmentType(pythonPath);

        expect(envType).to.be.equal(InterpreterType.Unknown);
    });
});
