// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { fail } from 'assert';
import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as TypeMoq from 'typemoq';
import { OutputChannel, Uri } from 'vscode';
import '../../../client/common/extensions';
import { ProductInstaller } from '../../../client/common/installer/productInstaller';
import {
    BaseProductPathsService,
    FormatterProductPathService,
    LinterProductPathService,
    TestFrameworkProductPathService,
} from '../../../client/common/installer/productPath';
import { ProductService } from '../../../client/common/installer/productService';
import { IProductService } from '../../../client/common/installer/types';
import {
    IConfigurationService,
    IFormattingSettings,
    IInstaller,
    IPythonSettings,
    Product,
    ProductType,
} from '../../../client/common/types';
import { getNamesAndValues } from '../../../client/common/utils/enum';
import { IFormatterHelper } from '../../../client/formatters/types';
import { IServiceContainer } from '../../../client/ioc/types';
import { ILinterInfo, ILinterManager } from '../../../client/linters/types';
import { ITestsHelper } from '../../../client/testing/common/types';
import { ITestingSettings } from '../../../client/testing/configuration/types';

use(chaiAsPromised);

suite('Product Path', () => {
    [undefined, Uri.file('resource')].forEach((resource) => {
        getNamesAndValues<Product>(Product).forEach((product) => {
            class TestBaseProductPathsService extends BaseProductPathsService {
                public getExecutableNameFromSettings(_: Product, _resource?: Uri): string {
                    return '';
                }
            }
            let serviceContainer: TypeMoq.IMock<IServiceContainer>;
            let formattingSettings: TypeMoq.IMock<IFormattingSettings>;
            let unitTestSettings: TypeMoq.IMock<ITestingSettings>;
            let configService: TypeMoq.IMock<IConfigurationService>;
            let productInstaller: ProductInstaller;
            setup(function () {
                if (new ProductService().getProductType(product.value) === ProductType.DataScience) {
                    return this.skip();
                }
                serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
                configService = TypeMoq.Mock.ofType<IConfigurationService>();
                formattingSettings = TypeMoq.Mock.ofType<IFormattingSettings>();
                unitTestSettings = TypeMoq.Mock.ofType<ITestingSettings>();

                productInstaller = new ProductInstaller(
                    serviceContainer.object,
                    TypeMoq.Mock.ofType<OutputChannel>().object,
                );
                const pythonSettings = TypeMoq.Mock.ofType<IPythonSettings>();
                pythonSettings.setup((p) => p.formatting).returns(() => formattingSettings.object);
                pythonSettings.setup((p) => p.testing).returns(() => unitTestSettings.object);
                configService
                    .setup((s) => s.getSettings(TypeMoq.It.isValue(resource)))
                    .returns(() => pythonSettings.object);
                serviceContainer
                    .setup((s) => s.get(TypeMoq.It.isValue(IConfigurationService), TypeMoq.It.isAny()))
                    .returns(() => configService.object);
                serviceContainer
                    .setup((s) => s.get(TypeMoq.It.isValue(IInstaller), TypeMoq.It.isAny()))
                    .returns(() => productInstaller);
                serviceContainer
                    .setup((c) => c.get(TypeMoq.It.isValue(IProductService), TypeMoq.It.isAny()))
                    .returns(() => new ProductService());
            });

            if (product.value === Product.isort) {
                return;
            }
            suite('Method isExecutableAModule()', () => {
                test('Returns true if User has customized the executable name', () => {
                    productInstaller.translateProductToModuleName = () => 'moduleName';
                    const productPathService = new TestBaseProductPathsService(serviceContainer.object);
                    productPathService.getExecutableNameFromSettings = () => 'executableName';
                    expect(productPathService.isExecutableAModule(product.value)).to.equal(true, 'Should be true');
                });
                test('Returns false if User has customized the full path to executable', () => {
                    productInstaller.translateProductToModuleName = () => 'moduleName';
                    const productPathService = new TestBaseProductPathsService(serviceContainer.object);
                    productPathService.getExecutableNameFromSettings = () => 'path/to/executable';
                    expect(productPathService.isExecutableAModule(product.value)).to.equal(false, 'Should be false');
                });
                test('Returns false if translating product to module name fails with error', () => {
                    productInstaller.translateProductToModuleName = () => {
                        return new Error('Kaboom') as any;
                    };
                    const productPathService = new TestBaseProductPathsService(serviceContainer.object);
                    productPathService.getExecutableNameFromSettings = () => 'executableName';
                    expect(productPathService.isExecutableAModule(product.value)).to.equal(false, 'Should be false');
                });
            });
            const productType = new ProductService().getProductType(product.value);
            switch (productType) {
                case ProductType.Formatter: {
                    test(`Ensure path is returned for ${product.name} (${
                        resource ? 'With a resource' : 'without a resource'
                    })`, async () => {
                        const productPathService = new FormatterProductPathService(serviceContainer.object);
                        const formatterHelper = TypeMoq.Mock.ofType<IFormatterHelper>();
                        const expectedPath = 'Some Path';
                        serviceContainer
                            .setup((s) => s.get(TypeMoq.It.isValue(IFormatterHelper), TypeMoq.It.isAny()))
                            .returns(() => formatterHelper.object);
                        formattingSettings
                            .setup((f) => f.autopep8Path)
                            .returns(() => expectedPath)
                            .verifiable(TypeMoq.Times.atLeastOnce());
                        formatterHelper
                            .setup((f) => f.getSettingsPropertyNames(TypeMoq.It.isValue(product.value)))
                            .returns(() => {
                                return {
                                    pathName: 'autopep8Path',
                                    argsName: 'autopep8Args',
                                };
                            })
                            .verifiable(TypeMoq.Times.once());

                        const value = productPathService.getExecutableNameFromSettings(product.value, resource);
                        expect(value).to.be.equal(expectedPath);
                        formattingSettings.verifyAll();
                        formatterHelper.verifyAll();
                    });
                    break;
                }
                case ProductType.Linter: {
                    test(`Ensure path is returned for ${product.name} (${
                        resource ? 'With a resource' : 'without a resource'
                    })`, async () => {
                        const productPathService = new LinterProductPathService(serviceContainer.object);
                        const linterManager = TypeMoq.Mock.ofType<ILinterManager>();
                        const linterInfo = TypeMoq.Mock.ofType<ILinterInfo>();
                        const expectedPath = 'Some Path';
                        serviceContainer
                            .setup((s) => s.get(TypeMoq.It.isValue(ILinterManager), TypeMoq.It.isAny()))
                            .returns(() => linterManager.object);
                        linterInfo
                            .setup((l) => l.pathName(TypeMoq.It.isValue(resource)))
                            .returns(() => expectedPath)
                            .verifiable(TypeMoq.Times.once());
                        linterManager
                            .setup((l) => l.getLinterInfo(TypeMoq.It.isValue(product.value)))
                            .returns(() => linterInfo.object)
                            .verifiable(TypeMoq.Times.once());

                        const value = productPathService.getExecutableNameFromSettings(product.value, resource);
                        expect(value).to.be.equal(expectedPath);
                        linterInfo.verifyAll();
                        linterManager.verifyAll();
                    });
                    break;
                }
                case ProductType.TestFramework: {
                    test(`Ensure path is returned for ${product.name} (${
                        resource ? 'With a resource' : 'without a resource'
                    })`, async () => {
                        const productPathService = new TestFrameworkProductPathService(serviceContainer.object);
                        const testHelper = TypeMoq.Mock.ofType<ITestsHelper>();
                        const expectedPath = 'Some Path';
                        serviceContainer
                            .setup((s) => s.get(TypeMoq.It.isValue(ITestsHelper), TypeMoq.It.isAny()))
                            .returns(() => testHelper.object);
                        testHelper
                            .setup((t) => t.getSettingsPropertyNames(TypeMoq.It.isValue(product.value)))
                            .returns(() => {
                                return {
                                    argsName: 'autoTestDiscoverOnSaveEnabled',
                                    enabledName: 'autoTestDiscoverOnSaveEnabled',
                                    pathName: 'pytestPath',
                                };
                            })
                            .verifiable(TypeMoq.Times.once());
                        unitTestSettings
                            .setup((u) => u.pytestPath)
                            .returns(() => expectedPath)
                            .verifiable(TypeMoq.Times.atLeastOnce());

                        const value = productPathService.getExecutableNameFromSettings(product.value, resource);
                        expect(value).to.be.equal(expectedPath);
                        testHelper.verifyAll();
                        unitTestSettings.verifyAll();
                    });
                    test(`Ensure module name is returned for ${product.name} (${
                        resource ? 'With a resource' : 'without a resource'
                    })`, async () => {
                        const productPathService = new TestFrameworkProductPathService(serviceContainer.object);
                        const testHelper = TypeMoq.Mock.ofType<ITestsHelper>();
                        serviceContainer
                            .setup((s) => s.get(TypeMoq.It.isValue(ITestsHelper), TypeMoq.It.isAny()))
                            .returns(() => testHelper.object);
                        testHelper
                            .setup((t) => t.getSettingsPropertyNames(TypeMoq.It.isValue(product.value)))
                            .returns(() => {
                                return {
                                    argsName: 'autoTestDiscoverOnSaveEnabled',
                                    enabledName: 'autoTestDiscoverOnSaveEnabled',
                                    pathName: undefined,
                                };
                            })
                            .verifiable(TypeMoq.Times.once());

                        const value = productPathService.getExecutableNameFromSettings(product.value, resource);
                        const moduleName = productInstaller.translateProductToModuleName(product.value);
                        expect(value).to.be.equal(moduleName);
                        testHelper.verifyAll();
                    });
                    break;
                }
                default: {
                    test(`No tests for Product Path of this Product Type ${product.name}`, () => {
                        fail('No tests for Product Path of this Product Type');
                    });
                }
            }
        });
    });
});
