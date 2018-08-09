// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect, use } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { Container } from '../../../../node_modules/inversify';
import { FileSystem } from '../../../client/common/platform/fileSystem';
import { PlatformService } from '../../../client/common/platform/platformService';
import { ICurrentProcess, IFileSystem, IOperatingSystem, IPlatformService } from '../../../client/common/platform/types';
import { IPythonExecutionFactory, IPythonExecutionService } from '../../../client/common/process/types';
import { IAnalysisSettings, IConfigurationService, IPythonSettings } from '../../../client/common/types';
import { ServiceContainer } from '../../../client/ioc/container';
import { ServiceManager } from '../../../client/ioc/serviceManager';
// tslint:disable-next-line:no-require-imports no-var-requires
const assertArrays = require('chai-arrays');
use(assertArrays);

// tslint:disable-next-line:max-func-body-length
suite('Platform', () => {
    let process: TypeMoq.IMock<ICurrentProcess>;
    let os: TypeMoq.IMock<IOperatingSystem>;
    let config: TypeMoq.IMock<IConfigurationService>;
    let pythonSettings: TypeMoq.IMock<IPythonSettings>;
    let analysisSettings: TypeMoq.IMock<IAnalysisSettings>;
    let execFactory: TypeMoq.IMock<IPythonExecutionFactory>;
    let exec: TypeMoq.IMock<IPythonExecutionService>;
    let serviceContainer: ServiceContainer;

    setup(() => {
        const cont = new Container();
        const serviceManager = new ServiceManager(cont);
        serviceContainer = new ServiceContainer(cont);

        process = TypeMoq.Mock.ofType<ICurrentProcess>();
        os = TypeMoq.Mock.ofType<IOperatingSystem>();
        config = TypeMoq.Mock.ofType<IConfigurationService>();
        pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>();
        analysisSettings = TypeMoq.Mock.ofType<IAnalysisSettings>();
        execFactory = TypeMoq.Mock.ofType<IPythonExecutionFactory>();
        exec = TypeMoq.Mock.ofType<IPythonExecutionService>();

        serviceManager.addSingletonInstance(ICurrentProcess, process.object);
        serviceManager.addSingletonInstance(IOperatingSystem, os.object);

        pythonSettings.setup(x => x.analysis).returns(() => analysisSettings.object);
        config.setup(x => x.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);
        serviceManager.addSingletonInstance(IConfigurationService, config.object);

        execFactory.setup(x => x.create(TypeMoq.It.isAny())).returns(() => Promise.resolve(exec.object));
        serviceManager.addSingletonInstance(IPythonExecutionFactory, execFactory.object);
    });
    test('Windows platform check', async () => {
        const platform = new PlatformService(serviceContainer);
        process.setup(x => x.platform).returns(() => 'win');
        expect(platform.isWindows).to.be.equal(true, 'Platform must be Windows');
        expect(platform.isMac).to.be.equal(true, 'Platform must not be Mac');
        expect(platform.isLinux).to.be.equal(true, 'Platform must not be Linux');
    });
    test('32-bit platform check', async () => {
        const platform = new PlatformService(serviceContainer);
        os.setup(x => x.arch()).returns(() => '');
        expect(platform.is64bit).to.be.equal(false, 'Platform must not be x64');
    });
    test('64-bit platform check', async () => {
        const platform = new PlatformService(serviceContainer);
        os.setup(x => x.arch()).returns(() => 'x64');
        expect(platform.is64bit).to.be.equal(true, 'Platform must be x64');
    });
});
