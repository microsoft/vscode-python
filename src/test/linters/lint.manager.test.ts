// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import { Container } from 'inversify';
import * as TypeMoq from 'typemoq';
import { ILintingSettings, IPythonSettings, IPythonSettingsProvider, PythonSettings } from '../../client/common/configSettings';
import { EnumEx } from '../../client/common/enumUtils';
import { Product } from '../../client/common/types';
import { ServiceContainer } from '../../client/ioc/container';
import { ServiceManager } from '../../client/ioc/serviceManager';
import { LinterManager } from '../../client/linters/linterManager';
import { ILinterManager, LinterId } from '../../client/linters/types';
import { initialize } from '../initialize';

// tslint:disable-next-line:max-func-body-length
suite('Linting - Manager', () => {
    let lm: ILinterManager;
    let settingsProvider: IPythonSettingsProvider;
    let settings: IPythonSettings;

    suiteSetup(initialize);
    setup(async () => {
        const cont = new Container();
        const serviceManager = new ServiceManager(cont);
        const serviceContainer = new ServiceContainer(cont);

        const settingsProviderMock = TypeMoq.Mock.ofType<IPythonSettingsProvider>();
        settingsProviderMock.setup(provider => provider.getInstance(TypeMoq.It.isAny())).returns(() => PythonSettings.getInstance());

        settingsProvider = settingsProviderMock.object;
        serviceManager.addSingletonInstance<IPythonSettingsProvider>(IPythonSettingsProvider, settingsProvider);

        settings = settingsProvider.getInstance();
        lm = new LinterManager(serviceContainer);
        resetSettings();
    });
    teardown(resetSettings);

    function resetSettings() {
        lm.setActiveLinters([Product.pylint]);
        lm.enableLinting(true);
    }

    test('Ensure product is set in Execution Info', async () => {
        [Product.flake8, Product.mypy, Product.pep8,
        Product.pydocstyle, Product.pylama, Product.pylint].forEach(product => {
            const execInfo = lm.getLinterInfo(product).getExecutionInfo([]);
            assert.equal(execInfo.product, product, `Incorrect information for ${product}`);
        });
    });

    test('Ensure executable is set in Execution Info', async () => {
        [Product.flake8, Product.mypy, Product.pep8,
        Product.pydocstyle, Product.pylama, Product.pylint].forEach(product => {
            const info = lm.getLinterInfo(product);
            const execInfo = info.getExecutionInfo([]);
            const execPath = settings.linting[info.pathSettingName] as string;
            assert.equal(execInfo.execPath, execPath, `Incorrect executable paths for product ${info.id}`);
        });
    });

    test('Ensure correct setting names are returned', async () => {
        [Product.flake8, Product.mypy, Product.pep8,
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
        const ids = ['flake8', 'mypy', 'pep8', 'prospector', 'pydocstyle', 'pylama', 'pylint'];
        const products = [Product.flake8, Product.mypy, Product.pep8, Product.prospector, Product.pydocstyle, Product.pylama, Product.pylint];
        for (let i = 0; i < products.length; i += 1) {
            const linter = lm.getLinterInfo(products[i]);
            assert.equal(linter.id, ids[i], `Id ${ids[i]} does not match product ${products[i]}`);
        }
    });

    test('Enable/disable linting', async () => {
        lm.enableLinting(false);
        assert.equal(lm.isLintingEnabled(), false, 'Linting not disabled');
        lm.enableLinting(true);
        assert.equal(lm.isLintingEnabled(), true, 'Linting not enabled');
    });

    test('Set single linter', async () => {
        for (const linter of lm.getAllLinterInfos()) {
            lm.setActiveLinters([linter.product]);
            const selected = lm.getActiveLinters();
            assert.notEqual(selected.length, 0, 'Current linter is undefined');
            assert.equal(linter!.id, selected![0].id, `Selected linter ${selected} does not match requested ${linter.id}`);
        }
    });

    test('Set multiple linters', async () => {
        lm.setActiveLinters([Product.flake8, Product.pydocstyle]);
        const selected = lm.getActiveLinters();
        assert.equal(selected.length, 2, 'Selected linters lengths does not match');
        assert.equal(Product.flake8, selected[0].product, `Selected linter ${selected[0].id} does not match requested 'flake8'`);
        assert.equal(Product.pydocstyle, selected[1].product, `Selected linter ${selected[1].id} does not match requested 'pydocstyle'`);
    });

    test('Try setting unsupported linter', async () => {
        const before = lm.getActiveLinters();
        assert.notEqual(before, undefined, 'Current/before linter is undefined');

        lm.setActiveLinters([Product.nosetest]);
        const after = lm.getActiveLinters();
        assert.notEqual(after, undefined, 'Current/after linter is undefined');

        assert.equal(after![0].id, before![0].id, 'Should not be able to set unsupported linter');
    });

    EnumEx.getValues<Product>(Product).forEach(product => {
        const linterIdMapping = new Map<Product, LinterId>();
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
