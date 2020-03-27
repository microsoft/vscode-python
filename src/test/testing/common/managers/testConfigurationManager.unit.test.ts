// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import * as TypeMoq from 'typemoq';
import { OutputChannel, Uri } from 'vscode';
import { IInstaller, IOutputChannel, Product } from '../../../../client/common/types';
import { getNamesAndValues } from '../../../../client/common/utils/enum';
import { IServiceContainer } from '../../../../client/ioc/types';
import { TEST_OUTPUT_CHANNEL, UNIT_TEST_PRODUCTS } from '../../../../client/testing/common/constants';
import { TestConfigurationManager } from '../../../../client/testing/common/managers/testConfigurationManager';
import { UnitTestProduct } from '../../../../client/testing/common/types';
import { ITestConfigSettingsService } from '../../../../client/testing/types';

class MockTestConfigurationManager extends TestConfigurationManager {
    public requiresUserToConfigure(_wkspace: Uri): Promise<boolean> {
        throw new Error('Method not implemented.');
    }
    public configure(_wkspace: any): Promise<any> {
        throw new Error('Method not implemented.');
    }
}

suite('Unit Test Configuration Manager (unit)', () => {
    UNIT_TEST_PRODUCTS.forEach((product) => {
        const prods = getNamesAndValues(Product);
        const productName = prods.filter((item) => item.value === product)[0];
        suite(productName.name, () => {
            const workspaceUri = Uri.file(__dirname);
            let manager: TestConfigurationManager;
            let configService: TypeMoq.IMock<ITestConfigSettingsService>;

            setup(() => {
                configService = TypeMoq.Mock.ofType<ITestConfigSettingsService>();
                const outputChannel = TypeMoq.Mock.ofType<OutputChannel>().object;
                const installer = TypeMoq.Mock.ofType<IInstaller>().object;
                const serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
                serviceContainer
                    .setup((s) => s.get(TypeMoq.It.isValue(IOutputChannel), TypeMoq.It.isValue(TEST_OUTPUT_CHANNEL)))
                    .returns(() => outputChannel);
                serviceContainer
                    .setup((s) => s.get(TypeMoq.It.isValue(ITestConfigSettingsService)))
                    .returns(() => configService.object);
                serviceContainer.setup((s) => s.get(TypeMoq.It.isValue(IInstaller))).returns(() => installer);
                manager = new MockTestConfigurationManager(
                    workspaceUri,
                    product as UnitTestProduct,
                    serviceContainer.object
                );
            });

            test('Enabling a test product shoud disable other products', async () => {
                UNIT_TEST_PRODUCTS.filter((item) => item !== product).forEach((productToDisable) => {
                    configService
                        .setup((c) => c.disable(TypeMoq.It.isValue(workspaceUri), TypeMoq.It.isValue(productToDisable)))
                        .returns(() => Promise.resolve(undefined))
                        .verifiable(TypeMoq.Times.once());
                });
                configService
                    .setup((c) => c.enable(TypeMoq.It.isValue(workspaceUri), TypeMoq.It.isValue(product)))
                    .returns(() => Promise.resolve(undefined))
                    .verifiable(TypeMoq.Times.once());

                await manager.enable();
                configService.verifyAll();
            });
        });
    });
});
