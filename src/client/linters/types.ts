// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as vscode from 'vscode';
import { ExecutionInfo, Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { LinterTrigger } from '../telemetry/types';

export interface IErrorHandler {
    handleError(error: Error, resource: vscode.Uri, execInfo: ExecutionInfo): Promise<boolean>;
}

// tslint:disable-next-line:no-suspicious-comment
// TODO: Use an enum for LinterID instead of a union of string literals.
export type LinterId = 'flake8' | 'mypy' | 'pycodestyle' | 'prospector' | 'pydocstyle' | 'pylama' | 'pylint' | 'bandit';

export interface ILinterInfo {
    readonly id: LinterId;
    readonly product: Product;
    readonly pathSettingName: string;
    readonly argsSettingName: string;
    readonly enabledSettingName: string;
    readonly configFileNames: string[];
    enableAsync(enabled: boolean, resource?: vscode.Uri): Promise<void>;
    isEnabled(resource?: vscode.Uri): boolean;
    pathName(resource?: vscode.Uri): string;
    linterArgs(resource?: vscode.Uri): string[];
    getExecutionInfo(customArgs: string[], resource?: vscode.Uri): ExecutionInfo;
}

export interface ILinter {
    readonly info: ILinterInfo;
    lint(document: vscode.TextDocument, cancellation: vscode.CancellationToken): Promise<ILintMessage[]>;
}

export const IAvailableLinterActivator = Symbol('IAvailableLinterActivator');
export interface IAvailableLinterActivator {
    promptIfLinterAvailable(linter: ILinterInfo, resource?: vscode.Uri): Promise<boolean>;
}

export const ILinterManager = Symbol('ILinterManager');
export interface ILinterManager {
    getAllLinterInfos(): ILinterInfo[];
    getLinterInfo(product: Product): ILinterInfo;
    getActiveLinters(silent: boolean, resource?: vscode.Uri): Promise<ILinterInfo[]>;
    isLintingEnabled(silent: boolean, resource?: vscode.Uri): Promise<boolean>;
    enableLintingAsync(enable: boolean, resource?: vscode.Uri): Promise<void>;
    setActiveLintersAsync(products: Product[], resource?: vscode.Uri): Promise<void>;
    createLinter(
        product: Product,
        outputChannel: vscode.OutputChannel,
        serviceContainer: IServiceContainer,
        resource?: vscode.Uri
    ): Promise<ILinter>;
}

export interface ILintMessage {
    line: number;
    column: number;
    code: string | undefined;
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

export const ILintingEngine = Symbol('ILintingEngine');
export interface ILintingEngine {
    readonly diagnostics: vscode.DiagnosticCollection;
    lintOpenPythonFiles(): Promise<vscode.DiagnosticCollection>;
    lintDocument(document: vscode.TextDocument, trigger: LinterTrigger): Promise<void>;
    clearDiagnostics(document: vscode.TextDocument): void;
}
