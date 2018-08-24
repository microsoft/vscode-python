
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Socket } from 'net';
import { ConfigurationTarget, DiagnosticSeverity, Disposable, ExtensionContext, OutputChannel, Uri } from 'vscode';

import { EnvironmentVariables } from './variables/types';
export const IOutputChannel = Symbol('IOutputChannel');
export interface IOutputChannel extends OutputChannel { }
export const IDocumentSymbolProvider = Symbol('IDocumentSymbolProvider');
export const IsWindows = Symbol('IS_WINDOWS');
export const Is64Bit = Symbol('Is64Bit');
export const IDisposableRegistry = Symbol('IDiposableRegistry');
export type IDisposableRegistry = Disposable[];
export const IMemento = Symbol('IGlobalMemento');
export const GLOBAL_MEMENTO = Symbol('IGlobalMemento');
export const WORKSPACE_MEMENTO = Symbol('IWorkspaceMemento');

export interface IPersistentState<T> {
    readonly value: T;
    updateValue(value: T): Promise<void>;
}

export const IPersistentStateFactory = Symbol('IPersistentStateFactory');

export interface IPersistentStateFactory {
    createGlobalPersistentState<T>(key: string, defaultValue?: T, expiryDurationMs?: number): IPersistentState<T>;
    createWorkspacePersistentState<T>(key: string, defaultValue?: T, expiryDurationMs?: number): IPersistentState<T>;
}

export type ExecutionInfo = {
    execPath?: string;
    moduleName?: string;
    args: string[];
    product?: Product;
};

export enum LogLevel {
    Information = 'Information',
    Error = 'Error',
    Warning = 'Warning'
}

export const ILogger = Symbol('ILogger');

export interface ILogger {
    logError(message: string, error?: Error);
    logWarning(message: string, error?: Error);
    logInformation(message: string, error?: Error);
}

export enum InstallerResponse {
    Installed,
    Disabled,
    Ignore
}

export enum ProductType {
    Linter = 'Linter',
    Formatter = 'Formatter',
    TestFramework = 'TestFramework',
    RefactoringLibrary = 'RefactoringLibrary',
    WorkspaceSymbols = 'WorkspaceSymbols'
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
    isort = 15,
    black = 16
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
    translateProductToModuleName(product: Product, purpose: ModuleNamePurpose): string;
}

export const IPathUtils = Symbol('IPathUtils');

export interface IPathUtils {
    readonly delimiter: string;
    getPathVariableName(): 'Path' | 'PATH';
    basename(pathValue: string, ext?: string): string;
}

export const IRandom = Symbol('IRandom');
export interface IRandom {
    getRandomInt(min?: number, max?: number): number;
}

export const ICurrentProcess = Symbol('ICurrentProcess');
export interface ICurrentProcess {
    readonly env: EnvironmentVariables;
    readonly argv: string[];
    readonly stdout: NodeJS.WriteStream;
    readonly stdin: NodeJS.ReadStream;
    on(event: string | symbol, listener: Function): this;
}

export interface IPythonSettings {
    readonly pythonPath: string;
    readonly venvPath: string;
    readonly venvFolders: string[];
    readonly downloadLanguageServer: boolean;
    readonly jediEnabled: boolean;
    readonly jediPath: string;
    readonly jediMemoryLimit: number;
    readonly devOptions: string[];
    readonly linting: ILintingSettings;
    readonly formatting: IFormattingSettings;
    readonly unitTest: IUnitTestSettings;
    readonly autoComplete: IAutoCompleteSettings;
    readonly terminal: ITerminalSettings;
    readonly sortImports: ISortImportSettings;
    readonly workspaceSymbols: IWorkspaceSymbolSettings;
    readonly envFile: string;
    readonly disableInstallationChecks: boolean;
    readonly globalModuleInstallation: boolean;
    readonly analysis: IAnalysisSettings;
}
export interface ISortImportSettings {
    readonly path: string;
    readonly args: string[];
}

