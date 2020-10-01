// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { PosixKnownPathsLocator } from '../../../../client/pythonEnvironments/discovery/locators/services/posixKnownPathsLocator';

suite('Posix Known Path Locator', () => {
    test('iterEnvs(): ', () => {
        const locator = new PosixKnownPathsLocator();
    });
});
