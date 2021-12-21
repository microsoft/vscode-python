// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { ConfigurationTarget } from 'vscode';
import { Product } from '../../client/common/installer/productInstaller';
import {
    FormatterProductPathService,
    LinterProductPathService,
    TestFrameworkProductPathService,
} from '../../client/common/installer/productPath';
import { ProductService } from '../../client/common/installer/productService';
import { IProductPathService, IProductService } from '../../client/common/installer/types';
import { IConfigurationService, ILintingSettings, ProductType } from '../../client/common/types';
import { LINTERID_BY_PRODUCT } from '../../client/linters/constants';
import { LinterManager } from '../../client/linters/linterManager';
import { ILinterManager } from '../../client/linters/types';
import { rootWorkspaceUri } from '../common';
import { closeActiveWindows, initialize, initializeTest, IS_MULTI_ROOT_TEST } from '../initialize';
import { UnitTestIocContainer } from '../testing/serviceRegistry';

suite('Linting Settings', () => {
    let ioc: UnitTestIocContainer;
    let linterManager: ILinterManager;
    let configService: IConfigurationService;

    suiteSetup(async () => {
        await initialize();
    });
    setup(async () => {
        await initializeDI();
        await initializeTest();
    });
    suiteTeardown(closeActiveWindows);
    teardown(async () => {
        await closeActiveWindows();
        await resetSettings();
        await ioc.dispose();
    });

    async function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes(false);
        ioc.registerProcessTypes();
        ioc.registerLinterTypes();
        ioc.registerVariableTypes();
        ioc.registerPlatformTypes();
        configService = ioc.serviceContainer.get<IConfigurationService>(IConfigurationService);
        linterManager = new LinterManager(configService);
        ioc.serviceManager.addSingletonInstance<IProductService>(IProductService, new ProductService());
        ioc.serviceManager.addSingleton<IProductPathService>(
            IProductPathService,
            FormatterProductPathService,
            ProductType.Formatter,
        );
        ioc.serviceManager.addSingleton<IProductPathService>(
            IProductPathService,
            LinterProductPathService,
            ProductType.Linter,
        );
        ioc.serviceManager.addSingleton<IProductPathService>(
            IProductPathService,
            TestFrameworkProductPathService,
            ProductType.TestFramework,
        );
    }

    async function resetSettings(lintingEnabled = true) {
        // Don't run these updates in parallel, as they are updating the same file.
        const target = IS_MULTI_ROOT_TEST ? ConfigurationTarget.WorkspaceFolder : ConfigurationTarget.Workspace;

        await configService.updateSetting('linting.enabled', lintingEnabled, rootWorkspaceUri, target);
        await configService.updateSetting('linting.lintOnSave', false, rootWorkspaceUri, target);

        linterManager.getAllLinterInfos().forEach(async (x) => {
            const settingKey = `linting.${x.enabledSettingName}`;
            await configService.updateSetting(settingKey, false, rootWorkspaceUri, target);
        });
    }

    test('enable through manager (global)', async () => {
        const settings = configService.getSettings();
        await resetSettings(false);

        await linterManager.enableLintingAsync(false);
        assert.strictEqual(settings.linting.enabled, false, 'mismatch');

        await linterManager.enableLintingAsync(true);
        assert.strictEqual(settings.linting.enabled, true, 'mismatch');
    });

    LINTERID_BY_PRODUCT.forEach((_, key) => {
        const product = Product[key];

        test(`enable through manager (${product})`, async () => {
            const settings = configService.getSettings();
            await resetSettings();

            const name = `${product}Enabled` as keyof ILintingSettings;

            assert.strictEqual(settings.linting[name], false, 'mismatch');

            await linterManager.setActiveLintersAsync([key]);

            assert.strictEqual(settings.linting[name], true, 'mismatch');
            linterManager.getAllLinterInfos().forEach(async (x) => {
                if (x.product !== key) {
                    assert.strictEqual(
                        settings.linting[x.enabledSettingName as keyof ILintingSettings],
                        false,
                        'mismatch',
                    );
                }
            });
        });
    });
});
