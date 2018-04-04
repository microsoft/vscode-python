// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as TypeMoq from 'typemoq';
import { Disposable, OutputChannel, Uri } from 'vscode';
import { EnumEx } from '../../../client/common/enumUtils';
import { ProductInstaller } from '../../../client/common/installer/productInstaller';
import { IInstallationChannelManager, IModuleInstaller } from '../../../client/common/installer/types';
import { IDisposableRegistry, ILogger, InstallerResponse, ModuleNamePurpose, Product } from '../../../client/common/types';
import { IServiceContainer } from '../../../client/ioc/types';

use(chaiAsPromised);

// tslint:disable-next-line:max-func-body-length
suite('Module Installer', () => {
    [undefined, Uri.file('resource')].forEach(resource => {
        EnumEx.getNamesAndValues<Product>(Product).forEach(product => {
            let disposables: Disposable[] = [];
            let installer: ProductInstaller;
            let installationChannel: TypeMoq.IMock<IInstallationChannelManager>;
            let moduleInstaller: TypeMoq.IMock<IModuleInstaller>;
            let serviceContainer: TypeMoq.IMock<IServiceContainer>;
            setup(() => {
                serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
                const outputChannel = TypeMoq.Mock.ofType<OutputChannel>();

                installer = new ProductInstaller(serviceContainer.object, outputChannel.object);

                disposables = [];
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IDisposableRegistry), TypeMoq.It.isAny())).returns(() => disposables);

                installationChannel = TypeMoq.Mock.ofType<IInstallationChannelManager>();
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IInstallationChannelManager), TypeMoq.It.isAny())).returns(() => installationChannel.object);

                moduleInstaller = TypeMoq.Mock.ofType<IModuleInstaller>();
                // tslint:disable-next-line:no-any
                moduleInstaller.setup((x: any) => x.then).returns(() => undefined);
                installationChannel.setup(i => i.getInstallationChannel(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(moduleInstaller.object));
                installationChannel.setup(i => i.getInstallationChannel(TypeMoq.It.isAny())).returns(() => Promise.resolve(moduleInstaller.object));
            });
            teardown(() => {
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
                }
            }
        });
    });
});
