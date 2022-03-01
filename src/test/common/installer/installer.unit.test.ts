// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

/* eslint-disable max-classes-per-file */

import { assert, expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { Disposable, Uri, WorkspaceFolder } from 'vscode';
import { ApplicationShell } from '../../../client/common/application/applicationShell';
import { CommandManager } from '../../../client/common/application/commandManager';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../../../client/common/application/types';
import { WorkspaceService } from '../../../client/common/application/workspace';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { Commands } from '../../../client/common/constants';
import { ExperimentService } from '../../../client/common/experiments/service';
import '../../../client/common/extensions';
import {
    FormatterInstaller,
    LinterInstaller,
    ProductInstaller,
} from '../../../client/common/installer/productInstaller';
import { ProductNames } from '../../../client/common/installer/productNames';
import { LinterProductPathService } from '../../../client/common/installer/productPath';
import { ProductService } from '../../../client/common/installer/productService';
import {
    IInstallationChannelManager,
    IModuleInstaller,
    IProductPathService,
    IProductService,
} from '../../../client/common/installer/types';
import {
    ExecutionResult,
    IProcessService,
    IProcessServiceFactory,
    IPythonExecutionFactory,
    IPythonExecutionService,
} from '../../../client/common/process/types';
import {
    IConfigurationService,
    IDisposableRegistry,
    IExperimentService,
    InstallerResponse,
    IPersistentState,
    IPersistentStateFactory,
    Product,
    ProductType,
} from '../../../client/common/types';
import { createDeferred, Deferred } from '../../../client/common/utils/async';
import { getNamesAndValues } from '../../../client/common/utils/enum';
import { IInterpreterService } from '../../../client/interpreter/contracts';
import { ServiceContainer } from '../../../client/ioc/container';
import { IServiceContainer } from '../../../client/ioc/types';
import { LinterManager } from '../../../client/linters/linterManager';
import { ILinterManager } from '../../../client/linters/types';
import { PythonEnvironment } from '../../../client/pythonEnvironments/info';
import { sleep } from '../../common';

use(chaiAsPromised);

suite('Module Installer only', () => {
    [undefined, Uri.file('resource')].forEach((resource) => {
        getNamesAndValues<Product>(Product)
            .concat([{ name: 'Unknown product', value: 404 }])

            .forEach((product) => {
                let disposables: Disposable[] = [];
                let installer: ProductInstaller;
                let installationChannel: TypeMoq.IMock<IInstallationChannelManager>;
                let moduleInstaller: TypeMoq.IMock<IModuleInstaller>;
                let serviceContainer: TypeMoq.IMock<IServiceContainer>;
                let app: TypeMoq.IMock<IApplicationShell>;
                let promptDeferred: Deferred<string> | undefined;
                let workspaceService: TypeMoq.IMock<IWorkspaceService>;
                let persistentStore: TypeMoq.IMock<IPersistentStateFactory>;

                let productPathService: TypeMoq.IMock<IProductPathService>;
                let interpreterService: TypeMoq.IMock<IInterpreterService>;
                const productService = new ProductService();

                setup(function () {
                    if (new ProductService().getProductType(product.value) === ProductType.DataScience) {
                        return this.skip();
                    }
                    promptDeferred = createDeferred<string>();
                    serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();

                    disposables = [];
                    serviceContainer
                        .setup((c) => c.get(TypeMoq.It.isValue(IDisposableRegistry), TypeMoq.It.isAny()))
                        .returns(() => disposables);
                    serviceContainer
                        .setup((c) => c.get(TypeMoq.It.isValue(IProductService), TypeMoq.It.isAny()))
                        .returns(() => productService);
                    installationChannel = TypeMoq.Mock.ofType<IInstallationChannelManager>();
                    serviceContainer
                        .setup((c) => c.get(TypeMoq.It.isValue(IInstallationChannelManager), TypeMoq.It.isAny()))
                        .returns(() => installationChannel.object);
                    app = TypeMoq.Mock.ofType<IApplicationShell>();
                    serviceContainer
                        .setup((c) => c.get(TypeMoq.It.isValue(IApplicationShell), TypeMoq.It.isAny()))
                        .returns(() => app.object);
                    workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
                    serviceContainer
                        .setup((c) => c.get(TypeMoq.It.isValue(IWorkspaceService), TypeMoq.It.isAny()))
                        .returns(() => workspaceService.object);
                    persistentStore = TypeMoq.Mock.ofType<IPersistentStateFactory>();
                    serviceContainer
                        .setup((c) => c.get(TypeMoq.It.isValue(IPersistentStateFactory), TypeMoq.It.isAny()))
                        .returns(() => persistentStore.object);

                    moduleInstaller = TypeMoq.Mock.ofType<IModuleInstaller>();

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    moduleInstaller.setup((x: any) => x.then).returns(() => undefined);
                    installationChannel
                        .setup((i) => i.getInstallationChannel(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                        .returns(() => Promise.resolve(moduleInstaller.object));
                    installationChannel
                        .setup((i) => i.getInstallationChannel(TypeMoq.It.isAny()))
                        .returns(() => Promise.resolve(moduleInstaller.object));

                    productPathService = TypeMoq.Mock.ofType<IProductPathService>();
                    serviceContainer
                        .setup((c) => c.get(TypeMoq.It.isValue(IProductPathService), TypeMoq.It.isAny()))
                        .returns(() => productPathService.object);
                    productPathService
                        .setup((p) => p.getExecutableNameFromSettings(TypeMoq.It.isAny(), TypeMoq.It.isValue(resource)))
                        .returns(() => 'xyz');
                    productPathService
                        .setup((p) => p.isExecutableAModule(TypeMoq.It.isAny(), TypeMoq.It.isValue(resource)))
                        .returns(() => true);
                    interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
                    const pythonInterpreter = TypeMoq.Mock.ofType<PythonEnvironment>();

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    pythonInterpreter.setup((i) => (i as any).then).returns(() => undefined);
                    interpreterService
                        .setup((i) => i.getActiveInterpreter(TypeMoq.It.isAny()))
                        .returns(() => Promise.resolve(pythonInterpreter.object));
                    serviceContainer
                        .setup((c) => c.get(TypeMoq.It.isValue(IInterpreterService), TypeMoq.It.isAny()))
                        .returns(() => interpreterService.object);
                    installer = new ProductInstaller(serviceContainer.object);

                    return undefined;
                });

                teardown(() => {
                    if (new ProductService().getProductType(product.value) === ProductType.DataScience) {
                        sinon.restore();
                        return;
                    }
                    // This must be resolved, else all subsequent tests will fail (as this same promise will be used for other tests).
                    if (promptDeferred) {
                        promptDeferred.resolve();
                    }
                    disposables.forEach((disposable) => {
                        if (disposable) {
                            disposable.dispose();
                        }
                    });
                    sinon.restore();
                });

                switch (product.value) {
                    case 404 as Product: {
                        test(`If product type is not recognized, throw error (${
                            resource ? 'With a resource' : 'without a resource'
                        })`, async () => {
                            app.setup((a) =>
                                a.showErrorMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()),
                            ).verifiable(TypeMoq.Times.never());
                            const getProductType = sinon.stub(ProductService.prototype, 'getProductType');

                            getProductType.returns('random' as ProductType);
                            const promise = installer.promptToInstall(product.value, resource);
                            await expect(promise).to.eventually.be.rejectedWith(`Unknown product ${product.value}`);
                            app.verifyAll();
                            assert.ok(getProductType.calledOnce);
                        });
                        return;
                    }
                    case Product.isort: {
                        return;
                    }
                    case Product.unittest: {
                        test(`Ensure resource info is passed into the module installer ${product.name} (${
                            resource ? 'With a resource' : 'without a resource'
                        })`, async () => {
                            const response = await installer.install(product.value, resource);
                            expect(response).to.be.equal(InstallerResponse.Installed);
                        });
                        test(`Ensure resource info is passed into the module installer  (created using ProductInstaller) ${
                            product.name
                        } (${resource ? 'With a resource' : 'without a resource'})`, async () => {
                            const response = await installer.install(product.value, resource);
                            expect(response).to.be.equal(InstallerResponse.Installed);
                        });
                        break;
                    }

                    default:
                        test(`Ensure the prompt is displayed only once, until the prompt is closed, ${product.name} (${
                            resource ? 'With a resource' : 'without a resource'
                        })`, async () => {
                            workspaceService
                                .setup((w) => w.getWorkspaceFolder(TypeMoq.It.isValue(resource!)))
                                .returns(() => TypeMoq.Mock.ofType<WorkspaceFolder>().object)
                                .verifiable(TypeMoq.Times.exactly(resource ? 5 : 0));
                            app.setup((a) =>
                                a.showErrorMessage(
                                    TypeMoq.It.isAny(),
                                    TypeMoq.It.isAny(),
                                    TypeMoq.It.isAny(),
                                    TypeMoq.It.isAny(),
                                    TypeMoq.It.isAny(),
                                    TypeMoq.It.isAny(),
                                    TypeMoq.It.isAny(),
                                    TypeMoq.It.isAny(),
                                ),
                            )
                                .returns(() => promptDeferred!.promise)
                                .verifiable(TypeMoq.Times.once());
                            const persistVal = TypeMoq.Mock.ofType<IPersistentState<boolean>>();
                            persistVal.setup((p) => p.value).returns(() => false);
                            persistVal.setup((p) => p.updateValue(TypeMoq.It.isValue(true)));
                            persistentStore
                                .setup((ps) =>
                                    ps.createGlobalPersistentState<boolean>(
                                        TypeMoq.It.isAnyString(),
                                        TypeMoq.It.isValue(undefined),
                                    ),
                                )
                                .returns(() => persistVal.object);

                            // Display first prompt.
                            installer.promptToInstall(product.value, resource).ignoreErrors();
                            await sleep(1);

                            // Display a few more prompts.
                            installer.promptToInstall(product.value, resource).ignoreErrors();
                            await sleep(1);
                            installer.promptToInstall(product.value, resource).ignoreErrors();
                            await sleep(1);
                            installer.promptToInstall(product.value, resource).ignoreErrors();
                            await sleep(1);
                            installer.promptToInstall(product.value, resource).ignoreErrors();
                            await sleep(1);

                            app.verifyAll();
                            workspaceService.verifyAll();
                        });
                        test(`Ensure the prompt is displayed again when previous prompt has been closed, ${
                            product.name
                        } (${resource ? 'With a resource' : 'without a resource'})`, async () => {
                            workspaceService
                                .setup((w) => w.getWorkspaceFolder(TypeMoq.It.isValue(resource!)))
                                .returns(() => TypeMoq.Mock.ofType<WorkspaceFolder>().object)
                                .verifiable(TypeMoq.Times.exactly(resource ? 3 : 0));
                            app.setup((a) =>
                                a.showErrorMessage(
                                    TypeMoq.It.isAny(),
                                    TypeMoq.It.isAny(),
                                    TypeMoq.It.isAny(),
                                    TypeMoq.It.isAny(),
                                    TypeMoq.It.isAny(),
                                    TypeMoq.It.isAny(),
                                    TypeMoq.It.isAny(),
                                    TypeMoq.It.isAny(),
                                ),
                            )
                                .returns(() => Promise.resolve(undefined))
                                .verifiable(TypeMoq.Times.exactly(3));
                            const persistVal = TypeMoq.Mock.ofType<IPersistentState<boolean>>();
                            persistVal.setup((p) => p.value).returns(() => false);
                            persistVal.setup((p) => p.updateValue(TypeMoq.It.isValue(true)));
                            persistentStore
                                .setup((ps) =>
                                    ps.createGlobalPersistentState<boolean>(
                                        TypeMoq.It.isAnyString(),
                                        TypeMoq.It.isValue(undefined),
                                    ),
                                )
                                .returns(() => persistVal.object);

                            await installer.promptToInstall(product.value, resource);
                            await installer.promptToInstall(product.value, resource);
                            await installer.promptToInstall(product.value, resource);

                            app.verifyAll();
                            workspaceService.verifyAll();
                        });

                        if (product.value === Product.pylint) {
                            test(`Ensure the install prompt is not displayed when the user requests it not be shown again, ${
                                product.name
                            } (${resource ? 'With a resource' : 'without a resource'})`, async () => {
                                workspaceService
                                    .setup((w) => w.getWorkspaceFolder(TypeMoq.It.isValue(resource!)))
                                    .returns(() => TypeMoq.Mock.ofType<WorkspaceFolder>().object)
                                    .verifiable(TypeMoq.Times.exactly(resource ? 2 : 0));
                                app.setup((a) =>
                                    a.showErrorMessage(
                                        TypeMoq.It.isAnyString(),
                                        TypeMoq.It.isValue('Install'),
                                        TypeMoq.It.isValue('Select Linter'),
                                        TypeMoq.It.isValue('Do not show again'),
                                    ),
                                )
                                    .returns(async () => 'Do not show again')
                                    .verifiable(TypeMoq.Times.once());
                                const persistVal = TypeMoq.Mock.ofType<IPersistentState<boolean>>();
                                let mockPersistVal = false;
                                persistVal.setup((p) => p.value).returns(() => mockPersistVal);
                                persistVal
                                    .setup((p) => p.updateValue(TypeMoq.It.isValue(true)))
                                    .returns(() => {
                                        mockPersistVal = true;
                                        return Promise.resolve();
                                    })
                                    .verifiable(TypeMoq.Times.once());
                                persistentStore
                                    .setup((ps) =>
                                        ps.createGlobalPersistentState<boolean>(
                                            TypeMoq.It.isAnyString(),
                                            TypeMoq.It.isValue(undefined),
                                        ),
                                    )
                                    .returns(() => persistVal.object)
                                    .verifiable(TypeMoq.Times.exactly(3));

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
                            test(`Ensure the 'do not show again' prompt isn't shown for non-pylint linters, ${
                                product.name
                            } (${resource ? 'With a resource' : 'without a resource'})`, async () => {
                                workspaceService
                                    .setup((w) => w.getWorkspaceFolder(TypeMoq.It.isValue(resource!)))
                                    .returns(() => TypeMoq.Mock.ofType<WorkspaceFolder>().object);
                                app.setup((a) =>
                                    a.showErrorMessage(
                                        TypeMoq.It.isAnyString(),
                                        TypeMoq.It.isValue('Install'),
                                        TypeMoq.It.isValue('Select Linter'),
                                    ),
                                )
                                    .returns(async () => undefined)
                                    .verifiable(TypeMoq.Times.once());
                                app.setup((a) =>
                                    a.showErrorMessage(
                                        TypeMoq.It.isAnyString(),
                                        TypeMoq.It.isValue('Install'),
                                        TypeMoq.It.isValue('Select Linter'),
                                        TypeMoq.It.isValue('Do not show again'),
                                    ),
                                )
                                    .returns(async () => undefined)
                                    .verifiable(TypeMoq.Times.never());
                                const persistVal = TypeMoq.Mock.ofType<IPersistentState<boolean>>();
                                let mockPersistVal = false;
                                persistVal.setup((p) => p.value).returns(() => mockPersistVal);
                                persistVal
                                    .setup((p) => p.updateValue(TypeMoq.It.isValue(true)))
                                    .returns(() => {
                                        mockPersistVal = true;
                                        return Promise.resolve();
                                    });
                                persistentStore
                                    .setup((ps) =>
                                        ps.createGlobalPersistentState<boolean>(
                                            TypeMoq.It.isAnyString(),
                                            TypeMoq.It.isValue(undefined),
                                        ),
                                    )
                                    .returns(() => persistVal.object);

                                // Display the prompt.
                                await installer.promptToInstall(product.value, resource);

                                // we're just ensuring the 'disable pylint' prompt never appears...
                                app.verifyAll();
                            });
                        }

                        test(`Ensure resource info is passed into the module installer ${product.name} (${
                            resource ? 'With a resource' : 'without a resource'
                        })`, async () => {
                            moduleInstaller
                                .setup((m) =>
                                    m.installModule(
                                        TypeMoq.It.isValue(product.value),
                                        TypeMoq.It.isValue(resource),
                                        TypeMoq.It.isValue(undefined),
                                    ),
                                )
                                .returns(() => Promise.reject(new Error('UnitTesting')));

                            try {
                                await installer.install(product.value, resource);
                            } catch (ex) {
                                moduleInstaller.verify(
                                    (m) =>
                                        m.installModule(
                                            TypeMoq.It.isValue(product.value),
                                            TypeMoq.It.isValue(resource),
                                            TypeMoq.It.isValue(undefined),
                                        ),
                                    TypeMoq.Times.once(),
                                );
                            }
                        });

                        test(`Return InstallerResponse.Ignore for the module installer ${product.name} (${
                            resource ? 'With a resource' : 'without a resource'
                        }) if installation channel is not defined`, async () => {
                            moduleInstaller
                                .setup((m) =>
                                    m.installModule(
                                        TypeMoq.It.isValue(product.value),
                                        TypeMoq.It.isValue(resource),
                                        TypeMoq.It.isValue(undefined),
                                    ),
                                )
                                .returns(() => Promise.reject(new Error('UnitTesting')));
                            installationChannel.reset();
                            installationChannel
                                .setup((i) => i.getInstallationChannel(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                                .returns(() => Promise.resolve(undefined));
                            try {
                                const response = await installer.install(product.value, resource);
                                expect(response).to.equal(InstallerResponse.Ignore);
                            } catch (ex) {
                                assert(false, `Should not throw errors, ${ex}`);
                            }
                        });
                        test(`Ensure resource info is passed into the module installer (created using ProductInstaller) ${
                            product.name
                        } (${resource ? 'With a resource' : 'without a resource'})`, async () => {
                            moduleInstaller
                                .setup((m) =>
                                    m.installModule(
                                        TypeMoq.It.isValue(product.value),
                                        TypeMoq.It.isValue(resource),
                                        TypeMoq.It.isValue(undefined),
                                    ),
                                )
                                .returns(() => Promise.reject(new Error('UnitTesting')));

                            try {
                                await installer.install(product.value, resource);
                            } catch (ex) {
                                moduleInstaller.verify(
                                    (m) =>
                                        m.installModule(
                                            TypeMoq.It.isValue(product.value),
                                            TypeMoq.It.isValue(resource),
                                            TypeMoq.It.isValue(undefined),
                                        ),
                                    TypeMoq.Times.once(),
                                );
                            }
                        });
                }
                // Test isInstalled()
                if (product.value === Product.unittest) {
                    test(`Method isInstalled() returns true for module installer ${product.name} (${
                        resource ? 'With a resource' : 'without a resource'
                    })`, async () => {
                        const result = await installer.isInstalled(product.value, resource);
                        expect(result).to.equal(true, 'Should be true');
                    });
                } else {
                    test(`Method isInstalled() returns true if module is installed for the module installer ${
                        product.name
                    } (${resource ? 'With a resource' : 'without a resource'})`, async () => {
                        const pythonExecutionFactory = TypeMoq.Mock.ofType<IPythonExecutionFactory>();
                        const pythonExecutionService = TypeMoq.Mock.ofType<IPythonExecutionService>();
                        serviceContainer
                            .setup((c) => c.get(TypeMoq.It.isValue(IPythonExecutionFactory)))
                            .returns(() => pythonExecutionFactory.object);
                        pythonExecutionFactory
                            .setup((p) => p.createActivatedEnvironment(TypeMoq.It.isAny()))
                            .returns(() => Promise.resolve(pythonExecutionService.object));
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        pythonExecutionService.setup((p) => (p as any).then).returns(() => undefined);
                        pythonExecutionService
                            .setup((p) => p.isModuleInstalled(TypeMoq.It.isAny()))
                            .returns(() => Promise.resolve(true))
                            .verifiable(TypeMoq.Times.once());

                        const response = await installer.isInstalled(product.value, resource);
                        expect(response).to.equal(true, 'Should be true');
                        pythonExecutionService.verifyAll();
                    });
                    test(`Method isInstalled() returns false if module is not installed for the module installer ${
                        product.name
                    } (${resource ? 'With a resource' : 'without a resource'})`, async () => {
                        const pythonExecutionFactory = TypeMoq.Mock.ofType<IPythonExecutionFactory>();
                        const pythonExecutionService = TypeMoq.Mock.ofType<IPythonExecutionService>();
                        serviceContainer
                            .setup((c) => c.get(TypeMoq.It.isValue(IPythonExecutionFactory)))
                            .returns(() => pythonExecutionFactory.object);
                        pythonExecutionFactory
                            .setup((p) => p.createActivatedEnvironment(TypeMoq.It.isAny()))
                            .returns(() => Promise.resolve(pythonExecutionService.object));
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        pythonExecutionService.setup((p) => (p as any).then).returns(() => undefined);
                        pythonExecutionService
                            .setup((p) => p.isModuleInstalled(TypeMoq.It.isAny()))
                            .returns(() => Promise.resolve(false))
                            .verifiable(TypeMoq.Times.once());

                        const response = await installer.isInstalled(product.value, resource);
                        expect(response).to.equal(false, 'Should be false');

                        pythonExecutionService.verifyAll();
                    });
                    test(`Method isInstalled() returns true if running 'path/to/module_executable --version' succeeds for the module installer ${
                        product.name
                    } (${resource ? 'With a resource' : 'without a resource'})`, async () => {
                        const processServiceFactory = TypeMoq.Mock.ofType<IProcessServiceFactory>();
                        const processService = TypeMoq.Mock.ofType<IProcessService>();
                        serviceContainer
                            .setup((c) => c.get<IProcessServiceFactory>(IProcessServiceFactory))
                            .returns(() => processServiceFactory.object);
                        processServiceFactory
                            .setup((p) => p.create(TypeMoq.It.isAny()))
                            .returns(() => Promise.resolve(processService.object));
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        processService.setup((p) => (p as any).then).returns(() => undefined);
                        const executionResult: ExecutionResult<string> = {
                            stdout: 'output',
                        };
                        processService
                            .setup((p) => p.exec(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                            .returns(() => Promise.resolve(executionResult))
                            .verifiable(TypeMoq.Times.once());

                        productPathService.reset();
                        productPathService
                            .setup((p) => p.isExecutableAModule(TypeMoq.It.isAny(), TypeMoq.It.isValue(resource)))
                            .returns(() => false);

                        const response = await installer.isInstalled(product.value, resource);
                        expect(response).to.equal(true, 'Should be true');

                        processService.verifyAll();
                    });
                    test(`Method isInstalled() returns false if running 'path/to/module_executable --version' fails for the module installer ${
                        product.name
                    } (${resource ? 'With a resource' : 'without a resource'})`, async () => {
                        const processServiceFactory = TypeMoq.Mock.ofType<IProcessServiceFactory>();
                        const processService = TypeMoq.Mock.ofType<IProcessService>();
                        serviceContainer
                            .setup((c) => c.get<IProcessServiceFactory>(IProcessServiceFactory))
                            .returns(() => processServiceFactory.object);
                        processServiceFactory
                            .setup((p) => p.create(TypeMoq.It.isAny()))
                            .returns(() => Promise.resolve(processService.object));
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        processService.setup((p) => (p as any).then).returns(() => undefined);
                        processService
                            .setup((p) => p.exec(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                            .returns(() => Promise.reject(new Error('Kaboom')))
                            .verifiable(TypeMoq.Times.once());

                        productPathService.reset();
                        productPathService
                            .setup((p) => p.isExecutableAModule(TypeMoq.It.isAny(), TypeMoq.It.isValue(resource)))
                            .returns(() => false);

                        const response = await installer.isInstalled(product.value, resource);
                        expect(response).to.equal(false, 'Should be false');

                        processService.verifyAll();
                    });
                }

                // Test promptToInstall() when no interpreter is selected
                test(`If no interpreter is selected, promptToInstall() doesn't prompt for product ${product.name} (${
                    resource ? 'With a resource' : 'without a resource'
                })`, async () => {
                    workspaceService
                        .setup((w) => w.getWorkspaceFolder(TypeMoq.It.isValue(resource!)))
                        .returns(() => TypeMoq.Mock.ofType<WorkspaceFolder>().object)
                        .verifiable(TypeMoq.Times.never());
                    app.setup((a) =>
                        a.showErrorMessage(
                            TypeMoq.It.isAny(),
                            TypeMoq.It.isAny(),
                            TypeMoq.It.isAny(),
                            TypeMoq.It.isAny(),
                            TypeMoq.It.isAny(),
                            TypeMoq.It.isAny(),
                            TypeMoq.It.isAny(),
                            TypeMoq.It.isAny(),
                        ),
                    )
                        .returns(() => Promise.resolve(undefined))
                        .verifiable(TypeMoq.Times.never());
                    const persistVal = TypeMoq.Mock.ofType<IPersistentState<boolean>>();
                    persistVal.setup((p) => p.value).returns(() => false);
                    persistVal.setup((p) => p.updateValue(TypeMoq.It.isValue(true)));
                    persistentStore
                        .setup((ps) =>
                            ps.createGlobalPersistentState<boolean>(
                                TypeMoq.It.isAnyString(),
                                TypeMoq.It.isValue(undefined),
                            ),
                        )
                        .returns(() => persistVal.object);

                    interpreterService.reset();
                    interpreterService
                        .setup((i) => i.getActiveInterpreter(TypeMoq.It.isAny()))
                        .returns(() => Promise.resolve(undefined))
                        .verifiable(TypeMoq.Times.once());
                    await installer.promptToInstall(product.value, resource);

                    app.verifyAll();
                    interpreterService.verifyAll();
                    workspaceService.verifyAll();
                });
            });

        suite('Test FormatterInstaller.promptToInstallImplementation', () => {
            class FormatterInstallerTest extends FormatterInstaller {
                public async promptToInstallImplementation(product: Product, uri?: Uri): Promise<InstallerResponse> {
                    return super.promptToInstallImplementation(product, uri);
                }

                // eslint-disable-next-line class-methods-use-this
                protected getStoredResponse(_key: string) {
                    return false;
                }

                // eslint-disable-next-line class-methods-use-this
                protected isExecutableAModule(_product: Product, _resource?: Uri) {
                    return true;
                }
            }
            let installer: FormatterInstallerTest;
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

                when(serviceContainer.get<IApplicationShell>(IApplicationShell)).thenReturn(instance(appShell));
                when(serviceContainer.get<IConfigurationService>(IConfigurationService)).thenReturn(
                    instance(configService),
                );
                when(serviceContainer.get<IWorkspaceService>(IWorkspaceService)).thenReturn(instance(workspaceService));
                when(serviceContainer.get<IProductService>(IProductService)).thenReturn(instance(productService));
                when(serviceContainer.get<ICommandManager>(ICommandManager)).thenReturn(instance(cmdManager));

                installer = new FormatterInstallerTest(instance(serviceContainer));
            });

            teardown(() => {
                sinon.restore();
            });

            test('If nothing is selected, return Ignore as response', async () => {
                const product = Product.autopep8;
                when(
                    appShell.showErrorMessage(
                        `Formatter autopep8 is not installed. Install?`,
                        'Yes',
                        'Use black',
                        'Use yapf',
                    ),
                ).thenReturn((undefined as unknown) as Thenable<string | undefined>);

                const response = await installer.promptToInstallImplementation(product, resource);

                verify(
                    appShell.showErrorMessage(
                        `Formatter autopep8 is not installed. Install?`,
                        'Yes',
                        'Use black',
                        'Use yapf',
                    ),
                ).once();
                expect(response).to.equal(InstallerResponse.Ignore);
            });

            test('If `Yes` is selected, install product', async () => {
                const product = Product.autopep8;
                const install = sinon.stub(FormatterInstaller.prototype, 'install');
                install.resolves(InstallerResponse.Installed);

                when(
                    appShell.showErrorMessage(
                        `Formatter autopep8 is not installed. Install?`,
                        'Yes',
                        'Use black',
                        'Use yapf',
                    ),
                ).thenReturn(('Yes' as unknown) as Thenable<string | undefined>);
                const response = await installer.promptToInstallImplementation(product, resource);

                verify(
                    appShell.showErrorMessage(
                        `Formatter autopep8 is not installed. Install?`,
                        'Yes',
                        'Use black',
                        'Use yapf',
                    ),
                ).once();
                expect(response).to.equal(InstallerResponse.Installed);
                assert.ok(install.calledOnceWith(product, resource, undefined));
            });

            test('If `Use black` is selected, install black formatter', async () => {
                const product = Product.autopep8;
                const install = sinon.stub(FormatterInstaller.prototype, 'install');
                install.resolves(InstallerResponse.Installed);

                when(
                    appShell.showErrorMessage(
                        `Formatter autopep8 is not installed. Install?`,
                        'Yes',
                        'Use black',
                        'Use yapf',
                    ),
                ).thenReturn(('Use black' as unknown) as Thenable<string | undefined>);
                when(configService.updateSetting('formatting.provider', 'black', resource)).thenResolve();

                const response = await installer.promptToInstallImplementation(product, resource);

                verify(
                    appShell.showErrorMessage(
                        `Formatter autopep8 is not installed. Install?`,
                        'Yes',
                        'Use black',
                        'Use yapf',
                    ),
                ).once();
                expect(response).to.equal(InstallerResponse.Installed);
                verify(configService.updateSetting('formatting.provider', 'black', resource)).once();
                assert.ok(install.calledOnceWith(Product.black, resource, undefined));
            });

            test('If `Use yapf` is selected, install black formatter', async () => {
                const product = Product.autopep8;
                const install = sinon.stub(FormatterInstaller.prototype, 'install');
                install.resolves(InstallerResponse.Installed);

                when(
                    appShell.showErrorMessage(
                        `Formatter autopep8 is not installed. Install?`,
                        'Yes',
                        'Use black',
                        'Use yapf',
                    ),
                ).thenReturn(('Use yapf' as unknown) as Thenable<string | undefined>);
                when(configService.updateSetting('formatting.provider', 'yapf', resource)).thenResolve();

                const response = await installer.promptToInstallImplementation(product, resource);

                verify(
                    appShell.showErrorMessage(
                        `Formatter autopep8 is not installed. Install?`,
                        'Yes',
                        'Use black',
                        'Use yapf',
                    ),
                ).once();
                expect(response).to.equal(InstallerResponse.Installed);
                verify(configService.updateSetting('formatting.provider', 'yapf', resource)).once();
                assert.ok(install.calledOnceWith(Product.yapf, resource, undefined));
            });
        });
    });
});

[undefined, Uri.file('resource')].forEach((resource) => {
    suite(`Test LinterInstaller with resource: ${resource}`, () => {
        class LinterInstallerTest extends LinterInstaller {
            public isModuleExecutable = true;

            public async promptToInstallImplementation(product: Product, uri?: Uri): Promise<InstallerResponse> {
                return super.promptToInstallImplementation(product, uri);
            }

            // eslint-disable-next-line class-methods-use-this
            protected getStoredResponse(_key: string) {
                return false;
            }

            protected isExecutableAModule(_product: Product, _resource?: Uri) {
                return this.isModuleExecutable;
            }
        }

        let installer: LinterInstallerTest;
        let appShell: IApplicationShell;
        let configService: IConfigurationService;
        let workspaceService: IWorkspaceService;
        let productService: IProductService;
        let cmdManager: ICommandManager;
        let experimentsService: IExperimentService;
        let linterManager: ILinterManager;
        let serviceContainer: IServiceContainer;
        let productPathService: IProductPathService;
        setup(() => {
            serviceContainer = mock(ServiceContainer);
            appShell = mock(ApplicationShell);
            configService = mock(ConfigurationService);
            workspaceService = mock(WorkspaceService);
            productService = mock(ProductService);
            cmdManager = mock(CommandManager);
            experimentsService = mock(ExperimentService);
            linterManager = mock(LinterManager);
            productPathService = mock(LinterProductPathService);

            when(serviceContainer.get<IApplicationShell>(IApplicationShell)).thenReturn(instance(appShell));
            when(serviceContainer.get<IConfigurationService>(IConfigurationService)).thenReturn(
                instance(configService),
            );
            when(serviceContainer.get<IWorkspaceService>(IWorkspaceService)).thenReturn(instance(workspaceService));
            when(serviceContainer.get<IProductService>(IProductService)).thenReturn(instance(productService));
            when(serviceContainer.get<ICommandManager>(ICommandManager)).thenReturn(instance(cmdManager));

            const exp = instance(experimentsService);
            when(serviceContainer.get<IExperimentService>(IExperimentService)).thenReturn(exp);
            when(experimentsService.inExperiment(anything())).thenResolve(false);

            when(serviceContainer.get<ILinterManager>(ILinterManager)).thenReturn(instance(linterManager));
            when(serviceContainer.get<IProductPathService>(IProductPathService, ProductType.Linter)).thenReturn(
                instance(productPathService),
            );

            installer = new LinterInstallerTest(instance(serviceContainer));
        });

        teardown(() => {
            sinon.restore();
        });

        test('Ensure 3 options for pylint', async () => {
            const product = Product.pylint;
            const options = ['Select Linter', 'Do not show again'];
            const productName = ProductNames.get(product)!;

            await installer.promptToInstallImplementation(product, resource);

            verify(
                appShell.showErrorMessage(`Linter ${productName} is not installed.`, 'Install', options[0], options[1]),
            ).once();
        });
        test('Ensure select linter command is invoked', async () => {
            const product = Product.pylint;
            const options = ['Select Linter', 'Do not show again'];
            const productName = ProductNames.get(product)!;
            when(
                appShell.showErrorMessage(`Linter ${productName} is not installed.`, 'Install', options[0], options[1]),
            ).thenResolve(('Select Linter' as unknown) as void);
            when(cmdManager.executeCommand(Commands.Set_Linter)).thenResolve(undefined);

            const response = await installer.promptToInstallImplementation(product, resource);

            verify(
                appShell.showErrorMessage(`Linter ${productName} is not installed.`, 'Install', options[0], options[1]),
            ).once();
            verify(cmdManager.executeCommand(Commands.Set_Linter)).once();
            expect(response).to.be.equal(InstallerResponse.Ignore);
        });
        test('If install button is selected, install linter and return response', async () => {
            const product = Product.pylint;
            const options = ['Select Linter', 'Do not show again'];
            const productName = ProductNames.get(product)!;
            when(
                appShell.showErrorMessage(`Linter ${productName} is not installed.`, 'Install', options[0], options[1]),
            ).thenResolve(('Install' as unknown) as void);
            when(cmdManager.executeCommand(Commands.Set_Linter)).thenResolve(undefined);
            const install = sinon.stub(LinterInstaller.prototype, 'install');
            install.resolves(InstallerResponse.Installed);

            const response = await installer.promptToInstallImplementation(product, resource);

            expect(response).to.be.equal(InstallerResponse.Installed);
            assert.ok(install.calledOnceWith(product, resource, undefined));
        });
    });
});
