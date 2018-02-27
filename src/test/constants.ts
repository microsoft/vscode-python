// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-string-literal
import { workspace } from 'vscode';

export const IS_CI_SERVER = (typeof process.env['TRAVIS'] === 'string' ? process.env['TRAVIS'] : '') === 'true';
export const TEST_TIMEOUT = 25000;
export const IS_MULTI_ROOT_TEST = isMultitrootTest();
export const IS_CI_SERVER_TEST_DEBUGGER = process.env['IS_CI_SERVER_TEST_DEBUGGER'] === '1';
// If running on CI server, then run debugger tests ONLY if the corresponding flag is enabled.
export const TEST_DEBUGGER = IS_CI_SERVER ? IS_CI_SERVER_TEST_DEBUGGER : true;

function isMultitrootTest() {
    return Array.isArray(workspace.workspaceFolders) && workspace.workspaceFolders.length > 1;
}
