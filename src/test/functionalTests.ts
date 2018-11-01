// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any no-require-imports no-var-requires

if ((Reflect as any).metadata === undefined) {
    require('reflect-metadata');
}

import { extractParams, runTests } from './nonUiTests';

process.env.VSC_PYTHON_CI_TEST = '1';
process.env.VSC_PYTHON_UNIT_TEST = '1'; // This is checked to make tests run fast.

// this allows us to run hygiene as a git pre-commit hook or via debugger.
if (require.main === module) {
    // When running from debugger, allow custom args.
    const args = extractParams(60000);

    runTests({ filePattern: '**/**.functional.test.js', grep: args.grep, timeout: args.timeout });
}
