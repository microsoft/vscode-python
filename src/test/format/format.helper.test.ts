import * as assert from 'assert';
import * as TypeMoq from 'typemoq';
import { IConfigurationService, IFormattingSettings, Product } from '../../client/common/types';
import * as EnumEx from '../../client/common/utils/enum';
import { FormatterHelper } from '../../client/formatters/helper';
import { FormatterId } from '../../client/formatters/types';
import { getExtensionSettings } from '../common';
import { initialize } from '../initialize';
import { UnitTestIocContainer } from '../testing/serviceRegistry';

// tslint:disable-next-line:max-func-body-length
suite('Formatting - Helper', () => {
    let ioc: UnitTestIocContainer;
    let formatHelper: FormatterHelper;

    suiteSetup(initialize);
    setup(() => {
        ioc = new UnitTestIocContainer();

        const config = TypeMoq.Mock.ofType<IConfigurationService>();
        config.setup(x => x.getSettings(TypeMoq.It.isAny())).returns(() => getExtensionSettings(undefined));

        ioc.serviceManager.addSingletonInstance<IConfigurationService>(IConfigurationService, config.object);
        formatHelper = new FormatterHelper(ioc.serviceManager);
    });

    test('Ensure product is set in Execution Info', async () => {
        [Product.autopep8, Product.black, Product.yapf].forEach(formatter => {
            const info = formatHelper.getExecutionInfo(formatter, []);
            assert.equal(info.product, formatter, `Incorrect products for ${formatHelper.translateToId(formatter)}`);
        });
    });

    test('Ensure executable is set in Execution Info', async () => {
        const settings = getExtensionSettings(undefined);

        [Product.autopep8, Product.black, Product.yapf].forEach(formatter => {
            const info = formatHelper.getExecutionInfo(formatter, []);
            const names = formatHelper.getSettingsPropertyNames(formatter);
            const execPath = settings.formatting[names.pathName] as string;

            assert.equal(info.execPath, execPath, `Incorrect executable paths for product ${formatHelper.translateToId(formatter)}`);
        });
    });

    test('Ensure arguments are set in Execution Info', async () => {
        const settings = getExtensionSettings(undefined);
        const customArgs = ['1', '2', '3'];

        [Product.autopep8, Product.black, Product.yapf].forEach(formatter => {
            const names = formatHelper.getSettingsPropertyNames(formatter);
            const args: string[] = Array.isArray(settings.formatting[names.argsName]) ? (settings.formatting[names.argsName] as string[]) : [];
            const expectedArgs = args.concat(customArgs).join(',');

            assert.equal(expectedArgs.endsWith(customArgs.join(',')), true, `Incorrect custom arguments for product ${formatHelper.translateToId(formatter)}`);
        });
    });

    test('Ensure correct setting names are returned', async () => {
        [Product.autopep8, Product.black, Product.yapf].forEach(formatter => {
            const translatedId = formatHelper.translateToId(formatter)!;
            const settings = {
                argsName: `${translatedId}Args` as keyof IFormattingSettings,
                pathName: `${translatedId}Path` as keyof IFormattingSettings
            };

            assert.deepEqual(formatHelper.getSettingsPropertyNames(formatter), settings, `Incorrect settings for product ${formatHelper.translateToId(formatter)}`);
        });
    });

    test('Ensure translation of ids works', async () => {
        const formatterMapping = new Map<Product, FormatterId>();
        formatterMapping.set(Product.autopep8, 'autopep8');
        formatterMapping.set(Product.black, 'black');
        formatterMapping.set(Product.yapf, 'yapf');

        [Product.autopep8, Product.black, Product.yapf].forEach(formatter => {
            const translatedId = formatHelper.translateToId(formatter);
            assert.equal(translatedId, formatterMapping.get(formatter)!, `Incorrect translation for product ${formatHelper.translateToId(formatter)}`);
        });
    });

    EnumEx.getValues<Product>(Product).forEach(product => {
        const formatterMapping = new Map<Product, FormatterId>();
        formatterMapping.set(Product.autopep8, 'autopep8');
        formatterMapping.set(Product.black, 'black');
        formatterMapping.set(Product.yapf, 'yapf');
        if (formatterMapping.has(product)) {
            return;
        }

        test(`Ensure translation of ids throws exceptions for unknown formatters (${product})`, async () => {
            assert.throws(() => formatHelper.translateToId(product));
        });
    });
});
