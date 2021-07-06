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
import { EnvironmentType, PythonEnvironment } from '../../../client/pythonEnvironments/info';

class AlwaysInstalledDataScienceInstaller extends DataScienceInstaller {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, class-methods-use-this
    public async isInstalled(product: Product, resource?: InterpreterUri): Promise<boolean> {
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
        testInstaller.setup((c) => c.name).returns(() => EnvironmentType.Conda);
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

        testInstaller.setup((c) => c.name).returns(() => 'Pip');
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

        testInstaller.setup((c) => c.name).returns(() => 'poetry');
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

        testInstaller.setup((c) => c.name).returns(() => 'pipenv');
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
});
