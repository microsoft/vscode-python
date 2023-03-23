// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri } from 'vscode';

export const BLACK_EXTENSION = 'ms-python.black-formatter';
export const AUTOPEP8_EXTENSION = 'ms-python.autopep8';

export const IInstallFormatterPrompt = Symbol('IInstallFormatterPrompt');
export interface IInstallFormatterPrompt {
    showInstallFormatterPrompt(resource?: Uri): Promise<boolean>;
}
