// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { Uri } from 'vscode';
import { IFileSystem } from '../../../client/common/platform/types';
import { IProcessService } from '../../../client/common/process/types';
import { IConfigurationService, IPythonSettings } from '../../../client/common/types';
import { IEnvironmentVariablesProvider } from '../../../client/common/variables/types';
import { InterpreterVersionService } from '../../../client/interpreter/interpreterVersion';
import { IServiceContainer } from '../../../client/ioc/types';

// tslint:disable-next-line:max-func-body-length
suite('PythonExecutableService', () => {
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let configService: TypeMoq.IMock<IConfigurationService>;
    let procService: TypeMoq.IMock<IProcessService>;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        const envVarsProvider = TypeMoq.Mock.ofType<IEnvironmentVariablesProvider>();
        procService = TypeMoq.Mock.ofType<IProcessService>();
        configService = TypeMoq.Mock.ofType<IConfigurationService>();
        const fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        fileSystem.setup(f => f.fileExistsAsync(TypeMoq.It.isAny())).returns(() => Promise.resolve(false));
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IFileSystem))).returns(() => fileSystem.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IEnvironmentVariablesProvider))).returns(() => envVarsProvider.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IProcessService))).returns(() => procService.object);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IConfigurationService))).returns(() => configService.object);
        envVarsProvider.setup(v => v.getEnvironmentVariables(TypeMoq.It.isAny())).returns(() => Promise.resolve({}));

    });
    test('Ensure resource is used when getting configuration service settings (undefined resource)', async () => {
        const pythonPath = `Python_Path_${new Date().toString()}`;
        const pythonVersion = `Python_Version_${new Date().toString()}`;
        const pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>();
        pythonSettings.setup(p => p.pythonPath).returns(() => pythonPath);
        configService.setup(c => c.getSettings(TypeMoq.It.isValue(undefined))).returns(() => pythonSettings.object);
        procService.setup(p => p.exec(TypeMoq.It.isValue(pythonPath), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: pythonVersion }));

        const versionService = new InterpreterVersionService(procService.object);
        const version = await versionService.getVersion(pythonPath, '');

        expect(version).to.be.equal(pythonVersion);
    });
    test('Ensure resource is used when getting configuration service settings (defined resource)', async () => {
        const resource = Uri.file('abc');
        const pythonPath = `Python_Path_${new Date().toString()}`;
        const pythonVersion = `Python_Version_${new Date().toString()}`;
        const pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>();
        pythonSettings.setup(p => p.pythonPath).returns(() => pythonPath);
        configService.setup(c => c.getSettings(TypeMoq.It.isValue(resource))).returns(() => pythonSettings.object);
        procService.setup(p => p.exec(TypeMoq.It.isValue(pythonPath), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: pythonVersion }));

        const versionService = new InterpreterVersionService(procService.object);
        const version = await versionService.getVersion(pythonPath, '');

        expect(version).to.be.equal(pythonVersion);
    });
});
