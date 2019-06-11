import { Product } from '../../common/types';
import { TestProvider, UnitTestProduct } from './types';

export const CANCELLATION_REASON = 'cancelled_user_request';
export enum CommandSource {
    /**
     * Tests discovery/run was triggered by extension as part of activation process.
     * If extension has identified the fact that user has tests, then we automatically discover those tests.
     */
    autoActivate = 'autoActivate',
    /**
     * Tests discovery/run was triggered by extension automatically.
     * E.g. when user changes configuration settings related to tests.
     */
    auto = 'auto',
    /**
     * Tests discovery/run was triggered by user through the UI.
     * This excludes command Palette, codelenses & test explorer
     */
    ui = 'ui',
    /**
     * Tests discovery/run was triggered by user through code lenses.
     */
    codelens = 'codelens',
    /**
     * Tests discovery/run was triggered by user through the command palette.
     */
    commandPalette = 'commandpalette',
    /**
     * Tests discovery/run was triggered by user through the test explorer.
     */
    testExplorer = 'testExplorer'
}
export const TEST_OUTPUT_CHANNEL = 'TEST_OUTPUT_CHANNEL';

export const UNIT_TEST_PRODUCTS: UnitTestProduct[] = [
    Product.pytest,
    Product.unittest,
    Product.nosetest
];
export const NOSETEST_PROVIDER: TestProvider = 'nosetest';
export const PYTEST_PROVIDER: TestProvider = 'pytest';
export const UNITTEST_PROVIDER: TestProvider = 'unittest';

export enum Icons {
    discovering = 'discovering-tests.svg',
    passed = 'status-ok.svg',
    failed = 'status-error.svg',
    unknown = 'status-unknown.svg'
}
