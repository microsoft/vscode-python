import { Product } from '../../common/types';
import { TestProvider } from '../types';
import { UnitTestProduct } from './types';

export const UNIT_TEST_PRODUCTS: UnitTestProduct[] = [Product.pytest, Product.unittest];
export const PYTEST_PROVIDER: TestProvider = 'pytest';
export const UNITTEST_PROVIDER: TestProvider = 'unittest';
export const DEFAULT_TEST_DISCOVERY_ON_SAVE_PATTERN = '**/{test*.py,*_test.py,conftest.py}';
