// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:max-func-body-length no-any

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { Uri } from 'vscode';
import { IFileSystem } from '../../../client/common/platform/types';
import { IProcessService, IProcessServiceFactory } from '../../../client/common/process/types';
import { IConfigurationService, IPythonSettings } from '../../../client/common/types';
import { IEnvironmentVariablesProvider } from '../../../client/common/variables/types';
import { IEnvironmentActivationService } from '../../../client/interpreter/activation/types';
import { InterpreterVersionService } from '../../../client/interpreter/interpreterVersion';
import { IServiceContainer } from '../../../client/ioc/types';

suite('PythonExecutableService', () => {
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let configService: TypeMoq.IMock<IConfigurationService>;
    let procService: TypeMoq.IMock<IProcessService>;
    let procServiceFactory: TypeMoq.IMock<IProcessServiceFactory>;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        const envVarsProvider = TypeMoq.Mock.ofType<IEnvironmentVariablesProvider>();
        procServiceFactory = TypeMoq.Mock.ofType<IProcessServiceFactory>();
        procService = TypeMoq.Mock.ofType<IProcessService>();
        configService = TypeMoq.Mock.ofType<IConfigurationService>();
        const fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        fileSystem.setup((f) => f.fileExists(TypeMoq.It.isAny())).returns(() => Promise.resolve(false));
        serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(IFileSystem))).returns(() => fileSystem.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IEnvironmentVariablesProvider)))
            .returns(() => envVarsProvider.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IProcessServiceFactory)))
            .returns(() => procServiceFactory.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IConfigurationService)))
            .returns(() => configService.object);
        procService.setup((x: any) => x.then).returns(() => undefined);
        procServiceFactory
            .setup((p) => p.create(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(procService.object));
        envVarsProvider.setup((v) => v.getEnvironmentVariables(TypeMoq.It.isAny())).returns(() => Promise.resolve({}));

        const envActivationService = TypeMoq.Mock.ofType<IEnvironmentActivationService>();
        envActivationService
            .setup((e) => e.getActivatedEnvironmentVariables(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined));
        envActivationService
            .setup((e) => e.getActivatedEnvironmentVariables(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined));
        envActivationService
            .setup((e) =>
                e.getActivatedEnvironmentVariables(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()),
            )
            .returns(() => Promise.resolve(undefined));
        serviceContainer
            .setup((s) => s.get(TypeMoq.It.isValue(IEnvironmentActivationService), TypeMoq.It.isAny()))
            .returns(() => envActivationService.object);
    });
    test('Ensure resource is used when getting configuration service settings (undefined resource)', async () => {
        const pythonPath = `Python_Path_${new Date().toString()}`;
        const pythonVersion = `Python_Version_${new Date().toString()}`;
        const pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>();
        pythonSettings.setup((p) => p.pythonPath).returns(() => pythonPath);
        configService.setup((c) => c.getSettings(TypeMoq.It.isValue(undefined))).returns(() => pythonSettings.object);
        procService
            .setup((p) => p.exec(TypeMoq.It.isValue(pythonPath), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: pythonVersion }));

        const versionService = new InterpreterVersionService(procServiceFactory.object);
        const version = await versionService.getVersion(pythonPath, '');

        expect(version).to.be.equal(pythonVersion);
    });
    test('Ensure resource is used when getting configuration service settings (defined resource)', async () => {
        const resource = Uri.file('abc');
        const pythonPath = `Python_Path_${new Date().toString()}`;
        const pythonVersion = `Python_Version_${new Date().toString()}`;
        const pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>();
        pythonSettings.setup((p) => p.pythonPath).returns(() => pythonPath);
        configService.setup((c) => c.getSettings(TypeMoq.It.isValue(resource))).returns(() => pythonSettings.object);
        procService
            .setup((p) => p.exec(TypeMoq.It.isValue(pythonPath), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve({ stdout: pythonVersion }));

        const versionService = new InterpreterVersionService(procServiceFactory.object);
        const version = await versionService.getVersion(pythonPath, '');

        expect(version).to.be.equal(pythonVersion);
    });
});
