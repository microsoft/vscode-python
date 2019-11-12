import { Product } from '../../common/types';
import { TestProvider, UnitTestProduct } from './types';

export const CANCELLATION_REASON = 'cancelled_user_request';
export enum CommandSource {
    auto = 'auto',
    ui = 'ui',
    codelens = 'codelens',
    commandPalette = 'commandpalette',
    testExplorer = 'testExplorer'
}
export const TEST_OUTPUT_CHANNEL = 'TEST_OUTPUT_CHANNEL';

export const UNIT_TEST_PRODUCTS: UnitTestProduct[] = [Product.pytest, Product.unittest, Product.nosetest];
export const NOSETEST_PROVIDER: TestProvider = 'nosetest';
export const PYTEST_PROVIDER: TestProvider = 'pytest';
export const UNITTEST_PROVIDER: TestProvider = 'unittest';

export enum Icons {
    discovering = 'discovering-tests.svg',
    passed = 'status-ok.svg',
    failed = 'status-error.svg',
    unknown = 'status-unknown.svg'
}
