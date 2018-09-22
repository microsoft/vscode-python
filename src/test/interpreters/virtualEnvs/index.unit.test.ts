// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { expect } from 'chai';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { IProcessService, IProcessServiceFactory } from '../../../client/common/process/types';
import { ICurrentProcess, IPathUtils } from '../../../client/common/types';
import { VirtualEnvironmentManager } from '../../../client/interpreter/virtualEnvs';
import { IVirtualEnvironmentManager } from '../../../client/interpreter/virtualEnvs/types';
import { IServiceContainer } from '../../../client/ioc/types';

suite('Virtual Environment Manager', () => {
    let process: TypeMoq.IMock<ICurrentProcess>;
    let processService: TypeMoq.IMock<IProcessService>;
    let pathUtils: TypeMoq.IMock<IPathUtils>;
    let virtualEnvMgr: IVirtualEnvironmentManager;

    setup(() => {
        const serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        process = TypeMoq.Mock.ofType<ICurrentProcess>();
        processService = TypeMoq.Mock.ofType<IProcessService>();
        const processFactory = TypeMoq.Mock.ofType<IProcessServiceFactory>();
        pathUtils = TypeMoq.Mock.ofType<IPathUtils>();

        processService.setup(p => (p as any).then).returns(() => undefined);
        processFactory.setup(p => p.create(TypeMoq.It.isAny())).returns(() => Promise.resolve(processService.object));
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IProcessServiceFactory))).returns(() => processFactory.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(ICurrentProcess))).returns(() => process.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IPathUtils))).returns(() => pathUtils.object);

        virtualEnvMgr = new VirtualEnvironmentManager(serviceContainer.object);
    });

    test('Get PyEnv Root from PYENV_ROOT', async () => {
        process
            .setup(p => p.env)
            .returns(() => { return { PYENV_ROOT: 'yes' }; })
            .verifiable(TypeMoq.Times.once());

        const pyenvRoot = await virtualEnvMgr.getPyEnvRoot();

        process.verifyAll();
        expect(pyenvRoot).to.equal('yes');
    });

    test('Get PyEnv Root from current PYENV_ROOT', async () => {
        process
            .setup(p => p.env)
            .returns(() => { return {}; })
            .verifiable(TypeMoq.Times.once());
        processService
            .setup(p => p.exec(TypeMoq.It.isValue('pyenv'), TypeMoq.It.isValue(['root'])))
            .returns(() => Promise.resolve({ stdout: 'PROC' }))
            .verifiable(TypeMoq.Times.once());

        const pyenvRoot = await virtualEnvMgr.getPyEnvRoot();

        process.verifyAll();
        processService.verifyAll();
        expect(pyenvRoot).to.equal('PROC');
    });

    test('Get default PyEnv Root path', async () => {
        process
            .setup(p => p.env)
            .returns(() => { return {}; })
            .verifiable(TypeMoq.Times.once());
        processService
            .setup(p => p.exec(TypeMoq.It.isValue('pyenv'), TypeMoq.It.isValue(['root'])))
            .returns(() => Promise.resolve({ stdout: '', stderr: 'err' }))
            .verifiable(TypeMoq.Times.once());
        pathUtils
            .setup(p => p.home)
            .returns(() => 'HOME')
            .verifiable(TypeMoq.Times.once());
        const pyenvRoot = await virtualEnvMgr.getPyEnvRoot();

        process.verifyAll();
        processService.verifyAll();
        expect(pyenvRoot).to.equal(path.join('HOME', '.pyenv'));
    });
});
