// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri } from 'vscode';
import { ILintingSettings } from '../common/configSettings';
import { ExecutionInfo, Product } from '../common/types';

export interface IErrorHandler {
    handleError(error: Error, resource: Uri, execInfo: ExecutionInfo): Promise<boolean>;
}

export type LinterId = 'flake8' | 'mypy' | 'pep8' | 'prospector' | 'pydocstyle' | 'pylama' | 'pylint';

export type LinterSettingsPropertyNames = {
    enabledName: keyof ILintingSettings;
    argsName: keyof ILintingSettings;
    pathName: keyof ILintingSettings;
};

export interface ILinterInfo {
    id: LinterId;
    product: Product;
}

export interface ILinter extends ILinterInfo {
    isEnabled(resource: Uri): boolean;
    linterArgs(resource: Uri): string[];
}

export const ILinterManager = Symbol('ILinterManager');
export interface ILinterManager {
    getLinterInfos(): ILinterInfo[];
    createLinter(info: ILinterInfo): ILinter;
}
