// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { OutputChannel, Uri } from 'vscode';
import { IApplicationShell, IWorkspaceService } from '../../../client/common/application/types';
import '../../../client/common/extensions';
import { ProductInstaller } from '../../../client/common/installer/productInstaller';
import { ProductService } from '../../../client/common/installer/productService';
import { IProductPathService, IProductService } from '../../../client/common/installer/types';
import { Product } from '../../../client/common/types';
import { IServiceContainer } from '../../../client/ioc/types';
import { getNamesAndValues } from '../../../utils/enum';

use(chaiAsPromised);

suite('Module Installer - Invalid Paths', () => {
    [undefined, Uri.file('resource')].forEach(resource => {
        ['moduleName', path.join('users', 'dev', 'tool', 'executable')].forEach(pathToExecutable => {
            const isExecutableAModule = path.basename(pathToExecutable) === pathToExecutable;

            getNamesAndValues<Product>(Product).forEach(product => {
                let installer: ProductInstaller;
                let serviceContainer: TypeMoq.IMock<IServiceContainer>;
                let app: TypeMoq.IMock<IApplicationShell>;
                let workspaceService: TypeMoq.IMock<IWorkspaceService>;
                let productPathService: TypeMoq.IMock<IProductPathService>;
                setup(() => {
                    serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
                    const outputChannel = TypeMoq.Mock.ofType<OutputChannel>();

                    serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IProductService), TypeMoq.It.isAny())).returns(() => new ProductService());
                    app = TypeMoq.Mock.ofType<IApplicationShell>();
                    serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IApplicationShell), TypeMoq.It.isAny())).returns(() => app.object);
                    workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
                    serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IWorkspaceService), TypeMoq.It.isAny())).returns(() => workspaceService.object);

                    productPathService = TypeMoq.Mock.ofType<IProductPathService>();
                    serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IProductPathService), TypeMoq.It.isAny())).returns(() => productPathService.object);

                    installer = new ProductInstaller(serviceContainer.object, outputChannel.object);
                });

                switch (product.value) {
                    case Product.isort:
                    case Product.ctags:
                    case Product.rope:
                    case Product.unittest: {
                        return;
                    }
                    default: {
                        test(`Ensure invalid path message is ${isExecutableAModule ? 'not displayed' : 'displayed'} ${product.name} (${resource ? 'With a resource' : 'without a resource'})`, async () => {
                            // If the path to executable is a module, then we won't display error message indicating path is invalid.

                            productPathService
                                .setup(p => p.getExecutableNameFromSettings(TypeMoq.It.isAny(), TypeMoq.It.isValue(resource)))
                                .returns(() => pathToExecutable)
                                .verifiable(TypeMoq.Times.atLeast(isExecutableAModule ? 0 : 1));
                            productPathService
                                .setup(p => p.isExecutableAModule(TypeMoq.It.isAny(), TypeMoq.It.isValue(resource)))
                                .returns(() => isExecutableAModule)
                                .verifiable(TypeMoq.Times.atLeastOnce());
                            const anyParams = [0, 1, 2, 3, 4, 5].map(() => TypeMoq.It.isAny());
                            app.setup(a => a.showErrorMessage(TypeMoq.It.isAny(), ...anyParams))
                                .callback(message => {
                                    if (!isExecutableAModule) {
                                        expect(message).contains(pathToExecutable);
                                    }
                                })
                                .returns(() => Promise.resolve(undefined))
                                .verifiable(TypeMoq.Times.exactly(1));

                            await installer.promptToInstall(product.value, resource);
                            productPathService.verifyAll();
                        });
                    }
                }
            });
        });
    });
});
