// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import * as TypeMoq from 'typemoq';
import { OutputChannel, Uri } from 'vscode';
import { IInstaller, IOutputChannel, Product } from '../../../../client/common/types';
import { IServiceContainer } from '../../../../client/ioc/types';
import { TEST_OUTPUT_CHANNEL } from '../../../../client/unittests/common/constants';
import { TestConfigurationManager } from '../../../../client/unittests/common/managers/testConfigurationManager';
import { ITestConfigSettingsService, UnitTestProduct } from '../../../../client/unittests/common/types';
import { getNamesAndValues } from '../../../../utils/enum';

class MockTestConfigurationManager extends TestConfigurationManager {
    public requiresUserToConfigure(wkspace: Uri): Promise<boolean> {
        throw new Error('Method not implemented.');
    }
    public configure(wkspace: any): Promise<any> {
        throw new Error('Method not implemented.');
    }
}

suite('Unit Test Configuration Manager (unit)', () => {
    [Product.pytest, Product.unittest, Product.nosetest].forEach(product => {
        const prods = getNamesAndValues(Product);
        const productName = prods.filter(item => item.value === product)[0];
        suite(productName.name, () => {
            const workspaceUri = Uri.file(__dirname);
            let manager: TestConfigurationManager;
            let configService: TypeMoq.IMock<ITestConfigSettingsService>;

            setup(() => {
                configService = TypeMoq.Mock.ofType<ITestConfigSettingsService>();
                const outputChannel = TypeMoq.Mock.ofType<OutputChannel>().object;
                const installer = TypeMoq.Mock.ofType<IInstaller>().object;
                const serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
                serviceContainer.setup(s => s.get(TypeMoq.It.isValue(IOutputChannel), TypeMoq.It.isValue(TEST_OUTPUT_CHANNEL))).returns(() => outputChannel);
                serviceContainer.setup(s => s.get(TypeMoq.It.isValue(ITestConfigSettingsService))).returns(() => configService.object);
                serviceContainer.setup(s => s.get(TypeMoq.It.isValue(IInstaller))).returns(() => installer);
                manager = new MockTestConfigurationManager(workspaceUri, product as UnitTestProduct, serviceContainer.object);
            });

            test('Enabling a test product shoud disable other products', async () => {
                const testProducsToDisable = [Product.pytest, Product.unittest, Product.nosetest]
                    .filter(item => item !== product) as UnitTestProduct[];
                testProducsToDisable.forEach(productToDisable => {
                    configService.setup(c => c.disable(TypeMoq.It.isValue(workspaceUri),
                        TypeMoq.It.isValue(productToDisable)))
                        .returns(() => Promise.resolve(undefined))
                        .verifiable(TypeMoq.Times.once());
                });
                configService.setup(c => c.enable(TypeMoq.It.isValue(workspaceUri),
                    TypeMoq.It.isValue(product as UnitTestProduct)))
                    .returns(() => Promise.resolve(undefined))
                    .verifiable(TypeMoq.Times.once());

                await manager.enable();
                configService.verifyAll();
            });
        });
    });
});