export interface IUnitTestSettings {
    readonly promptToConfigure: boolean;
    readonly debugPort: number;
    readonly nosetestsEnabled: boolean;
    nosetestPath: string;
    nosetestArgs: string[];
    readonly pyTestEnabled: boolean;
    pyTestPath: string;
    pyTestArgs: string[];
    readonly unittestEnabled: boolean;
    unittestArgs: string[];
    cwd?: string;
    readonly autoTestDiscoverOnSaveEnabled: boolean;
}
export interface IPylintCategorySeverity {
    readonly convention: DiagnosticSeverity;
    readonly refactor: DiagnosticSeverity;
    readonly warning: DiagnosticSeverity;
    readonly error: DiagnosticSeverity;
    readonly fatal: DiagnosticSeverity;
}
export interface IPep8CategorySeverity {
    readonly W: DiagnosticSeverity;
    readonly E: DiagnosticSeverity;
}
// tslint:disable-next-line:interface-name
export interface Flake8CategorySeverity {
    readonly F: DiagnosticSeverity;
    readonly E: DiagnosticSeverity;
    readonly W: DiagnosticSeverity;
}
export interface IMypyCategorySeverity {
    readonly error: DiagnosticSeverity;
    readonly note: DiagnosticSeverity;
}
export interface ILintingSettings {
    readonly enabled: boolean;
    readonly ignorePatterns: string[];
    readonly prospectorEnabled: boolean;
    readonly prospectorArgs: string[];
    readonly pylintEnabled: boolean;
    readonly pylintArgs: string[];
    readonly pep8Enabled: boolean;
    readonly pep8Args: string[];
    readonly pylamaEnabled: boolean;
    readonly pylamaArgs: string[];
    readonly flake8Enabled: boolean;
    readonly flake8Args: string[];
    readonly pydocstyleEnabled: boolean;
    readonly pydocstyleArgs: string[];
    readonly lintOnSave: boolean;
    readonly maxNumberOfProblems: number;
    readonly pylintCategorySeverity: IPylintCategorySeverity;
    readonly pep8CategorySeverity: IPep8CategorySeverity;
    readonly flake8CategorySeverity: Flake8CategorySeverity;
    readonly mypyCategorySeverity: IMypyCategorySeverity;
    prospectorPath: string;
    pylintPath: string;
    pep8Path: string;
    pylamaPath: string;
    flake8Path: string;
    pydocstylePath: string;
    mypyEnabled: boolean;
    mypyArgs: string[];
    mypyPath: string;
    readonly pylintUseMinimalCheckers: boolean;
}
export interface IFormattingSettings {
    readonly provider: string;
    autopep8Path: string;
    readonly autopep8Args: string[];
    blackPath: string;
    readonly blackArgs: string[];
    yapfPath: string;
    readonly yapfArgs: string[];
}
export interface IAutoCompleteSettings {
    readonly addBrackets: boolean;
    readonly extraPaths: string[];
    readonly preloadModules: string[];
    readonly showAdvancedMembers: boolean;
    readonly typeshedPaths: string[];
}
export interface IWorkspaceSymbolSettings {
    readonly enabled: boolean;
    tagFilePath: string;
    readonly rebuildOnStart: boolean;
    readonly rebuildOnFileSave: boolean;
    readonly ctagsPath: string;
    readonly exclusionPatterns: string[];
}
export interface ITerminalSettings {
    readonly executeInFileDir: boolean;
    readonly launchArgs: string[];
    readonly activateEnvironment: boolean;
}

export interface IAnalysisSettings {
    readonly openFilesOnly: boolean;
    readonly typeshedPaths: string[];
    readonly errors: string[];
    readonly warnings: string[];
    readonly information: string[];
    readonly disabled: string[];
    readonly traceLogging: boolean;
    readonly logLevel: LogLevel;
}

export const IConfigurationService = Symbol('IConfigurationService');
export interface IConfigurationService {
    getSettings(resource?: Uri): IPythonSettings;
    isTestExecution(): boolean;
    updateSettingAsync(setting: string, value?: {}, resource?: Uri, configTarget?: ConfigurationTarget): Promise<void>;
}

export const ISocketServer = Symbol('ISocketServer');
export interface ISocketServer extends Disposable {
    readonly client: Promise<Socket>;
    Start(options?: { port?: number; host?: string }): Promise<number>;
}

export const IExtensionContext = Symbol('ExtensionContext');
export interface IExtensionContext extends ExtensionContext { }

export const IBrowserService = Symbol('IBrowserService');
export interface IBrowserService {
    launch(url: string): void;
}

export const IPythonExtensionBanner = Symbol('IPythonExtensionBanner');
export interface IPythonExtensionBanner {
    enabled: boolean;
    shownCount: Promise<number>;
    optionLabels: string[];
    showBanner(): Promise<void>;
}
export const BANNER_NAME_LS_SURVEY: string = 'LSSurveyBanner';
export const BANNER_NAME_PROPOSE_LS: string = 'ProposeLS';
