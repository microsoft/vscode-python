// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Product } from '../common/types';
import { LinterId } from './types';

// All supported linters must be in this map.
export const LINTERID_BY_PRODUCT = new Map<Product, LinterId>([
    [Product.bandit, LinterId.Bandit],
    [Product.flake8, LinterId.Flake8],
    [Product.pylint, LinterId.PyLint],
    [Product.mypy, LinterId.MyPy],
    [Product.pycodestyle, LinterId.PyCodeStyle],
    [Product.prospector, LinterId.Prospector],
    [Product.pydocstyle, LinterId.PyDocStyle],
    [Product.pylama, LinterId.PyLama]
]);
