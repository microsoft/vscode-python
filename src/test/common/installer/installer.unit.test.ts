// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:max-func-body-length no-invalid-this

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { instance, mock, verify, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { Disposable, OutputChannel, Uri, WorkspaceFolder } from 'vscode';
import { ApplicationShell } from '../../../client/common/application/applicationShell';
import { CommandManager } from '../../../client/common/application/commandManager';
// tslint:disable-next-line:ordered-imports
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../../../client/common/application/types';
import { WorkspaceService } from '../../../client/common/application/workspace';
import { ConfigurationService } from '../../../client/common/configuration/service';
// tslint:disable-next-line:ordered-imports
import { Commands } from '../../../client/common/constants';
import '../../../client/common/extensions';
import { LinterInstaller, ProductInstaller } from '../../../client/common/installer/productInstaller';
import { ProductNames } from '../../../client/common/installer/productNames';
import { ProductService } from '../../../client/common/installer/productService';
import {
    IInstallationChannelManager, IModuleInstaller, IProductPathService, IProductService
} from '../../../client/common/installer/types';
import {
    IConfigurationService, IDisposableRegistry, ILogger, InstallerResponse,
    IOutputChannel, IPersistentState, IPersistentStateFactory, ModuleNamePurpose, Product, ProductType
} from '../../../client/common/types';
import { createDeferred, Deferred } from '../../../client/common/utils/async';
import { getNamesAndValues } from '../../../client/common/utils/enum';
import { ServiceContainer } from '../../../client/ioc/container';
import { IServiceContainer } from '../../../client/ioc/types';

use(chaiAsPromised);

suite('Module Installer only', () => {
    [undefined, Uri.file('resource')].forEach(resource => {
        getNamesAndValues<Product>(Product).forEach(product => {
            let disposables: Disposable[] = [];
            let installer: ProductInstaller;
            let installationChannel: TypeMoq.IMock<IInstallationChannelManager>;
            let moduleInstaller: TypeMoq.IMock<IModuleInstaller>;
            let serviceContainer: TypeMoq.IMock<IServiceContainer>;
            let app: TypeMoq.IMock<IApplicationShell>;
            let promptDeferred: Deferred<string>;
            let workspaceService: TypeMoq.IMock<IWorkspaceService>;
            let persistentStore: TypeMoq.IMock<IPersistentStateFactory>;
            const productService = new ProductService();

            setup(() => {
                promptDeferred = createDeferred<string>();
                serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
                const outputChannel = TypeMoq.Mock.ofType<OutputChannel>();

                disposables = [];
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IDisposableRegistry), TypeMoq.It.isAny())).returns(() => disposables);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IProductService), TypeMoq.It.isAny())).returns(() => productService);
                installationChannel = TypeMoq.Mock.ofType<IInstallationChannelManager>();
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IInstallationChannelManager), TypeMoq.It.isAny())).returns(() => installationChannel.object);
                app = TypeMoq.Mock.ofType<IApplicationShell>();
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IApplicationShell), TypeMoq.It.isAny())).returns(() => app.object);
                workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IWorkspaceService), TypeMoq.It.isAny())).returns(() => workspaceService.object);
                persistentStore = TypeMoq.Mock.ofType<IPersistentStateFactory>();
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IPersistentStateFactory), TypeMoq.It.isAny())).returns(() => persistentStore.object);

                moduleInstaller = TypeMoq.Mock.ofType<IModuleInstaller>();
                // tslint:disable-next-line:no-any
                moduleInstaller.setup((x: any) => x.then).returns(() => undefined);
                installationChannel.setup(i => i.getInstallationChannel(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(moduleInstaller.object));
                installationChannel.setup(i => i.getInstallationChannel(TypeMoq.It.isAny())).returns(() => Promise.resolve(moduleInstaller.object));

                const productPathService = TypeMoq.Mock.ofType<IProductPathService>();
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IProductPathService), TypeMoq.It.isAny())).returns(() => productPathService.object);
                productPathService.setup(p => p.getExecutableNameFromSettings(TypeMoq.It.isAny(), TypeMoq.It.isValue(resource))).returns(() => 'xyz');
                productPathService.setup(p => p.isExecutableAModule(TypeMoq.It.isAny(), TypeMoq.It.isValue(resource))).returns(() => true);

                installer = new ProductInstaller(serviceContainer.object, outputChannel.object);
            });
            teardown(() => {
                // This must be resolved, else all subsequent tests will fail (as this same promise will be used for other tests).
                promptDeferred.resolve();
                disposables.forEach(disposable => {
                    if (disposable) {
                        disposable.dispose();
                    }
                });
            });

            switch (product.value) {
                case Product.isort:
                case Product.ctags: {
                    return;
                }
                case Product.unittest: {
                    test(`Ensure resource info is passed into the module installer ${product.name} (${resource ? 'With a resource' : 'without a resource'})`, async () => {
                        const response = await installer.install(product.value, resource);
                        expect(response).to.be.equal(InstallerResponse.Installed);
                    });
                    test(`Ensure resource info is passed into the module installer  (created using ProductInstaller) ${product.name} (${resource ? 'With a resource' : 'without a resource'})`, async () => {
                        const response = await installer.install(product.value, resource);
                        expect(response).to.be.equal(InstallerResponse.Installed);
                    });
                }
                default: {
                    test(`Ensure resource info is passed into the module installer ${product.name} (${resource ? 'With a resource' : 'without a resource'})`, async () => {
                        const moduleName = installer.translateProductToModuleName(product.value, ModuleNamePurpose.install);
                        const logger = TypeMoq.Mock.ofType<ILogger>();
                        logger.setup(l => l.logError(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => new Error('UnitTesting'));
                        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(ILogger), TypeMoq.It.isAny())).returns(() => logger.object);

                        moduleInstaller.setup(m => m.installModule(TypeMoq.It.isValue(moduleName), TypeMoq.It.isValue(resource))).returns(() => Promise.reject(new Error('UnitTesting')));

                        try {
                            await installer.install(product.value, resource);
                        } catch (ex) {
                            moduleInstaller.verify(m => m.installModule(TypeMoq.It.isValue(moduleName), TypeMoq.It.isValue(resource)), TypeMoq.Times.once());
                        }
                    });
                    test(`Ensure resource info is passed into the module installer (created using ProductInstaller) ${product.name} (${resource ? 'With a resource' : 'without a resource'})`, async () => {
                        const moduleName = installer.translateProductToModuleName(product.value, ModuleNamePurpose.install);
                        const logger = TypeMoq.Mock.ofType<ILogger>();
                        logger.setup(l => l.logError(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => new Error('UnitTesting'));
                        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(ILogger), TypeMoq.It.isAny())).returns(() => logger.object);

                        moduleInstaller.setup(m => m.installModule(TypeMoq.It.isValue(moduleName), TypeMoq.It.isValue(resource))).returns(() => Promise.reject(new Error('UnitTesting')));

                        try {
                            await installer.install(product.value, resource);
                        } catch (ex) {
                            moduleInstaller.verify(m => m.installModule(TypeMoq.It.isValue(moduleName), TypeMoq.It.isValue(resource)), TypeMoq.Times.once());
                        }
                    });
                    if (product.value !== Product.unittest) {
                        test(`Ensure the prompt is displayed only once, until the prompt is closed, ${product.name} (${resource ? 'With a resource' : 'without a resource'})`, async () => {
                            workspaceService.setup(w => w.getWorkspaceFolder(TypeMoq.It.isValue(resource!)))
                                .returns(() => TypeMoq.Mock.ofType<WorkspaceFolder>().object)
                                .verifiable(TypeMoq.Times.exactly(resource ? 5 : 0));
                            app.setup(a => a.showErrorMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                                .returns(
                                    () => {
                                        return promptDeferred.promise;
                                    })
                                .verifiable(TypeMoq.Times.once());
                            const persistVal = TypeMoq.Mock.ofType<IPersistentState<boolean>>();
                            persistVal.setup(p => p.value).returns(() => false);
                            persistVal.setup(p => p.updateValue(TypeMoq.It.isValue(true)));
                            persistentStore.setup(ps =>
                                ps.createGlobalPersistentState<boolean>(TypeMoq.It.isAnyString(), TypeMoq.It.isValue(undefined))
                            ).returns(() => persistVal.object);

                            // Display first prompt.
                            installer.promptToInstall(product.value, resource).ignoreErrors();

                            // Display a few more prompts.
                            installer.promptToInstall(product.value, resource).ignoreErrors();
                            installer.promptToInstall(product.value, resource).ignoreErrors();
                            installer.promptToInstall(product.value, resource).ignoreErrors();
                            installer.promptToInstall(product.value, resource).ignoreErrors();

                            app.verifyAll();
                            workspaceService.verifyAll();
                        });
                        if (product.value === Product.pylint) {
                            test(`Ensure the install prompt is not displayed when the user requests it not be shown again, ${product.name} (${resource ? 'With a resource' : 'without a resource'})`, async () => {
                                workspaceService.setup(w => w.getWorkspaceFolder(TypeMoq.It.isValue(resource!)))
                                    .returns(() => TypeMoq.Mock.ofType<WorkspaceFolder>().object)
                                    .verifiable(TypeMoq.Times.exactly(resource ? 2 : 0));
                                app.setup(a =>
                                    a.showErrorMessage(
                                        TypeMoq.It.isAnyString(),
                                        TypeMoq.It.isValue('Install'),
                                        TypeMoq.It.isValue('Select Linter'),
                                        TypeMoq.It.isValue('Do not show again')))
                                    .returns(
                                        async () => {
                                            return 'Do not show again';
                                        })
                                    .verifiable(TypeMoq.Times.once());
                                const persistVal = TypeMoq.Mock.ofType<IPersistentState<boolean>>();
                                let mockPersistVal = false;
                                persistVal.setup(p => p.value).returns(() => {
                                    return mockPersistVal;
                                });
                                persistVal.setup(p => p.updateValue(TypeMoq.It.isValue(true)))
                                    .returns(() => {
                                        mockPersistVal = true;
                                        return Promise.resolve();
                                    }).verifiable(TypeMoq.Times.once());
                                persistentStore.setup(ps =>
                                    ps.createGlobalPersistentState<boolean>(TypeMoq.It.isAnyString(), TypeMoq.It.isValue(undefined))
                                ).returns(() => {
                                    return persistVal.object;
                                }).verifiable(TypeMoq.Times.exactly(3));

                                // Display first prompt.
                                const initialResponse = await installer.promptToInstall(product.value, resource);

                                // Display a second prompt.
                                const secondResponse = await installer.promptToInstall(product.value, resource);

                                expect(initialResponse).to.be.equal(InstallerResponse.Ignore);
                                expect(secondResponse).to.be.equal(InstallerResponse.Ignore);

                                app.verifyAll();
                                workspaceService.verifyAll();
                                persistentStore.verifyAll();
                                persistVal.verifyAll();
                            });
                        } else if (productService.getProductType(product.value) === ProductType.Linter) {
                            test(`Ensure the 'do not show again' prompt isn't shown for non-pylint linters, ${product.name} (${resource ? 'With a resource' : 'without a resource'})`, async () => {
                                workspaceService.setup(w => w.getWorkspaceFolder(TypeMoq.It.isValue(resource!)))
                                    .returns(() => TypeMoq.Mock.ofType<WorkspaceFolder>().object);
                                app.setup(a =>
                                    a.showErrorMessage(
                                        TypeMoq.It.isAnyString(),
                                        TypeMoq.It.isValue('Install'),
                                        TypeMoq.It.isValue('Select Linter')))
                                    .returns(
                                        async () => {
                                            return undefined;
                                        })
                                    .verifiable(TypeMoq.Times.once());
                                app.setup(a =>
                                    a.showErrorMessage(
                                        TypeMoq.It.isAnyString(),
                                        TypeMoq.It.isValue('Install'),
                                        TypeMoq.It.isValue('Select Linter'),
                                        TypeMoq.It.isValue('Do not show again')))
                                    .returns(
                                        async () => {
                                            return undefined;
                                        })
                                    .verifiable(TypeMoq.Times.never());
                                const persistVal = TypeMoq.Mock.ofType<IPersistentState<boolean>>();
                                let mockPersistVal = false;
                                persistVal.setup(p => p.value).returns(() => {
                                    return mockPersistVal;
                                });
                                persistVal.setup(p => p.updateValue(TypeMoq.It.isValue(true)))
                                    .returns(() => {
                                        mockPersistVal = true;
                                        return Promise.resolve();
                                    });
                                persistentStore.setup(ps =>
                                    ps.createGlobalPersistentState<boolean>(TypeMoq.It.isAnyString(), TypeMoq.It.isValue(undefined))
                                ).returns(() => {
                                    return persistVal.object;
                                });

                                // Display the prompt.
                                await installer.promptToInstall(product.value, resource);

                                // we're just ensuring the 'disable pylint' prompt never appears...
                                app.verifyAll();
                            });
                        }
                        test(`Ensure the prompt is displayed again when previous prompt has been closed, ${product.name} (${resource ? 'With a resource' : 'without a resource'})`, async () => {
                            workspaceService.setup(w => w.getWorkspaceFolder(TypeMoq.It.isValue(resource!)))
                                .returns(() => TypeMoq.Mock.ofType<WorkspaceFolder>().object)
                                .verifiable(TypeMoq.Times.exactly(resource ? 3 : 0));
                            app.setup(a => a.showErrorMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                                .returns(() => Promise.resolve(undefined))
                                .verifiable(TypeMoq.Times.exactly(3));
                            const persistVal = TypeMoq.Mock.ofType<IPersistentState<boolean>>();
                            persistVal.setup(p => p.value).returns(() => false);
                            persistVal.setup(p => p.updateValue(TypeMoq.It.isValue(true)));
                            persistentStore.setup(ps =>
                                ps.createGlobalPersistentState<boolean>(TypeMoq.It.isAnyString(), TypeMoq.It.isValue(undefined))
                            ).returns(() => persistVal.object);

                            await installer.promptToInstall(product.value, resource);
                            await installer.promptToInstall(product.value, resource);
                            await installer.promptToInstall(product.value, resource);

                            app.verifyAll();
                            workspaceService.verifyAll();
                        });
                    }
                }
            }
        });

        suite('Test LinterInstaller.promptToInstallImplementation', () => {
            class LinterInstallerTest extends LinterInstaller {
                // tslint:disable-next-line:no-unnecessary-override
                public async promptToInstallImplementation(product: Product, uri?: Uri): Promise<InstallerResponse> {
                    return super.promptToInstallImplementation(product, uri);
                }
                protected getStoredResponse(_key: string) {
                    return false;
                }
                protected isExecutableAModule(_product: Product, _resource?: Uri) {
                    return true;
                }
            }
            let installer: LinterInstallerTest;
            let appShell: IApplicationShell;
            let configService: IConfigurationService;
            let workspaceService: IWorkspaceService;
            let productService: IProductService;
            let cmdManager: ICommandManager;
            setup(() => {
                const serviceContainer = mock(ServiceContainer);
                appShell = mock(ApplicationShell);
                configService = mock(ConfigurationService);
                workspaceService = mock(WorkspaceService);
                productService = mock(ProductService);
                cmdManager = mock(CommandManager);
                const outputChannel = TypeMoq.Mock.ofType<IOutputChannel>();

                when(serviceContainer.get<IApplicationShell>(IApplicationShell)).thenReturn(instance(appShell));
                when(serviceContainer.get<IConfigurationService>(IConfigurationService)).thenReturn(instance(configService));
                when(serviceContainer.get<IWorkspaceService>(IWorkspaceService)).thenReturn(instance(workspaceService));
                when(serviceContainer.get<IProductService>(IProductService)).thenReturn(instance(productService));
                when(serviceContainer.get<ICommandManager>(ICommandManager)).thenReturn(instance(cmdManager));

                installer = new LinterInstallerTest(instance(serviceContainer), outputChannel.object);
            });

            test('Ensure 3 options for pylint', async () => {
                const product = Product.pylint;
                const options = ['Select Linter', 'Do not show again'];
                const productName = ProductNames.get(product)!;
                await installer.promptToInstallImplementation(product, resource);
                verify(appShell.showErrorMessage(`Linter ${productName} is not installed.`, 'Install', options[0], options[1])).once();
            });
            test('Ensure select linter command is invoked', async () => {
                const product = Product.pylint;
                const options = ['Select Linter', 'Do not show again'];
                const productName = ProductNames.get(product)!;
                // tslint:disable-next-line:no-any
                when(appShell.showErrorMessage(`Linter ${productName} is not installed.`, 'Install', options[0], options[1])).thenResolve('Select Linter' as any);
                when(cmdManager.executeCommand(Commands.Set_Linter)).thenResolve(undefined);

                const response = await installer.promptToInstallImplementation(product, resource);

                verify(appShell.showErrorMessage(`Linter ${productName} is not installed.`, 'Install', options[0], options[1])).once();
                verify(cmdManager.executeCommand(Commands.Set_Linter)).once();
                expect(response).to.be.equal(InstallerResponse.Ignore);
            });
        });
    });
});
