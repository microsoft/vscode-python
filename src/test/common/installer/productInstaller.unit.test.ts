// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import { IApplicationShell } from '../../../client/common/application/types';
import { DataScienceInstaller, FormatterInstaller } from '../../../client/common/installer/productInstaller';
import { ProductNames } from '../../../client/common/installer/productNames';
import {
    IInstallationChannelManager,
    IModuleInstaller,
    InterpreterUri,
    IProductPathService,
    IProductService,
} from '../../../client/common/installer/types';
import { InstallerResponse, IPersistentStateFactory, Product, ProductType } from '../../../client/common/types';
import { Common } from '../../../client/common/utils/localize';
import { Architecture } from '../../../client/common/utils/platform';
import { IServiceContainer } from '../../../client/ioc/types';
import { EnvironmentType, ModuleInstallerType, PythonEnvironment } from '../../../client/pythonEnvironments/info';
import { MockMemento } from '../../mocks/mementos';

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
    let appShell: TypeMoq.IMock<IApplicationShell>;

    const interpreterPath = 'path/to/interpreter';

    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        installationChannelManager = TypeMoq.Mock.ofType<IInstallationChannelManager>();
        appShell = TypeMoq.Mock.ofType<IApplicationShell>();
        appShell.setup((a) => a.showErrorMessage(TypeMoq.It.isAnyString())).returns(() => Promise.resolve(undefined));
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IInstallationChannelManager)))
            .returns(() => installationChannelManager.object);

        serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(IApplicationShell))).returns(() => appShell.object);

        dataScienceInstaller = new AlwaysInstalledDataScienceInstaller(serviceContainer.object);
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

