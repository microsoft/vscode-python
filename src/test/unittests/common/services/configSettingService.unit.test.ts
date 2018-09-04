// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length no-any

import { expect, use } from 'chai';
import * as chaiPromise from 'chai-as-promised';
import * as typeMoq from 'typemoq';
import { Uri, WorkspaceConfiguration, WorkspaceFolder } from 'vscode';
import { IWorkspaceService } from '../../../../client/common/application/types';
import { Product } from '../../../../client/common/types';
import { getNamesAndValues } from '../../../../client/common/utils/enum';
import { IServiceContainer } from '../../../../client/ioc/types';
import { TestConfigSettingsService } from '../../../../client/unittests/common/services/configSettingService';
import { ITestConfigSettingsService, UnitTestProduct } from '../../../../client/unittests/common/types';

use(chaiPromise);

const updateMethods: (keyof ITestConfigSettingsService)[] = ['updateTestArgs', 'disable', 'enable'];

suite('Unit Tests - ConfigSettingsService', () => {
    [Product.pytest, Product.unittest, Product.nosetest].forEach(prodItem => {
        const product = prodItem as any as UnitTestProduct;
        const prods = getNamesAndValues(Product);
        const productName = prods.filter(item => item.value === product)[0];
        const workspaceUri = Uri.file(__filename);
        updateMethods.forEach(updateMethod => {
            suite(`Test '${updateMethod}' method with ${productName.name}`, () => {
                let testConfigSettingsService: ITestConfigSettingsService;
                let workspaceService: typeMoq.IMock<IWorkspaceService>;
                setup(() => {
                    const serviceContainer = typeMoq.Mock.ofType<IServiceContainer>();
                    workspaceService = typeMoq.Mock.ofType<IWorkspaceService>();

                    serviceContainer.setup(c => c.get(typeMoq.It.isValue(IWorkspaceService))).returns(() => workspaceService.object);
                    testConfigSettingsService = new TestConfigSettingsService(serviceContainer.object);
                });
                function getTestArgSetting(prod: UnitTestProduct) {
                    switch (prod) {
                        case Product.unittest:
                            return 'unitTest.unittestArgs';
                        case Product.pytest:
                            return 'unitTest.pyTestArgs';
                        case Product.nosetest:
                            return 'unitTest.nosetestArgs';
                        default:
                            throw new Error('Invalid Test Product');
                    }
                }
                function getTestEnablingSetting(prod: UnitTestProduct) {
                    switch (prod) {
                        case Product.unittest:
                            return 'unitTest.unittestEnabled';
                        case Product.pytest:
                            return 'unitTest.pyTestEnabled';
                        case Product.nosetest:
                            return 'unitTest.nosetestsEnabled';
                        default:
                            throw new Error('Invalid Test Product');
                    }
                }
                function getExpectedValueAndSettings(): { configValue: any; configName: string } {
                    switch (updateMethod) {
                        case 'disable': {
                            return { configValue: false, configName: getTestEnablingSetting(product) };
                        }
                        case 'enable': {
                            return { configValue: true, configName: getTestEnablingSetting(product) };
                        }
                        case 'updateTestArgs': {
                            return { configValue: ['one', 'two', 'three'], configName: getTestArgSetting(product) };
                        }
                        default: {
                            throw new Error('Invalid Method');
                        }
                    }
                }
                test('Update Test Arguments with workspace Uri without workspaces', async () => {
                    workspaceService.setup(w => w.hasWorkspaceFolders)
                        .returns(() => false)
                        .verifiable(typeMoq.Times.atLeastOnce());

                    const pythonConfig = typeMoq.Mock.ofType<WorkspaceConfiguration>();
                    workspaceService.setup(w => w.getConfiguration(typeMoq.It.isValue('python')))
                        .returns(() => pythonConfig.object)
                        .verifiable(typeMoq.Times.once());

                    const { configValue, configName } = getExpectedValueAndSettings();

                    pythonConfig.setup(p => p.update(typeMoq.It.isValue(configName), typeMoq.It.isValue(configValue)))
                        .returns(() => Promise.resolve())
                        .verifiable(typeMoq.Times.once());

                    if (updateMethod === 'updateTestArgs') {
                        await testConfigSettingsService.updateTestArgs(workspaceUri, product, configValue);
                    } else {
                        await testConfigSettingsService[updateMethod](workspaceUri, product);
                    }
                    workspaceService.verifyAll();
                    pythonConfig.verifyAll();
                });
                test('Update Test Arguments with workspace Uri with one workspace', async () => {
                    workspaceService.setup(w => w.hasWorkspaceFolders)
                        .returns(() => true)
                        .verifiable(typeMoq.Times.atLeastOnce());

                    const workspaceFolder = typeMoq.Mock.ofType<WorkspaceFolder>();
                    workspaceFolder.setup(w => w.uri)
                        .returns(() => workspaceUri)
                        .verifiable(typeMoq.Times.atLeastOnce());
                    workspaceService.setup(w => w.workspaceFolders)
                        .returns(() => [workspaceFolder.object])
                        .verifiable(typeMoq.Times.atLeastOnce());

                    const pythonConfig = typeMoq.Mock.ofType<WorkspaceConfiguration>();
                    workspaceService.setup(w => w.getConfiguration(typeMoq.It.isValue('python'), typeMoq.It.isValue(workspaceUri)))
                        .returns(() => pythonConfig.object)
                        .verifiable(typeMoq.Times.once());

                    const { configValue, configName } = getExpectedValueAndSettings();
                    pythonConfig.setup(p => p.update(typeMoq.It.isValue(configName), typeMoq.It.isValue(configValue)))
                        .returns(() => Promise.resolve())
                        .verifiable(typeMoq.Times.once());

                    if (updateMethod === 'updateTestArgs') {
                        await testConfigSettingsService.updateTestArgs(workspaceUri, product, configValue);
                    } else {
                        await testConfigSettingsService[updateMethod](workspaceUri, product);
                    }

                    workspaceService.verifyAll();
                    pythonConfig.verifyAll();
                });
                test('Update Test Arguments with workspace Uri with more than one workspace and uri belongs to a workspace', async () => {
                    workspaceService.setup(w => w.hasWorkspaceFolders)
                        .returns(() => true)
                        .verifiable(typeMoq.Times.atLeastOnce());

                    const workspaceFolder = typeMoq.Mock.ofType<WorkspaceFolder>();
                    workspaceFolder.setup(w => w.uri)
                        .returns(() => workspaceUri)
                        .verifiable(typeMoq.Times.atLeastOnce());
                    workspaceService.setup(w => w.workspaceFolders)
                        .returns(() => [workspaceFolder.object, workspaceFolder.object])
                        .verifiable(typeMoq.Times.atLeastOnce());
                    workspaceService.setup(w => w.getWorkspaceFolder(typeMoq.It.isValue(workspaceUri)))
                        .returns(() => workspaceFolder.object)
                        .verifiable(typeMoq.Times.once());

                    const pythonConfig = typeMoq.Mock.ofType<WorkspaceConfiguration>();
                    workspaceService.setup(w => w.getConfiguration(typeMoq.It.isValue('python'), typeMoq.It.isValue(workspaceUri)))
                        .returns(() => pythonConfig.object)
                        .verifiable(typeMoq.Times.once());

                    const { configValue, configName } = getExpectedValueAndSettings();
                    pythonConfig.setup(p => p.update(typeMoq.It.isValue(configName), typeMoq.It.isValue(configValue)))
                        .returns(() => Promise.resolve())
                        .verifiable(typeMoq.Times.once());

                    if (updateMethod === 'updateTestArgs') {
                        await testConfigSettingsService.updateTestArgs(workspaceUri, product, configValue);
                    } else {
                        await testConfigSettingsService[updateMethod](workspaceUri, product);
                    }

                    workspaceService.verifyAll();
                    pythonConfig.verifyAll();
                });
                test('Expect an exception when updating Test Arguments with workspace Uri with more than one workspace and uri does not belong to a workspace', async () => {
                    workspaceService.setup(w => w.hasWorkspaceFolders)
                        .returns(() => true)
                        .verifiable(typeMoq.Times.atLeastOnce());

                    const workspaceFolder = typeMoq.Mock.ofType<WorkspaceFolder>();
                    workspaceFolder.setup(w => w.uri)
                        .returns(() => workspaceUri)
                        .verifiable(typeMoq.Times.atLeastOnce());
                    workspaceService.setup(w => w.workspaceFolders)
                        .returns(() => [workspaceFolder.object, workspaceFolder.object])
                        .verifiable(typeMoq.Times.atLeastOnce());
                    workspaceService.setup(w => w.getWorkspaceFolder(typeMoq.It.isValue(workspaceUri)))
                        .returns(() => undefined)
                        .verifiable(typeMoq.Times.once());

                    const { configValue } = getExpectedValueAndSettings();

                    const promise = testConfigSettingsService.updateTestArgs(workspaceUri, product, configValue);
                    expect(promise).to.eventually.rejectedWith();
                    workspaceService.verifyAll();
                });
            });
        });
    });
});
