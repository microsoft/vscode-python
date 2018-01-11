
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { DiagnosticSeverity, Uri } from 'vscode';
import { EnvironmentVariables } from './variables/types';
export const IOutputChannel = Symbol('IOutputChannel');
export const IDocumentSymbolProvider = Symbol('IDocumentSymbolProvider');
export const IsWindows = Symbol('IS_WINDOWS');
export const Is64Bit = Symbol('Is64Bit');
export const IDisposableRegistry = Symbol('IDiposableRegistry');
export const IMemento = Symbol('IGlobalMemento');
export const GLOBAL_MEMENTO = Symbol('IGlobalMemento');
export const WORKSPACE_MEMENTO = Symbol('IWorkspaceMemento');

export interface IPersistentState<T> {
    value: T;
}

export const IPersistentStateFactory = Symbol('IPersistentStateFactory');

export interface IPersistentStateFactory {
    createGlobalPersistentState<T>(key: string, defaultValue: T): IPersistentState<T>;
    createWorkspacePersistentState<T>(key: string, defaultValue: T): IPersistentState<T>;
}

export type ExecutionInfo = {
    execPath?: string;
    moduleName?: string;
    args: string[];
    product?: Product;
};

export const ILogger = Symbol('ILogger');

export interface ILogger {
    logError(message: string, error?: Error);
    logWarning(message: string, error?: Error);
}

export enum InstallerResponse {
    Installed,
    Disabled,
    Ignore
}

export enum Product {
    pytest = 1,
    nosetest = 2,
    pylint = 3,
    flake8 = 4,
    pep8 = 5,
    pylama = 6,
    prospector = 7,
    pydocstyle = 8,
    yapf = 9,
    autopep8 = 10,
    mypy = 11,
    unittest = 12,
    ctags = 13,
    rope = 14,
    isort = 15
}

export enum ModuleNamePurpose {
    install = 1,
    run = 2
}

export const IInstaller = Symbol('IInstaller');

export interface IInstaller {
    promptToInstall(product: Product, resource?: Uri): Promise<InstallerResponse>;
    install(product: Product, resource?: Uri): Promise<InstallerResponse>;
    isInstalled(product: Product, resource?: Uri): Promise<boolean | undefined>;
    disableLinter(product: Product, resource?: Uri): Promise<void>;
    translateProductToModuleName(product: Product, purpose: ModuleNamePurpose): string;
}

export const IPathUtils = Symbol('IPathUtils');

export interface IPathUtils {
    getPathVariableName(): 'Path' | 'PATH';
}

export const ICurrentProcess = Symbol('ICurrentProcess');
export interface ICurrentProcess {
    env: EnvironmentVariables;
}

export interface IPythonSettings {
    pythonPath: string;
    venvPath: string;
    jediPath: string;
    devOptions: string[];
    linting: ILintingSettings;
    formatting: IFormattingSettings;
    unitTest: IUnitTestSettings;
    autoComplete: IAutoCompeteSettings;
    terminal: ITerminalSettings;
    sortImports: ISortImportSettings;
    workspaceSymbols: IWorkspaceSymbolSettings;
    envFile: string;
    disablePromptForFeatures: string[];
    disableInstallationChecks: boolean;
    globalModuleInstallation: boolean;
}
export interface ISortImportSettings {
    path: string;
    args: string[];
}

export interface IUnitTestSettings {
    promptToConfigure: boolean;
    debugPort: number;
    debugHost?: string;
    nosetestsEnabled: boolean;
    nosetestPath: string;
    nosetestArgs: string[];
    pyTestEnabled: boolean;
    pyTestPath: string;
    pyTestArgs: string[];
    unittestEnabled: boolean;
    unittestArgs: string[];
    cwd?: string;
}
export interface IPylintCategorySeverity {
    convention: DiagnosticSeverity;
    refactor: DiagnosticSeverity;
    warning: DiagnosticSeverity;
    error: DiagnosticSeverity;
    fatal: DiagnosticSeverity;
}
export interface IPep8CategorySeverity {
    W: DiagnosticSeverity;
    E: DiagnosticSeverity;
}
// tslint:disable-next-line:interface-name
export interface Flake8CategorySeverity {
    F: DiagnosticSeverity;
    E: DiagnosticSeverity;
    W: DiagnosticSeverity;
}
export interface IMypyCategorySeverity {
    error: DiagnosticSeverity;
    note: DiagnosticSeverity;
}
export interface ILintingSettings {
    enabled: boolean;
    enabledWithoutWorkspace: boolean;
    ignorePatterns: string[];
    prospectorEnabled: boolean;
    prospectorArgs: string[];
    pylintEnabled: boolean;
    pylintArgs: string[];
    pep8Enabled: boolean;
    pep8Args: string[];
    pylamaEnabled: boolean;
    pylamaArgs: string[];
    flake8Enabled: boolean;
    flake8Args: string[];
    pydocstyleEnabled: boolean;
    pydocstyleArgs: string[];
    lintOnSave: boolean;
    maxNumberOfProblems: number;
    pylintCategorySeverity: IPylintCategorySeverity;
    pep8CategorySeverity: IPep8CategorySeverity;
    flake8CategorySeverity: Flake8CategorySeverity;
    mypyCategorySeverity: IMypyCategorySeverity;
    prospectorPath: string;
    pylintPath: string;
    pep8Path: string;
    pylamaPath: string;
    flake8Path: string;
    pydocstylePath: string;
    mypyEnabled: boolean;
    mypyArgs: string[];
    mypyPath: string;
}
export interface IFormattingSettings {
    provider: string;
    autopep8Path: string;
    autopep8Args: string[];
    yapfPath: string;
    yapfArgs: string[];
}
export interface IAutoCompeteSettings {
    addBrackets: boolean;
    extraPaths: string[];
    preloadModules: string[];
}
export interface IWorkspaceSymbolSettings {
    enabled: boolean;
    tagFilePath: string;
    rebuildOnStart: boolean;
    rebuildOnFileSave: boolean;
    ctagsPath: string;
    exclusionPatterns: string[];
}
export interface ITerminalSettings {
    executeInFileDir: boolean;
    launchArgs: string[];
}

export const IConfigurationService = Symbol('IConfigurationService');

export interface IConfigurationService {
    getSettings(resource?: Uri): IPythonSettings;
}
