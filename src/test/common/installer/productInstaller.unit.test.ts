// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { IApplicationShell } from '../../../client/common/application/types';
import { DataScienceInstaller } from '../../../client/common/installer/productInstaller';
import { IInstallationChannelManager, IModuleInstaller, InterpreterUri } from '../../../client/common/installer/types';
import { InstallerResponse, IOutputChannel, Product } from '../../../client/common/types';
import { Architecture } from '../../../client/common/utils/platform';
import { IServiceContainer } from '../../../client/ioc/types';
import { EnvironmentType, ModuleInstallerType, PythonEnvironment } from '../../../client/pythonEnvironments/info';

class AlwaysInstalledDataScienceInstaller extends DataScienceInstaller {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, class-methods-use-this
    public async isInstalled(_product: Product, _resource?: InterpreterUri): Promise<boolean> {
        return true;
    }
}

suite('DataScienceInstaller install', async () => {
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let installationChannelManager: TypeMoq.IMock<IInstallationChannelManager>;
    let dataScienceInstaller: DataScienceInstaller;
    let outputChannel: TypeMoq.IMock<IOutputChannel>;
    let appShell: TypeMoq.IMock<IApplicationShell>;

    const interpreterPath = 'path/to/interpreter';

    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        installationChannelManager = TypeMoq.Mock.ofType<IInstallationChannelManager>();
        outputChannel = TypeMoq.Mock.ofType<IOutputChannel>();
        appShell = TypeMoq.Mock.ofType<IApplicationShell>();
        appShell.setup((a) => a.showErrorMessage(TypeMoq.It.isAnyString())).returns(() => Promise.resolve(undefined));
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IInstallationChannelManager)))
            .returns(() => installationChannelManager.object);

        serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(IApplicationShell))).returns(() => appShell.object);

        dataScienceInstaller = new AlwaysInstalledDataScienceInstaller(serviceContainer.object, outputChannel.object);
    });

    teardown(() => {
        // noop
    });

    test('Requires interpreter Uri', async () => {
        let threwUp = false;
        try {
            await dataScienceInstaller.install(Product.ipykernel);
        } catch (ex) {
            threwUp = true;
        }
        expect(threwUp).to.equal(true, 'Should raise exception');
    });

    test('Will ignore with no installer modules', async () => {
        const testEnvironment: PythonEnvironment = {
            envType: EnvironmentType.VirtualEnv,
            envName: 'test',
            envPath: interpreterPath,
            path: interpreterPath,
            architecture: Architecture.x64,
            sysPrefix: '',
        };
        installationChannelManager
            .setup((c) => c.getInstallationChannels(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve([]));
        const result = await dataScienceInstaller.install(Product.ipykernel, testEnvironment);
        expect(result).to.equal(InstallerResponse.Ignore, 'Should be InstallerResponse.Ignore');
    });

    test('Will invoke conda for conda environments', async () => {
        const testEnvironment: PythonEnvironment = {
            envType: EnvironmentType.Conda,
            envName: 'test',
            envPath: interpreterPath,
            path: interpreterPath,
            architecture: Architecture.x64,
            sysPrefix: '',
        };
        const testInstaller = TypeMoq.Mock.ofType<IModuleInstaller>();
        testInstaller.setup((c) => c.type).returns(() => ModuleInstallerType.Conda);
        testInstaller
            .setup((c) =>
                c.installModule(
                    TypeMoq.It.isValue(Product.ipykernel),
                    TypeMoq.It.isValue(testEnvironment),
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isAny(),
                ),
            )
            .returns(() => Promise.resolve());

        installationChannelManager
            .setup((c) => c.getInstallationChannels(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve([testInstaller.object]));

        const result = await dataScienceInstaller.install(Product.ipykernel, testEnvironment);
        expect(result).to.equal(InstallerResponse.Installed, 'Should be Installed');
    });

    test('Will invoke pip by default', async () => {
        const testEnvironment: PythonEnvironment = {
            envType: EnvironmentType.VirtualEnv,
            envName: 'test',
            envPath: interpreterPath,
            path: interpreterPath,
            architecture: Architecture.x64,
            sysPrefix: '',
        };
        const testInstaller = TypeMoq.Mock.ofType<IModuleInstaller>();

        testInstaller.setup((c) => c.type).returns(() => ModuleInstallerType.Pip);
        testInstaller
            .setup((c) =>
                c.installModule(
                    TypeMoq.It.isValue(Product.ipykernel),
                    TypeMoq.It.isValue(testEnvironment),
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isAny(),
                ),
            )
            .returns(() => Promise.resolve());

        installationChannelManager
            .setup((c) => c.getInstallationChannels(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve([testInstaller.object]));

        const result = await dataScienceInstaller.install(Product.ipykernel, testEnvironment);
        expect(result).to.equal(InstallerResponse.Installed, 'Should be Installed');
    });

    test('Will invoke poetry', async () => {
        const testEnvironment: PythonEnvironment = {
            envType: EnvironmentType.Poetry,
            envName: 'test',
            envPath: interpreterPath,
            path: interpreterPath,
            architecture: Architecture.x64,
            sysPrefix: '',
        };
        const testInstaller = TypeMoq.Mock.ofType<IModuleInstaller>();

        testInstaller.setup((c) => c.type).returns(() => ModuleInstallerType.Poetry);
        testInstaller
            .setup((c) =>
                c.installModule(
                    TypeMoq.It.isValue(Product.ipykernel),
                    TypeMoq.It.isValue(testEnvironment),
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isAny(),
                ),
            )
            .returns(() => Promise.resolve());

        installationChannelManager
            .setup((c) => c.getInstallationChannels(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve([testInstaller.object]));

        const result = await dataScienceInstaller.install(Product.ipykernel, testEnvironment);
        expect(result).to.equal(InstallerResponse.Installed, 'Should be Installed');
    });

    test('Will invoke pipenv', async () => {
        const testEnvironment: PythonEnvironment = {
            envType: EnvironmentType.Pipenv,
            envName: 'test',
            envPath: interpreterPath,
            path: interpreterPath,
            architecture: Architecture.x64,
            sysPrefix: '',
        };
        const testInstaller = TypeMoq.Mock.ofType<IModuleInstaller>();

        testInstaller.setup((c) => c.type).returns(() => ModuleInstallerType.Pipenv);
        testInstaller
            .setup((c) =>
                c.installModule(
                    TypeMoq.It.isValue(Product.ipykernel),
                    TypeMoq.It.isValue(testEnvironment),
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isAny(),
                ),
            )
            .returns(() => Promise.resolve());

        installationChannelManager
            .setup((c) => c.getInstallationChannels(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve([testInstaller.object]));

        const result = await dataScienceInstaller.install(Product.ipykernel, testEnvironment);
        expect(result).to.equal(InstallerResponse.Installed, 'Should be Installed');
    });

    test('Will invoke pip for pytorch with conda environment', async () => {
        // See https://github.com/microsoft/vscode-jupyter/issues/5034
        const testEnvironment: PythonEnvironment = {
            envType: EnvironmentType.Conda,
            envName: 'test',
            envPath: interpreterPath,
            path: interpreterPath,
            architecture: Architecture.x64,
            sysPrefix: '',
        };
        const testInstaller = TypeMoq.Mock.ofType<IModuleInstaller>();

        testInstaller.setup((c) => c.type).returns(() => ModuleInstallerType.Pip);
        testInstaller
            .setup((c) =>
                c.installModule(
                    TypeMoq.It.isValue(Product.torchProfilerInstallName),
                    TypeMoq.It.isValue(testEnvironment),
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isAny(),
                ),
            )
            .returns(() => Promise.resolve());

        installationChannelManager
            .setup((c) => c.getInstallationChannels(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve([testInstaller.object]));

        const result = await dataScienceInstaller.install(Product.torchProfilerInstallName, testEnvironment);
        expect(result).to.equal(InstallerResponse.Installed, 'Should be Installed');
    });
});
