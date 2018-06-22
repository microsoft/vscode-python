// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Uri } from 'vscode';

export const IConfigurationProviderUtils = Symbol('IConfigurationProviderUtils');

export interface IConfigurationProviderUtils {
    getPyramidStartupScriptFilePath(resource?: Uri): Promise<string | undefined>;
}
