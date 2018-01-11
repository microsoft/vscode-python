import * as assert from 'assert';
import * as path from 'path';
import { ILintingSettings, PythonSettings } from '../../client/common/configSettings';
import { EnumEx } from '../../client/common/enumUtils';
import { Product } from '../../client/common/types';
import { LinterHelper } from '../../client/linters/helper';
import { LinterId } from '../../client/linters/types';
import { initialize } from '../initialize';

// tslint:disable-next-line:max-func-body-length
suite('Linting - Helper', () => {
    const linterHelper = new LinterHelper();
    suiteSetup(initialize);

    test('Ensure product is set in Execution Info', async () => {
        [Product.flake8, Product.mypy, Product.pep8,
        Product.pydocstyle, Product.pylama, Product.pylint].forEach(linter => {
            const info = linterHelper.getExecutionInfo(linter, []);
            assert.equal(info.product, linter, `Incorrect products for ${linterHelper.translateToId(linter)}`);
        });
    });

    test('Ensure executable is set in Execution Info', async () => {
        const settings = PythonSettings.getInstance();

        [Product.flake8, Product.mypy, Product.pep8,
        Product.pydocstyle, Product.pylama, Product.pylint].forEach(linter => {
            const info = linterHelper.getExecutionInfo(linter, []);
            const names = linterHelper.getSettingsPropertyNames(linter);
            const execPath = settings.linting[names.pathName] as string;
            let moduleName: string | undefined;
            if (path.basename(execPath) === execPath && linter !== Product.prospector) {
                moduleName = execPath;
            }

            assert.equal(info.execPath, execPath, `Incorrect executable paths for product ${linterHelper.translateToId(linter)}`);
        });
    });

    test('Ensure arguments are set in Execution Info', async () => {
        const settings = PythonSettings.getInstance();
        const customArgs = ['1', '2', '3'];

        [Product.flake8, Product.mypy, Product.pep8,
        Product.pydocstyle, Product.pylama, Product.pylint].forEach(linter => {
            const info = linterHelper.getExecutionInfo(linter, []);
            const names = linterHelper.getSettingsPropertyNames(linter);
            const args: string[] = Array.isArray(settings.linting[names.argsName]) ? settings.linting[names.argsName] as string[] : [];
            const expectedArgs = args.concat(customArgs).join(',');

            assert.equal(expectedArgs.endsWith(customArgs.join(',')), true, `Incorrect custom arguments for product ${linterHelper.translateToId(linter)}`);

        });
    });

    test('Ensure correct setting names are returned', async () => {
        [Product.flake8, Product.mypy, Product.pep8,
        Product.pydocstyle, Product.pylama, Product.pylint].forEach(linter => {
            const translatedId = linterHelper.translateToId(linter)!;
            const settings = {
                argsName: `${translatedId}Args` as keyof ILintingSettings,
                pathName: `${translatedId}Path` as keyof ILintingSettings,
                enabledName: `${translatedId}Enabled` as keyof ILintingSettings
            };

            assert.deepEqual(linterHelper.getSettingsPropertyNames(linter), settings, `Incorrect settings for product ${linterHelper.translateToId(linter)}`);
        });
    });

    test('Ensure translation of ids works', async () => {
        const linterIdMapping = new Map<Product, LinterId>();
        linterIdMapping.set(Product.flake8, 'flake8');
        linterIdMapping.set(Product.mypy, 'mypy');
        linterIdMapping.set(Product.pep8, 'pep8');
        linterIdMapping.set(Product.prospector, 'prospector');
        linterIdMapping.set(Product.pydocstyle, 'pydocstyle');
        linterIdMapping.set(Product.pylama, 'pylama');
        linterIdMapping.set(Product.pylint, 'pylint');

        [Product.flake8, Product.mypy, Product.pep8,
        Product.pydocstyle, Product.pylama, Product.pylint].forEach(linter => {
            const translatedId = linterHelper.translateToId(linter);
            assert.equal(translatedId, linterIdMapping.get(linter)!, `Incorrect translation for product ${linterHelper.translateToId(linter)}`);
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
