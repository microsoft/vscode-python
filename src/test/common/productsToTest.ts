// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Product } from '../../client/common/types';
import { getNamesAndValues } from '../../client/common/utils/enum';

export function getProductsForInstallerTests(): { name: string; value: Product }[] {
    return getNamesAndValues<Product>(Product).filter(
        (p) =>
            !['pylint', 'flake8', 'pycodestyle', 'pylama', 'prospector', 'pydocstyle', 'mypy', 'bandit'].includes(
                p.name,
            ),
    );
}
