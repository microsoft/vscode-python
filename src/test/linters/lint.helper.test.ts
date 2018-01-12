import * as assert from 'assert';
import * as path from 'path';
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

    test('Ensure product is set in Execution Info', async () => {
        [Product.flake8, Product.mypy, Product.pep8,
            Product.pydocstyle, Product.pylama, Product.pylint].forEach(product => {
            const info = lm.getLinterInfo(product);
            const execInfo = info.getExecutionInfo([]);
            assert.equal(info.product, product, `Incorrect information for ${product}`);
        });
    });

    test('Ensure executable is set in Execution Info', async () => {
        const settings = PythonSettings.getInstance();

        [Product.flake8, Product.mypy, Product.pep8,
        Product.pydocstyle, Product.pylama, Product.pylint].forEach(product => {
            const info = lm.getLinterInfo(product);
            const execInfo = info.getExecutionInfo([]);
            const execPath = settings.linting[info.pathSettingName] as string;
            let moduleName: string | undefined;
            if (path.basename(execPath) === execPath && info.product !== Product.prospector) {
                moduleName = execPath;
            }
            assert.equal(execInfo.execPath, execPath, `Incorrect executable paths for product ${info.id}`);
        });
    });

    test('Ensure arguments are set in Execution Info', async () => {
        const settings = PythonSettings.getInstance();
        const customArgs = ['1', '2', '3'];

        [Product.flake8, Product.mypy, Product.pep8,
        Product.pydocstyle, Product.pylama, Product.pylint].forEach(product => {
            const linter = lm.getLinterInfo(product);
            const execInfo = linter.getExecutionInfo([]);
            const args: string[] = Array.isArray(settings.linting[linter.argsSettingName]) ? settings.linting[linter.argsSettingName] as string[] : [];
            const expectedArgs = args.join(',');

            assert.equal(expectedArgs.endsWith(customArgs.join(',')), true, `Incorrect custom arguments for product ${linter.id}`);
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

    test('Ensure ids match products', async () => {
        const linterIdMapping = new Map<Product, LinterId>();
        linterIdMapping.set(Product.flake8, 'flake8');
        linterIdMapping.set(Product.mypy, 'mypy');
        linterIdMapping.set(Product.pep8, 'pep8');
        linterIdMapping.set(Product.prospector, 'prospector');
        linterIdMapping.set(Product.pydocstyle, 'pydocstyle');
        linterIdMapping.set(Product.pylama, 'pylama');
        linterIdMapping.set(Product.pylint, 'pylint');

        [Product.flake8, Product.mypy, Product.pep8,
        Product.pydocstyle, Product.pylama, Product.pylint].forEach(product => {
            const linter = lm.getLinterInfo(product);
            assert.equal(linter.id, linterIdMapping.get(product)!, `Incorrect translation for product ${linter.id}`);
        });
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
            assert.throws(() => linterHelper.translateToId(product));
        });
    });
});
