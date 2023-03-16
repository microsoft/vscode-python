// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export const BLACK_EXTENSION = 'ms-python.black-formatter';
export const AUTOPEP8_EXTENSION = 'ms-python.autopep8';

export interface IInstallFormatterPrompt {
    showInstallFormatterPrompt(): Promise<void>;
}
