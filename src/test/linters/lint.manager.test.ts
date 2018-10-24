// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import { Container } from 'inversify';
import { ConfigurationService } from '../../client/common/configuration/service';
import { IConfigurationService, ILintingSettings, IPythonSettings, Product } from '../../client/common/types';
import * as EnumEx from '../../client/common/utils/enum';
import { ServiceContainer } from '../../client/ioc/container';
import { ServiceManager } from '../../client/ioc/serviceManager';
import { IServiceContainer } from '../../client/ioc/types';
import { LinterManager } from '../../client/linters/linterManager';
import { ILinterManager, LinterId } from '../../client/linters/types';
import { initialize } from '../initialize';

// tslint:disable-next-line:max-func-body-length
suite('Linting - Manager', () => {
    let lm: ILinterManager;
    let configService: IConfigurationService;
    let settings: IPythonSettings;

    suiteSetup(initialize);
    setup(async () => {
        const cont = new Container();
        const serviceManager = new ServiceManager(cont);
        const serviceContainer = new ServiceContainer(cont);
        serviceManager.addSingletonInstance<IServiceContainer>(IServiceContainer, serviceContainer);

        serviceManager.addSingleton<IConfigurationService>(IConfigurationService, ConfigurationService);
        configService = serviceManager.get<IConfigurationService>(IConfigurationService);

        settings = configService.getSettings();
        lm = new LinterManager(serviceContainer);

        await lm.setActiveLintersAsync([Product.pylint]);
        await lm.enableLintingAsync(true);
    });

    test('Ensure product is set in Execution Info', async () => {
        [Product.bandit, Product.flake8, Product.mypy, Product.pep8,
        Product.pydocstyle, Product.pylama, Product.pylint].forEach(product => {
            const execInfo = lm.getLinterInfo(product).getExecutionInfo([]);
            assert.equal(execInfo.product, product, `Incorrect information for ${product}`);
        });
    });

    test('Ensure executable is set in Execution Info', async () => {
        [Product.bandit, Product.flake8, Product.mypy, Product.pep8,
        Product.pydocstyle, Product.pylama, Product.pylint].forEach(product => {
            const info = lm.getLinterInfo(product);
            const execInfo = info.getExecutionInfo([]);
            const execPath = settings.linting[info.pathSettingName] as string;
            assert.equal(execInfo.execPath, execPath, `Incorrect executable paths for product ${info.id}`);
        });
    });

    test('Ensure correct setting names are returned', async () => {
        [Product.bandit, Product.flake8, Product.mypy, Product.pep8,
        Product.pydocstyle, Product.pylama, Product.pylint].forEach(product => {
            const linter = lm.getLinterInfo(product);
            const expected = {
                argsName: `${linter.id}Args` as keyof ILintingSettings,
                pathName: `${linter.id}Path` as keyof ILintingSettings,
                enabledName: `${linter.id}Enabled` as keyof ILintingSettings
            };

            assert.equal(linter.argsSettingName, expected.argsName, `Incorrect args settings for product ${linter.id}`);
            assert.equal(linter.pathSettingName, expected.pathName, `Incorrect path settings for product ${linter.id}`);
            assert.equal(linter.enabledSettingName, expected.enabledName, `Incorrect enabled settings for product ${linter.id}`);
        });
    });

    test('Ensure linter id match product', async () => {
        const ids = ['bandit', 'flake8', 'mypy', 'pep8', 'prospector', 'pydocstyle', 'pylama', 'pylint'];
        const products = [Product.bandit, Product.flake8, Product.mypy, Product.pep8, Product.prospector, Product.pydocstyle, Product.pylama, Product.pylint];
        for (let i = 0; i < products.length; i += 1) {
            const linter = lm.getLinterInfo(products[i]);
            assert.equal(linter.id, ids[i], `Id ${ids[i]} does not match product ${products[i]}`);
        }
    });

    test('Enable/disable linting', async () => {
        await lm.enableLintingAsync(false);
        assert.equal(await lm.isLintingEnabled(true), false, 'Linting not disabled');
        await lm.enableLintingAsync(true);
        assert.equal(await lm.isLintingEnabled(true), true, 'Linting not enabled');
    });

    test('Set single linter', async () => {
        for (const linter of lm.getAllLinterInfos()) {
            await lm.setActiveLintersAsync([linter.product]);
            const selected = await lm.getActiveLinters(true);
            assert.notEqual(selected.length, 0, 'Current linter is undefined');
            assert.equal(linter!.id, selected![0].id, `Selected linter ${selected} does not match requested ${linter.id}`);
        }
    });

    test('Set multiple linters', async () => {
        await lm.setActiveLintersAsync([Product.flake8, Product.pydocstyle]);
        const selected = await lm.getActiveLinters(true);
        assert.equal(selected.length, 2, 'Selected linters lengths does not match');
        assert.equal(Product.flake8, selected[0].product, `Selected linter ${selected[0].id} does not match requested 'flake8'`);
        assert.equal(Product.pydocstyle, selected[1].product, `Selected linter ${selected[1].id} does not match requested 'pydocstyle'`);
    });

    test('Try setting unsupported linter', async () => {
        const before = await lm.getActiveLinters(true);
        assert.notEqual(before, undefined, 'Current/before linter is undefined');

        await lm.setActiveLintersAsync([Product.nosetest]);
        const after = await lm.getActiveLinters(true);
        assert.notEqual(after, undefined, 'Current/after linter is undefined');

        assert.equal(after![0].id, before![0].id, 'Should not be able to set unsupported linter');
    });

    test('Pylint configuration file watch', async () => {
        const pylint = lm.getLinterInfo(Product.pylint);
        assert.equal(pylint.configFileNames.length, 2, 'Pylint configuration file count is incorrect.');
        assert.notEqual(pylint.configFileNames.indexOf('pylintrc'), -1, 'Pylint configuration files miss pylintrc.');
        assert.notEqual(pylint.configFileNames.indexOf('.pylintrc'), -1, 'Pylint configuration files miss .pylintrc.');
    });

    EnumEx.getValues<Product>(Product).forEach(product => {
        const linterIdMapping = new Map<Product, LinterId>();
        linterIdMapping.set(Product.bandit, 'bandit');
        linterIdMapping.set(Product.flake8, 'flake8');
        linterIdMapping.set(Product.mypy, 'mypy');
        linterIdMapping.set(Product.pep8, 'pep8');
        linterIdMapping.set(Product.prospector, 'prospector');
        linterIdMapping.set(Product.pydocstyle, 'pydocstyle');
        linterIdMapping.set(Product.pylama, 'pylama');
        linterIdMapping.set(Product.pylint, 'pylint');
        if (linterIdMapping.has(product)) {
            return;
        }

        test(`Ensure translation of ids throws exceptions for unknown linters (${product})`, async () => {
            assert.throws(() => lm.getLinterInfo(product));
        });
    });
});
