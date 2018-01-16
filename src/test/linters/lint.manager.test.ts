// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import { ILintingSettings, PythonSettings } from '../../client/common/configSettings';
import { EnumEx } from '../../client/common/enumUtils';
import { Product } from '../../client/common/types';
import { LinterManager } from '../../client/linters/linterManager';
import { LinterId } from '../../client/linters/types';
import { initialize } from '../initialize';

// tslint:disable-next-line:max-func-body-length
suite('Linting - Manager', () => {
    const lm = new LinterManager();
    suiteSetup(initialize);
    setup(async () => await resetSettings());
    teardown(async () => await resetSettings());

    async function resetSettings() {
        lm.setCurrentLinter(Product.pylint);
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
        const settings = PythonSettings.getInstance();

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
            const settings = {
                argsName: `${linter.id}Args` as keyof ILintingSettings,
                pathName: `${linter.id}Path` as keyof ILintingSettings,
                enabledName: `${linter.id}Enabled` as keyof ILintingSettings
            };

            assert.equal(linter.argsSettingName, settings.argsName, `Incorrect args settings for product ${linter.id}`);
            assert.equal(linter.pathSettingName, settings.pathName, `Incorrect path settings for product ${linter.id}`);
            assert.equal(linter.enabledSettingName, settings.enabledName, `Incorrect enabled settings for product ${linter.id}`);
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

    test('Set current linter', async () => {
        const before = lm.getCurrentLinter();
        for (const linter of lm.getAllLinterInfos()) {
            lm.setCurrentLinter(linter.product);
            const selected = lm.getCurrentLinter();
            assert.notEqual(selected, undefined, 'Current linter is undefined');
            assert.equal(linter!.id, selected!.id, `Selected linter ${selected} does not match requested ${linter.id}`);
        }
        lm.setCurrentLinter(before!.product);
    });

    test('Try setting unsupported linter', async () => {
        const before = lm.getCurrentLinter();
        assert.notEqual(before, undefined, 'Current/before linter is undefined');

        lm.setCurrentLinter(Product.nosetest);
        const after = lm.getCurrentLinter();
        assert.notEqual(after, undefined, 'Current/after linter is undefined');

        assert.equal(after!.id, before!.id, 'Should not be able to set unsupported linter');
    });

    test('Verify linting disabled with unsupported linter', async () => {
        const settingName = 'currentLinter';
        const settings = PythonSettings.getInstance();
        const current = settings.linting[settingName] as string;

        settings.linting[settingName] = 'wrong';
        const actual = lm.isLintingEnabled();

        settings.linting[settingName] = current;
        assert.equal(actual, false, 'Linting is incorrectly enabled with unsupported linter');
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
