// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri } from 'vscode';
import { ILintingSettings } from '../common/configSettings';
import { Product } from '../common/installer';
import { ExecutionInfo } from '../common/types';

export interface IErrorHandler {
    handleError(error: Error, resource: Uri, execInfo: ExecutionInfo): Promise<boolean>;
}

export const ILinterHelper = Symbol('ILinterHelper');

export type LinterId = 'flake8' | 'mypy' | 'pep8' | 'prospector' | 'pydocstyle' | 'pylama' | 'pylint';

export type LinterSettingsPropertyNames = {
    enabledName: keyof ILintingSettings;
    argsName: keyof ILintingSettings;
    pathName: keyof ILintingSettings;
};

export interface ILinterHelper {
    getExecutionInfo(linter: Product, customArgs: string[], resource?: Uri): ExecutionInfo;
    translateToId(linter: Product): LinterId;
    getSettingsPropertyNames(linter: Product): LinterSettingsPropertyNames;
}
