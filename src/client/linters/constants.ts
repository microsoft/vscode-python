// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Product } from '../common/types';
import { LinterId } from './types';

// All supported linters must be in this map.
export const LINTERID_BY_PRODUCT = new Map<Product, LinterId>([
    [Product.bandit, 'bandit'],
    [Product.flake8, 'flake8'],
    [Product.pylint, 'pylint'],
    [Product.mypy, 'mypy'],
    [Product.pycodestyle, 'pycodestyle'],
    [Product.prospector, 'prospector'],
    [Product.pydocstyle, 'pydocstyle'],
    [Product.pylama, 'pylama'],
]);