suite('Formatter installer', async () => {
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    // let outputChannel: TypeMoq.IMock<IOutputChannel>;
    let appShell: TypeMoq.IMock<IApplicationShell>;
    let persistentStateFactory: TypeMoq.IMock<IPersistentStateFactory>;
    let productPathService: TypeMoq.IMock<IProductPathService>;
    // let isExecutableAsModuleStub: sinon.SinonStub;

    // constructor(protected serviceContainer: IServiceContainer, protected outputChannel: OutputChannel) {
    //     this.appShell = serviceContainer.get<IApplicationShell>(IApplicationShell);
    //     this.configService = serviceContainer.get<IConfigurationService>(IConfigurationService);
    //     this.workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
    //     this.productService = serviceContainer.get<IProductService>(IProductService);
    //     this.persistentStateFactory = serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
    // }

    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        // outputChannel = TypeMoq.Mock.ofType<IOutputChannel>();
        appShell = TypeMoq.Mock.ofType<IApplicationShell>();
        persistentStateFactory = TypeMoq.Mock.ofType<IPersistentStateFactory>();
        productPathService = TypeMoq.Mock.ofType<IProductPathService>();

        const installStub = sinon.stub(FormatterInstaller.prototype, 'install');
        installStub.returns(Promise.resolve(InstallerResponse.Installed));

        const productService = TypeMoq.Mock.ofType<IProductService>();
        productService.setup((p) => p.getProductType(TypeMoq.It.isAny())).returns(() => ProductType.Formatter);

        serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(IApplicationShell))).returns(() => appShell.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IPersistentStateFactory)))
            .returns(() => persistentStateFactory.object);
        serviceContainer.setup((c) => c.get(TypeMoq.It.isValue(IProductService))).returns(() => productService.object);
        serviceContainer
            .setup((c) => c.get(TypeMoq.It.isValue(IProductPathService), ProductType.Formatter))
            .returns(() => productPathService.object);
    });

    teardown(() => {
        sinon.restore();
    });

    // - if black not installed, offer autopep8 and yapf options
    // - if autopep8 not installed, offer black and yapf options
    // - if yapf not installed, offer black and autopep8 options
    // - if not executable as a module, display error message
    // - if never show again was set to true earlier, ignore
    // if never show again is selected, ignore

    test('If black is not installed, offer autopep8 and yapf as options', async () => {
        const messageOptions = [
            Common.bannerLabelYes,
            `Use ${ProductNames.get(Product.autopep8)!}`,
            `Use ${ProductNames.get(Product.yapf)!}`,
            Common.doNotShowAgain,
        ];

        appShell
            .setup((a) => a.showErrorMessage(TypeMoq.It.isAnyString(), ...messageOptions))
            .returns(() => Promise.resolve(Common.bannerLabelYes))
            .verifiable(TypeMoq.Times.once());
        productPathService
            .setup((p) => p.isExecutableAModule(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => true)
            .verifiable(TypeMoq.Times.once());
        persistentStateFactory
            .setup((p) => p.createGlobalPersistentState(TypeMoq.It.isAnyString(), false))
            .returns(() => ({
                value: false,
                updateValue: () => Promise.resolve(),
                storage: new MockMemento(),
            }));

        const formatterInstaller = new FormatterInstaller(serviceContainer.object);
        const result = await formatterInstaller.promptToInstall(Product.black);

        appShell.verifyAll();
        productPathService.verifyAll();
        assert.strictEqual(result, InstallerResponse.Installed);
    });

    test('If autopep8 is not installed, offer black and yapf as options', async () => {
        const messageOptions = [
            Common.bannerLabelYes,

            'Use {0}'.format(ProductNames.get(Product.black)!),
            'Use {0}'.format(ProductNames.get(Product.yapf)!),
            Common.doNotShowAgain,
        ];

        appShell
            .setup((a) => a.showErrorMessage(TypeMoq.It.isAnyString(), ...messageOptions))
            .returns(() => Promise.resolve(Common.bannerLabelYes))
            .verifiable(TypeMoq.Times.once());
        productPathService
            .setup((p) => p.isExecutableAModule(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => true)
            .verifiable(TypeMoq.Times.once());
        persistentStateFactory
            .setup((p) => p.createGlobalPersistentState(TypeMoq.It.isAnyString(), false))
            .returns(() => ({
                value: false,
                updateValue: () => Promise.resolve(),
                storage: new MockMemento(),
            }));

        const formatterInstaller = new FormatterInstaller(serviceContainer.object);
        const result = await formatterInstaller.promptToInstall(Product.autopep8);

        appShell.verifyAll();
        productPathService.verifyAll();
        assert.strictEqual(result, InstallerResponse.Installed);
    });

    test('If yapf is not installed, offer autopep8 and black as options', async () => {
        const messageOptions = [
            Common.bannerLabelYes,
            `Use ${ProductNames.get(Product.autopep8)!}`,
            `Use ${ProductNames.get(Product.black)!}`,
            Common.doNotShowAgain,
        ];

        appShell
            .setup((a) => a.showErrorMessage(TypeMoq.It.isAnyString(), ...messageOptions))
            .returns(() => Promise.resolve(Common.bannerLabelYes))
            .verifiable(TypeMoq.Times.once());
        productPathService
            .setup((p) => p.isExecutableAModule(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => true)
            .verifiable(TypeMoq.Times.once());
        persistentStateFactory
            .setup((p) => p.createGlobalPersistentState(TypeMoq.It.isAnyString(), false))
            .returns(() => ({
                value: false,
                updateValue: () => Promise.resolve(),
                storage: new MockMemento(),
            }));

        const formatterInstaller = new FormatterInstaller(serviceContainer.object);
        const result = await formatterInstaller.promptToInstall(Product.yapf);

        appShell.verifyAll();
        productPathService.verifyAll();
        assert.strictEqual(result, InstallerResponse.Installed);
    });

    test('If the formatter is not executable as a module, display an error message', async () => {
        const messageOptions = [
            `Use ${ProductNames.get(Product.autopep8)!}`,
            `Use ${ProductNames.get(Product.yapf)!}`,
            Common.doNotShowAgain,
        ];

        appShell
            .setup((a) => a.showErrorMessage(TypeMoq.It.isAnyString(), ...messageOptions))
            .returns(() => Promise.resolve(Common.bannerLabelYes))
            .verifiable(TypeMoq.Times.once());
        productPathService
            .setup((p) => p.isExecutableAModule(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => false)
            .verifiable(TypeMoq.Times.once());
        productPathService
            .setup((p) => p.getExecutableNameFromSettings(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => 'foo');
        persistentStateFactory
            .setup((p) => p.createGlobalPersistentState(TypeMoq.It.isAnyString(), false))
            .returns(() => ({
                value: false,
                updateValue: () => Promise.resolve(),
                storage: new MockMemento(),
            }));

        const formatterInstaller = new FormatterInstaller(serviceContainer.object);
        await formatterInstaller.promptToInstall(Product.black);

        appShell.verifyAll();
        productPathService.verifyAll();
    });

    test('If "Do not show again" has been selected earlier, do not display the prompt', async () => {
        const messageOptions = [
            Common.bannerLabelYes,
            `Use ${ProductNames.get(Product.autopep8)!}`,
            `Use ${ProductNames.get(Product.yapf)!}`,
            Common.doNotShowAgain,
        ];

        appShell
            .setup((a) => a.showErrorMessage(TypeMoq.It.isAnyString(), ...messageOptions))
            .returns(() => Promise.resolve(Common.bannerLabelYes))
            .verifiable(TypeMoq.Times.never());
        persistentStateFactory
            .setup((p) => p.createGlobalPersistentState(TypeMoq.It.isAnyString(), false))
            .returns(() => ({
                value: true,
                updateValue: () => Promise.resolve(),
                storage: new MockMemento(),
            }));

        const formatterInstaller = new FormatterInstaller(serviceContainer.object);
        const result = await formatterInstaller.promptToInstall(Product.black);

        appShell.verifyAll();
        assert.strictEqual(result, InstallerResponse.Ignore);
    });

    test('If "Do not show again" is selected, do not install the formatter and do not show the prompt again', async () => {
        let value = false;
        const messageOptions = [
            Common.bannerLabelYes,
            `Use ${ProductNames.get(Product.autopep8)!}`,
            `Use ${ProductNames.get(Product.yapf)!}`,
            Common.doNotShowAgain,
        ];

        appShell
            .setup((a) => a.showErrorMessage(TypeMoq.It.isAnyString(), ...messageOptions))
            .returns(() => Promise.resolve(Common.doNotShowAgain))
            .verifiable(TypeMoq.Times.once());
        productPathService
            .setup((p) => p.isExecutableAModule(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => true)
            .verifiable(TypeMoq.Times.once());

        persistentStateFactory
            .setup((p) => p.createGlobalPersistentState(TypeMoq.It.isAnyString(), false))
            .returns(() => ({
                value,
                updateValue: (newValue) => {
                    value = newValue;
                    return Promise.resolve();
                },
                storage: new MockMemento(),
            }));

        const formatterInstaller = new FormatterInstaller(serviceContainer.object);
        const result = await formatterInstaller.promptToInstall(Product.black);
        const resultTwo = await formatterInstaller.promptToInstall(Product.black);

        appShell.verifyAll();
        productPathService.verifyAll();
        assert.strictEqual(result, InstallerResponse.Ignore);
        assert.strictEqual(resultTwo, InstallerResponse.Ignore);
    });
});
