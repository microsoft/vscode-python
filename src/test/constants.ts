// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IS_CI_SERVER, IS_CI_SERVER_TEST_DEBUGGER } from './ciConstants';

export const TEST_TIMEOUT = 25000;
export const IS_MULTI_ROOT_TEST = isMultitrootTest();
export const IS_LANGUAGE_SERVER_TEST = process.env.VSC_PYTHON_LANGUAGE_SERVER === '1';

// If running on CI server, then run debugger tests ONLY if the corresponding flag is enabled.
export const TEST_DEBUGGER = IS_CI_SERVER ? IS_CI_SERVER_TEST_DEBUGGER : true;

function isMultitrootTest() {
    // tslint:disable-next-line:no-require-imports
    const vscode = require('vscode');
    const workspace = vscode.workspace;
    return Array.isArray(workspace.workspaceFolders) && workspace.workspaceFolders.length > 1;
}
