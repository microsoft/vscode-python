// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as assert from 'assert';
import * as path from 'path';
import { ConfigurationTarget, Uri } from 'vscode';
import { WorkspaceService } from '../../client/common/application/workspace';
import { Product } from '../../client/common/installer/productInstaller';
import {
    CTagsProductPathService, FormatterProductPathService, LinterProductPathService,
    RefactoringLibraryProductPathService, TestFrameworkProductPathService
} from '../../client/common/installer/productPath';
import { ProductService } from '../../client/common/installer/productService';
import { IProductPathService, IProductService } from '../../client/common/installer/types';
import { IConfigurationService, ProductType } from '../../client/common/types';
import { LinterManager } from '../../client/linters/linterManager';
import { ILinterManager } from '../../client/linters/types';
import { rootWorkspaceUri } from '../common';
import { closeActiveWindows, initialize, initializeTest, IS_MULTI_ROOT_TEST } from '../initialize';
import { UnitTestIocContainer } from '../unittests/serviceRegistry';

const workspaceDir = path.join(__dirname, '..', '..', '..', 'src', 'test');
const workspaceUri = Uri.file(workspaceDir);

suite('Linting Settings', () => {
    let ioc: UnitTestIocContainer;
    let linterManager: ILinterManager;
    let configService: IConfigurationService;

    suiteSetup(async () => {
        await initialize();
    });
    setup(async () => {
        initializeDI();
        await initializeTest();
    });
    suiteTeardown(closeActiveWindows);
    teardown(async () => {
        await ioc.dispose();
        await closeActiveWindows();
        await resetSettings();
    });

    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes(false);
        ioc.registerProcessTypes();
        ioc.registerLinterTypes();
        ioc.registerVariableTypes();
        ioc.registerPlatformTypes();
        linterManager = new LinterManager(ioc.serviceContainer, new WorkspaceService());
        configService = ioc.serviceContainer.get<IConfigurationService>(IConfigurationService);
        ioc.serviceManager.addSingletonInstance<IProductService>(IProductService, new ProductService());
        ioc.serviceManager.addSingleton<IProductPathService>(IProductPathService, CTagsProductPathService, ProductType.WorkspaceSymbols);
        ioc.serviceManager.addSingleton<IProductPathService>(IProductPathService, FormatterProductPathService, ProductType.Formatter);
        ioc.serviceManager.addSingleton<IProductPathService>(IProductPathService, LinterProductPathService, ProductType.Linter);
        ioc.serviceManager.addSingleton<IProductPathService>(IProductPathService, TestFrameworkProductPathService, ProductType.TestFramework);
        ioc.serviceManager.addSingleton<IProductPathService>(IProductPathService, RefactoringLibraryProductPathService, ProductType.RefactoringLibrary);
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

    test('Linting settings (set/get)', async () => {
        const settings = configService.getSettings();

        // Don't run these updates in parallel, as they are updating the same file.
        const target = IS_MULTI_ROOT_TEST ? ConfigurationTarget.WorkspaceFolder : ConfigurationTarget.Workspace;

        await configService.updateSetting('linting.enabled', true, rootWorkspaceUri, target);
        assert.equal(settings.linting.enabled, true, 'mismatch');
        await configService.updateSetting('linting.enabled', false, rootWorkspaceUri, target);
        assert.equal(settings.linting.enabled, false, 'mismatch');

        await configService.updateSetting('linting.pylintUseMinimalCheckers', true, workspaceUri);
        assert.equal(settings.linting.pylintUseMinimalCheckers, true, 'mismatch');
        await configService.updateSetting('linting.pylintUseMinimalCheckers', false, workspaceUri);
        assert.equal(settings.linting.pylintUseMinimalCheckers, false, 'mismatch');

        linterManager.getAllLinterInfos().forEach(async (x) => {
            const settingKey = `linting.${x.enabledSettingName}`;
            await configService.updateSetting(settingKey, true, rootWorkspaceUri, target);
            assert.equal(settings.linting[x.enabledSettingName], true, 'mismatch');
            await configService.updateSetting(settingKey, false, rootWorkspaceUri, target);
            assert.equal(settings.linting[x.enabledSettingName], false, 'mismatch');
        });
    });

    test('enable through manager', async () => {
        const settings = configService.getSettings();
        await resetSettings(false);

        await linterManager.setActiveLintersAsync([Product.pylint]);
        await linterManager.enableLintingAsync(true);

        assert.equal(settings.linting.enabled, true, 'mismatch');
        assert.equal(settings.linting.pylintEnabled, true, 'mismatch');
        linterManager.getAllLinterInfos().forEach(async (x) => {
            if (x.product !== Product.pylint) {
                assert.equal(settings.linting[x.enabledSettingName], false, 'mismatch');
            }
        });
    });
});
