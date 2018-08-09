// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { Container } from '../../../../node_modules/inversify';
import { NON_WINDOWS_PATH_VARIABLE_NAME, WINDOWS_PATH_VARIABLE_NAME } from '../../../client/common/platform/constants';
import { PlatformService } from '../../../client/common/platform/platformService';
import { IOperatingSystem, IPlatformService } from '../../../client/common/platform/types';
import { ExecutionResult, IProcessService, IProcessServiceFactory } from '../../../client/common/process/types';
import { IAnalysisSettings, IConfigurationService, ICurrentProcess, IPythonSettings } from '../../../client/common/types';
import { ServiceContainer } from '../../../client/ioc/container';
import { ServiceManager } from '../../../client/ioc/serviceManager';

// tslint:disable-next-line:max-func-body-length
suite('Platform', () => {
    let process: TypeMoq.IMock<ICurrentProcess>;
    let os: TypeMoq.IMock<IOperatingSystem>;
    let config: TypeMoq.IMock<IConfigurationService>;
    let pythonSettings: TypeMoq.IMock<IPythonSettings>;
    let analysisSettings: TypeMoq.IMock<IAnalysisSettings>;
    let execFactory: TypeMoq.IMock<IProcessServiceFactory>;
    let exec: TypeMoq.IMock<IProcessService>;
    let serviceManager: ServiceManager;
    let serviceContainer: ServiceContainer;

    setup(() => {
        const cont = new Container();
        serviceManager = new ServiceManager(cont);
        serviceContainer = new ServiceContainer(cont);

        process = TypeMoq.Mock.ofType<ICurrentProcess>();
        os = TypeMoq.Mock.ofType<IOperatingSystem>();
        config = TypeMoq.Mock.ofType<IConfigurationService>();
        pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>();
        analysisSettings = TypeMoq.Mock.ofType<IAnalysisSettings>();
        execFactory = TypeMoq.Mock.ofType<IProcessServiceFactory>();
        exec = TypeMoq.Mock.ofType<IProcessService>();

        pythonSettings.setup(x => x.analysis).returns(() => analysisSettings.object);
        config.setup(x => x.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);
        serviceManager.addSingletonInstance(IConfigurationService, config.object);

        execFactory.setup(x => x.create(TypeMoq.It.isAny())).returns(() => Promise.resolve(exec.object));
        serviceManager.addSingletonInstance(IProcessServiceFactory, execFactory.object);
    });
    test('Windows platform check', async () => {
        const platform = setupWindows();
        expect(platform.isWindows).to.be.equal(true, 'Platform must be Windows');
        expect(platform.isMac).to.be.equal(false, 'Platform must not be Mac');
        expect(platform.isLinux).to.be.equal(false, 'Platform must not be Linux');
    });
    test('Mac platform check', async () => {
        const platform = setupMac();
        expect(platform.isMac).to.be.equal(true, 'Platform must be Mac');
        expect(platform.isWindows).to.be.equal(false, 'Platform must not be Windows');
        expect(platform.isLinux).to.be.equal(false, 'Platform must not be Linux');
    });
    test('32-bit platform check', async () => {
        os.setup(x => x.arch()).returns(() => '');
        serviceManager.addSingletonInstance(IOperatingSystem, os.object);
        serviceManager.addSingletonInstance(ICurrentProcess, process.object);
        const platform = new PlatformService(serviceContainer);

        expect(platform.is64bit).to.be.equal(false, 'Platform must not be x64');
    });
    test('64-bit platform check', async () => {
        os.setup(x => x.arch()).returns(() => 'x64');
        serviceManager.addSingletonInstance(IOperatingSystem, os.object);
        serviceManager.addSingletonInstance(ICurrentProcess, process.object);
        const platform = new PlatformService(serviceContainer);

        expect(platform.is64bit).to.be.equal(true, 'Platform must be x64');
    });
    test('bin/scripts check (Windows)', async () => {
        const platform = setupWindows();
        expect(platform.virtualEnvBinName).to.be.equal('scripts', 'Venv bin must be scripts on Windows');
    });
    test('bin/scripts check (Mac/Linux)', async () => {
        const platform = setupMac();
        expect(platform.virtualEnvBinName).to.be.equal('bin', 'Venv bin must be scripts on Mac');
    });
    test('Path variable check (Windows)', async () => {
        const platform = setupWindows();
        expect(platform.pathVariableName).to.be.equal(WINDOWS_PATH_VARIABLE_NAME, 'Wrong path variable name on Windows');
    });
    test('Path variable check (Mac/Linux)', async () => {
        const platform = setupMac();
        expect(platform.pathVariableName).to.be.equal(NON_WINDOWS_PATH_VARIABLE_NAME, 'Wrong path variable name on Mac');
    });
    test('.NET Core compat (Windows)', async () => {
        const platform = setupWindows();
        expect(platform.isNetCoreCompatible()).to.eventually.be.equal('', 'Windows must be .NET Core compatible');
    });
    test('.NET Core compat (MacOS 10.12)', async () => {
        const platform = setupMac('16.1');
        expect(platform.isNetCoreCompatible()).to.eventually.be.equal('', 'Darwin 16.1 must be .NET Core compatible');
    });
    test('.NET Core compat (MacOS 10.13)', async () => {
        const platform = setupMac('17.0');
        expect(platform.isNetCoreCompatible()).to.eventually.be.equal('', 'Darwin 17.0 must be .NET Core compatible');
    });
    test('.NET Core compat (MacOS 10.11)', async () => {
        const platform = setupMac('15.1');
        expect(platform.isNetCoreCompatible()).to.eventually.be.equal('Microsoft Python Language Server does not support MacOS older than 10.12.', 'Darwin 15.1 must not be .NET Core compatible');
    });
    test('.NET Core compat (Ubuntu 18)', async () => {
        const platform = setupLinux('Description:\t\tUbuntu 18\nRelease:\t18.04');
        expect(platform.isNetCoreCompatible()).to.eventually.be.equal('', 'Ubuntu 18 must be .NET Core compatible');
    });
    test('.NET Core compat (Ubuntu 16)', async () => {
        const platform = setupLinux('Description:\t\tUbuntu 16\nRelease:\t16.04');
        expect(platform.isNetCoreCompatible()).to.eventually.be.equal('', 'Ubuntu 16 must be .NET Core compatible');
    });
    test('.NET Core compat (Ubuntu 14)', async () => {
        const platform = setupLinux('Description:\t\tUbuntu 14\nRelease:\t14.04');
        expect(platform.isNetCoreCompatible()).to.eventually.be.equal('', 'Ubuntu 14 must be .NET Core compatible');
    });
    test('.NET Core compat (Ubuntu 17)', async () => {
        const platform = setupLinux('Description:\t\tUbuntu 17\nRelease:\t17.04');
        expect(platform.isNetCoreCompatible()).to.eventually.be.equal('Microsoft Python Language Server only supports Ubuntu 18, 16 or 14.', 'Ubuntu 17 must be not .NET Core compatible');
    });

    function setupWindows(): IPlatformService {
        process.setup(x => x.platform).returns(() => 'win32');
        serviceManager.addSingletonInstance(ICurrentProcess, process.object);
        serviceManager.addSingletonInstance(IOperatingSystem, os.object);
        return new PlatformService(serviceContainer);
    }
    function setupMac(release?: string): IPlatformService {
        process.setup(x => x.platform).returns(() => 'darwin');
        serviceManager.addSingletonInstance(ICurrentProcess, process.object);
        if (release) {
            os.setup(x => x.release()).returns(() => release);
        }
        serviceManager.addSingletonInstance(IOperatingSystem, os.object);
        return new PlatformService(serviceContainer);
    }
    function setupLinux(version: string): IPlatformService {
        const output: ExecutionResult<string> = {
            stdout: version
        };
        exec.setup(x => x.exec(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(output));
        serviceManager.addSingletonInstance(ICurrentProcess, process.object);
        serviceManager.addSingletonInstance(IOperatingSystem, os.object);
        return new PlatformService(serviceContainer);
    }
});
