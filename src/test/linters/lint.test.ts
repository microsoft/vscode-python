// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as assert from 'assert';
import * as path from 'path';
import { ConfigurationTarget, Uri } from 'vscode';
import { WorkspaceService } from '../../client/common/application/workspace';
import { Product } from '../../client/common/installer/productInstaller';
import {
    CTagsProductPathService,
    FormatterProductPathService,
    LinterProductPathService,
    RefactoringLibraryProductPathService,
    TestFrameworkProductPathService,
} from '../../client/common/installer/productPath';
import { ProductService } from '../../client/common/installer/productService';
import { IProductPathService, IProductService } from '../../client/common/installer/types';
import { IConfigurationService, ProductType } from '../../client/common/types';
import { LINTERID_BY_PRODUCT } from '../../client/linters/constants';
import { LinterManager } from '../../client/linters/linterManager';
import { ILinterManager } from '../../client/linters/types';
import { rootWorkspaceUri } from '../common';
import { closeActiveWindows, initialize, initializeTest, IS_MULTI_ROOT_TEST } from '../initialize';
import { UnitTestIocContainer } from '../testing/serviceRegistry';

const workspaceDir = path.join(__dirname, '..', '..', '..', 'src', 'test');
const workspaceUri = Uri.file(workspaceDir);

suite('Linting Settings', () => {
    let ioc: UnitTestIocContainer;
    let linterManager: ILinterManager;
    let configService: IConfigurationService;

    suiteSetup(async function () {
        // These tests are still consistently failing during teardown.
        // See https://github.com/Microsoft/vscode-python/issues/4326.

        this.skip();

        await initialize();
    });
    setup(async () => {
        await initializeDI();
        await initializeTest();
    });
    suiteTeardown(closeActiveWindows);
    teardown(async () => {
        await ioc.dispose();
        await closeActiveWindows();
        await resetSettings();
    });

    async function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes(false);
        ioc.registerProcessTypes();
        ioc.registerLinterTypes();
        ioc.registerVariableTypes();
        ioc.registerPlatformTypes();
        linterManager = new LinterManager(ioc.serviceContainer, new WorkspaceService());
        configService = ioc.serviceContainer.get<IConfigurationService>(IConfigurationService);
        ioc.serviceManager.addSingletonInstance<IProductService>(IProductService, new ProductService());
        ioc.serviceManager.addSingleton<IProductPathService>(
            IProductPathService,
            CTagsProductPathService,
            ProductType.WorkspaceSymbols,
        );
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
        ioc.serviceManager.addSingleton<IProductPathService>(
            IProductPathService,
            RefactoringLibraryProductPathService,
            ProductType.RefactoringLibrary,
        );
    }

    async function resetSettings(lintingEnabled = true) {
        // Don't run these updates in parallel, as they are updating the same file.
        const target = IS_MULTI_ROOT_TEST ? ConfigurationTarget.WorkspaceFolder : ConfigurationTarget.Workspace;

        await configService.updateSetting('linting.enabled', lintingEnabled, rootWorkspaceUri, target);
        await configService.updateSetting('linting.lintOnSave', false, rootWorkspaceUri, target);
        await configService.updateSetting('linting.pylintUseMinimalCheckers', false, workspaceUri);

        linterManager.getAllLinterInfos().forEach(async (x) => {
            const settingKey = `linting.${x.enabledSettingName}`;
            await configService.updateSetting(settingKey, false, rootWorkspaceUri, target);
        });
    }

    test('enable through manager (global)', async () => {
        const settings = configService.getSettings();
        await resetSettings(false);

        await linterManager.enableLintingAsync(false);
        assert.equal(settings.linting.enabled, false, 'mismatch');

        await linterManager.enableLintingAsync(true);
        assert.equal(settings.linting.enabled, true, 'mismatch');
    });

    for (const product of LINTERID_BY_PRODUCT.keys()) {
        test(`enable through manager (${Product[product]})`, async () => {
            const settings = configService.getSettings();
            await resetSettings();

            assert.equal((settings.linting as any)[`${Product[product]}Enabled`], false, 'mismatch');

            await linterManager.setActiveLintersAsync([product]);

            assert.equal((settings.linting as any)[`${Product[product]}Enabled`], true, 'mismatch');
            linterManager.getAllLinterInfos().forEach(async (x) => {
                if (x.product !== product) {
                    assert.equal((settings.linting as any)[x.enabledSettingName], false, 'mismatch');
                }
            });
        });
    }
});
