// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { workspace } from 'vscode';
import { PythonSettings } from '../client/common/configSettings';

export const IS_APPVEYOR = process.env.APPVEYOR === 'true';
export const IS_TRAVIS = process.env.TRAVIS === 'true';
export const IS_VSTS = process.env.TF_BUILD !== undefined;
export const IS_CI_SERVER = IS_TRAVIS || IS_APPVEYOR || IS_VSTS;
export const TEST_TIMEOUT = 25000;
export const IS_MULTI_ROOT_TEST = isMultitrootTest();
export const IS_CI_SERVER_TEST_DEBUGGER = process.env.IS_CI_SERVER_TEST_DEBUGGER === '1';
// If running on CI server, then run debugger tests ONLY if the corresponding flag is enabled.
export const TEST_DEBUGGER = IS_CI_SERVER ? IS_CI_SERVER_TEST_DEBUGGER : true;

function isMultitrootTest() {
    return Array.isArray(workspace.workspaceFolders) && workspace.workspaceFolders.length > 1;
}

export const IS_ANALYSIS_ENGINE_TEST =
    !IS_TRAVIS && (process.env.VSC_PYTHON_ANALYSIS === '1' || !PythonSettings.getInstance().jediEnabled);
