// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable: no-require-imports no-var-requires
import * as path from 'path';
import { traceVerbose } from '../client/common/logger';

process.env.CODE_TESTS_WORKSPACE = path.join(__dirname, '..', '..', 'src', 'test');
process.env.IS_CI_SERVER_TEST_DEBUGGER = '';
process.env.VSC_PYTHON_LANGUAGE_SERVER = '1';
process.env.TEST_FILES_SUFFIX = 'ls.test';

function start() {
    traceVerbose('*'.repeat(100));
    traceVerbose('Start Language Server tests');
    require('../../node_modules/vscode/bin/test');
}
start();
