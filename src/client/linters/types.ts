// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { ExecutionInfo, Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';

export interface IErrorHandler {
    handleError(error: Error, resource: vscode.Uri, execInfo: ExecutionInfo): Promise<boolean>;
}

export type LinterId = 'flake8' | 'mypy' | 'pep8' | 'prospector' | 'pydocstyle' | 'pylama' | 'pylint';

export interface ILinterInfo {
    readonly id: LinterId;
    readonly product: Product;
    readonly pathSettingName: string;
    readonly argsSettingName: string;
    readonly enabledSettingName: string;
    pathName(resource?: vscode.Uri): string;
    linterArgs(resource?: vscode.Uri): string[];
    getExecutionInfo(customArgs: string[], resource?: vscode.Uri): ExecutionInfo;
}

export interface ILinter {
    readonly info: ILinterInfo;
    lint(document: vscode.TextDocument, cancellation: vscode.CancellationToken): Promise<ILintMessage[]>;
}

export const ILinterManager = Symbol('ILinterManager');
export interface ILinterManager {
    getAllLinterInfos(): ILinterInfo[];
    getLinterInfo(product: Product): ILinterInfo;
    getCurrentLinter(resource?: vscode.Uri): ILinterInfo | undefined;
    isLintingEnabled(resource?: vscode.Uri): boolean;
    enableLinting(enable: boolean, resource?: vscode.Uri): void;
    setCurrentLinter(product: Product, resource?: vscode.Uri);
    createLinter(product: Product, outputChannel: vscode.OutputChannel, serviceContainer: IServiceContainer): ILinter;
}

export interface ILintMessage {
    line: number;
    column: number;
    code: string;
    message: string;
    type: string;
    severity?: LintMessageSeverity;
    provider: string;
}
export enum LintMessageSeverity {
    Hint,
    Error,
    Warning,
    Information
}
