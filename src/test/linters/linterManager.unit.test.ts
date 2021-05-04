// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import { expect } from 'chai';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { ApplicationShell } from '../../client/common/application/applicationShell';
import { CommandManager } from '../../client/common/application/commandManager';
import { DocumentManager } from '../../client/common/application/documentManager';
import {
    IApplicationShell,
    ICommandManager,
    IDocumentManager,
    IWorkspaceService,
} from '../../client/common/application/types';
import { WorkspaceService } from '../../client/common/application/workspace';
import { ConfigurationService } from '../../client/common/configuration/service';
import { ProductNames } from '../../client/common/installer/productNames';
import { ProductService } from '../../client/common/installer/productService';
import { IConfigurationService, Product, ProductType } from '../../client/common/types';
import { getNamesAndValues } from '../../client/common/utils/enum';
import { ServiceContainer } from '../../client/ioc/container';
import { LinterInfo } from '../../client/linters/linterInfo';
import { LinterManager } from '../../client/linters/linterManager';
import { LintingEngine } from '../../client/linters/lintingEngine';
import { ILinterInfo, ILintingEngine } from '../../client/linters/types';

suite('Linting - Linter Manager', () => {
    let linterManager: LinterManagerTest;
    let shell: IApplicationShell;
    let docManager: IDocumentManager;
    let cmdManager: ICommandManager;
    let lintingEngine: ILintingEngine;
    let configService: IConfigurationService;
    let workspaceService: IWorkspaceService;
    class LinterManagerTest extends LinterManager {
        // Override base class property to make it public.
        public linters!: ILinterInfo[];
    }
    setup(() => {
        const svcContainer = mock(ServiceContainer);
        shell = mock(ApplicationShell);
        docManager = mock(DocumentManager);
        cmdManager = mock(CommandManager);
        lintingEngine = mock(LintingEngine);
        configService = mock(ConfigurationService);
        workspaceService = mock(WorkspaceService);
        when(svcContainer.get<IApplicationShell>(IApplicationShell)).thenReturn(instance(shell));
        when(svcContainer.get<IDocumentManager>(IDocumentManager)).thenReturn(instance(docManager));
        when(svcContainer.get<ICommandManager>(ICommandManager)).thenReturn(instance(cmdManager));
        when(svcContainer.get<ILintingEngine>(ILintingEngine)).thenReturn(instance(lintingEngine));
        when(svcContainer.get<IConfigurationService>(IConfigurationService)).thenReturn(instance(configService));
        when(svcContainer.get<IWorkspaceService>(IWorkspaceService)).thenReturn(instance(workspaceService));
        linterManager = new LinterManagerTest(instance(configService));
    });

    test('Get all linters will return a list of all linters', () => {
        const linters = linterManager.getAllLinterInfos();

        expect(linters).to.be.lengthOf(8);

        const productService = new ProductService();
        const linterProducts = getNamesAndValues<Product>(Product)
            .filter((product) => productService.getProductType(product.value) === ProductType.Linter)
            .map((item) => ProductNames.get(item.value));
        expect(linters.map((item) => item.id).sort()).to.be.deep.equal(linterProducts.sort());
    });

    test('Get linter info for non-linter product should throw an exception', () => {
        const productService = new ProductService();
        getNamesAndValues<Product>(Product).forEach((prod) => {
            if (productService.getProductType(prod.value) === ProductType.Linter) {
                const info = linterManager.getLinterInfo(prod.value);
                expect(info.id).to.equal(ProductNames.get(prod.value));
                expect(info).not.to.be.equal(undefined, 'should not be unedfined');
            } else {
                expect(() => linterManager.getLinterInfo(prod.value)).to.throw();
            }
        });
    });
    test('Pylint configuration file watch', async () => {
        const pylint = linterManager.getLinterInfo(Product.pylint);
        assert.equal(pylint.configFileNames.length, 2, 'Pylint configuration file count is incorrect.');
        assert.notEqual(pylint.configFileNames.indexOf('pylintrc'), -1, 'Pylint configuration files miss pylintrc.');
        assert.notEqual(pylint.configFileNames.indexOf('.pylintrc'), -1, 'Pylint configuration files miss .pylintrc.');
    });

    [undefined, Uri.parse('something')].forEach((resource) => {
        const testResourceSuffix = `(${resource ? 'with a resource' : 'without a resource'})`;
        [true, false].forEach((enabled) => {
            const testSuffix = `(${enabled ? 'enable' : 'disable'}) & ${testResourceSuffix}`;
            test(`Enable linting should update config ${testSuffix}`, async () => {
                when(configService.updateSetting('linting.enabled', enabled, resource)).thenResolve();

                await linterManager.enableLintingAsync(enabled, resource);

                verify(configService.updateSetting('linting.enabled', enabled, resource)).once();
            });
        });
        test(`getActiveLinters will check if linter is enabled and in silent mode ${testResourceSuffix}`, async () => {
            const linterInfo = mock(LinterInfo);
            const instanceOfLinterInfo = instance(linterInfo);
            linterManager.linters = [instanceOfLinterInfo];
            when(linterInfo.isEnabled(resource)).thenReturn(true);

            const linters = await linterManager.getActiveLinters(resource);

            verify(linterInfo.isEnabled(resource)).once();
            expect(linters[0]).to.deep.equal(instanceOfLinterInfo);
        });

        test(`setActiveLintersAsync with invalid products does nothing ${testResourceSuffix}`, async () => {
            let getActiveLintersInvoked = false;
            linterManager.getActiveLinters = async () => {
                getActiveLintersInvoked = true;
                return [];
            };

            await linterManager.setActiveLintersAsync([Product.pytest], resource);

            expect(getActiveLintersInvoked).to.be.equal(false, 'Should not be invoked');
        });
        test(`setActiveLintersAsync with single product will disable it then enable it ${testResourceSuffix}`, async () => {
            const linterInfo = mock(LinterInfo);
            const instanceOfLinterInfo = instance(linterInfo);
            linterManager.linters = [instanceOfLinterInfo];
            when(linterInfo.product).thenReturn(Product.flake8);
            when(linterInfo.enableAsync(false, resource)).thenResolve();
            linterManager.getActiveLinters = () => Promise.resolve([instanceOfLinterInfo]);
            linterManager.enableLintingAsync = () => Promise.resolve();

            await linterManager.setActiveLintersAsync([Product.flake8], resource);

            verify(linterInfo.enableAsync(false, resource)).atLeast(1);
            verify(linterInfo.enableAsync(true, resource)).atLeast(1);
        });
        test(`setActiveLintersAsync with single product will disable all existing then enable the necessary two ${testResourceSuffix}`, async () => {
            const linters = new Map<Product, LinterInfo>();
            const linterInstances = new Map<Product, LinterInfo>();
            linterManager.linters = [];
            [Product.flake8, Product.mypy, Product.prospector, Product.bandit, Product.pydocstyle].forEach(
                (product) => {
                    const linterInfo = mock(LinterInfo);
                    const instanceOfLinterInfo = instance(linterInfo);
                    linterManager.linters.push(instanceOfLinterInfo);
                    linters.set(product, linterInfo);
                    linterInstances.set(product, instanceOfLinterInfo);
                    when(linterInfo.product).thenReturn(product);
                    when(linterInfo.enableAsync(anything(), resource)).thenResolve();
                },
            );

            linterManager.getActiveLinters = () => Promise.resolve(Array.from(linterInstances.values()));
            linterManager.enableLintingAsync = () => Promise.resolve();

            const lintersToEnable = [Product.flake8, Product.mypy, Product.pydocstyle];
            await linterManager.setActiveLintersAsync([Product.flake8, Product.mypy, Product.pydocstyle], resource);

            linters.forEach((item, product) => {
                verify(item.enableAsync(false, resource)).atLeast(1);
                if (lintersToEnable.indexOf(product) >= 0) {
                    verify(item.enableAsync(true, resource)).atLeast(1);
                }
            });
        });
    });
});
