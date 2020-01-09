// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { Socket } from 'net';
import { Request as RequestResult } from 'request';
import {
    CancellationToken,
    ConfigurationTarget,
    DiagnosticSeverity,
    Disposable,
    DocumentSymbolProvider,
    Event,
    Extension,
    ExtensionContext,
    OutputChannel,
    Uri,
    WorkspaceEdit
} from 'vscode';
import { LanguageServerType } from '../activation/types';
import { CommandsWithoutArgs } from './application/commands';
import { ExtensionChannels } from './insidersBuild/types';
import { InterpreterUri } from './installer/types';
import { EnvironmentVariables } from './variables/types';
export const IOutputChannel = Symbol('IOutputChannel');
export interface IOutputChannel extends OutputChannel {}
export const IDocumentSymbolProvider = Symbol('IDocumentSymbolProvider');
export interface IDocumentSymbolProvider extends DocumentSymbolProvider {}
export const IsWindows = Symbol('IS_WINDOWS');
export const IDisposableRegistry = Symbol('IDiposableRegistry');
export type IDisposableRegistry = { push(disposable: Disposable): void };
export const IMemento = Symbol('IGlobalMemento');
export const GLOBAL_MEMENTO = Symbol('IGlobalMemento');
export const WORKSPACE_MEMENTO = Symbol('IWorkspaceMemento');

export type Resource = Uri | undefined;
export interface IPersistentState<T> {
    readonly value: T;
    updateValue(value: T): Promise<void>;
}
export type Version = {
    raw: string;
    major: number;
    minor: number;
    patch: number;
    build: string[];
    prerelease: string[];
};

export type ReadWrite<T> = {
    -readonly [P in keyof T]: T[P];
};

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
    // tslint:disable-next-line: no-any
    logError(...args: any[]): void;
    // tslint:disable-next-line: no-any
    logWarning(...args: any[]): void;
    // tslint:disable-next-line: no-any
    logInformation(...args: any[]): void;
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
    WorkspaceSymbols = 'WorkspaceSymbols',
    DataScience = 'DataScience'
}

export enum Product {
    pytest = 1,
    nosetest = 2,
    pylint = 3,
    flake8 = 4,
    pycodestyle = 5,
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
    black = 16,
    bandit = 17,
    jupyter = 18,
    ipykernel = 19
}

export enum ModuleNamePurpose {
    install = 1,
    run = 2
}

export const IInstaller = Symbol('IInstaller');

export interface IInstaller {
    promptToInstall(product: Product, resource?: InterpreterUri, cancel?: CancellationToken): Promise<InstallerResponse>;
    install(product: Product, resource?: InterpreterUri): Promise<InstallerResponse>;
    isInstalled(product: Product, resource?: InterpreterUri): Promise<boolean | undefined>;
    translateProductToModuleName(product: Product, purpose: ModuleNamePurpose): string;
}

// tslint:disable-next-line:no-suspicious-comment
// TODO(GH-8542): Drop IPathUtils in favor of IFileSystemPathUtils.
export const IPathUtils = Symbol('IPathUtils');
export interface IPathUtils {
    readonly delimiter: string;
    readonly home: string;
    /**
     * The platform-specific file separator. '\\' or '/'.
     * @type {string}
     * @memberof IPathUtils
     */
    readonly separator: string;
    getPathVariableName(): 'Path' | 'PATH';
    basename(pathValue: string, ext?: string): string;
    getDisplayName(pathValue: string, cwd?: string): string;
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
    readonly execPath: string;
    on(event: string | symbol, listener: Function): this;
}

export interface IPythonSettings {
    readonly pythonPath: string;
    readonly venvPath: string;
    readonly venvFolders: string[];
    readonly condaPath: string;
    readonly pipenvPath: string;
    readonly poetryPath: string;
    readonly insidersChannel: ExtensionChannels;
    readonly downloadLanguageServer: boolean;
    readonly jediEnabled: boolean;
    readonly jediPath: string;
    readonly jediMemoryLimit: number;
    readonly devOptions: string[];
    readonly linting: ILintingSettings;
    readonly formatting: IFormattingSettings;
    readonly testing: ITestingSettings;
    readonly autoComplete: IAutoCompleteSettings;
    readonly terminal: ITerminalSettings;
    readonly sortImports: ISortImportSettings;
    readonly workspaceSymbols: IWorkspaceSymbolSettings;
    readonly envFile: string;
    readonly disableInstallationChecks: boolean;
    readonly globalModuleInstallation: boolean;
    readonly analysis: IAnalysisSettings;
    readonly autoUpdateLanguageServer: boolean;
    readonly datascience: IDataScienceSettings;
    readonly onDidChange: Event<void>;
    readonly experiments: IExperiments;
    readonly languageServer: LanguageServerType;
}
export interface ISortImportSettings {
    readonly path: string;
    readonly args: string[];
}

export interface ITestingSettings {
    readonly promptToConfigure: boolean;
    readonly debugPort: number;
    readonly nosetestsEnabled: boolean;
    nosetestPath: string;
    nosetestArgs: string[];
    readonly pytestEnabled: boolean;
    pytestPath: string;
    pytestArgs: string[];
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
export interface IPycodestyleCategorySeverity {
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
    readonly pycodestyleEnabled: boolean;
    readonly pycodestyleArgs: string[];
    readonly pylamaEnabled: boolean;
    readonly pylamaArgs: string[];
    readonly flake8Enabled: boolean;
    readonly flake8Args: string[];
    readonly pydocstyleEnabled: boolean;
    readonly pydocstyleArgs: string[];
    readonly lintOnSave: boolean;
    readonly maxNumberOfProblems: number;
    readonly pylintCategorySeverity: IPylintCategorySeverity;
    readonly pycodestyleCategorySeverity: IPycodestyleCategorySeverity;
    readonly flake8CategorySeverity: Flake8CategorySeverity;
    readonly mypyCategorySeverity: IMypyCategorySeverity;
    prospectorPath: string;
    pylintPath: string;
    pycodestylePath: string;
    pylamaPath: string;
    flake8Path: string;
    pydocstylePath: string;
    mypyEnabled: boolean;
    mypyArgs: string[];
    mypyPath: string;
    banditEnabled: boolean;
    banditArgs: string[];
    banditPath: string;
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
    readonly activateEnvInCurrentTerminal: boolean;
}

export interface IExperiments {
    /**
     * Return `true` if experiments are enabled, else `false`.
     */
    readonly enabled: boolean;
    /**
     * Experiments user requested to opt into manually
     */
    readonly optInto: string[];
    /**
     * Experiments user requested to opt out from manually
     */
    readonly optOutFrom: string[];
}

export type LanguageServerDownloadChannels = 'stable' | 'beta' | 'daily';
export interface IAnalysisSettings {
    readonly downloadChannel?: LanguageServerDownloadChannels;
    readonly openFilesOnly: boolean;
    readonly typeshedPaths: string[];
    readonly cacheFolderPath: string | null;
    readonly errors: string[];
    readonly warnings: string[];
    readonly information: string[];
    readonly disabled: string[];
    readonly traceLogging: boolean;
    readonly logLevel: LogLevel;
}

interface IGatherRule {
    objectName?: string;
    functionName: string;
    doesNotModify: string[] | number[];
}

export interface IDataScienceSettings {
    allowImportFromNotebook: boolean;
    enabled: boolean;
    jupyterInterruptTimeout: number;
    jupyterLaunchTimeout: number;
    jupyterLaunchRetries: number;
    jupyterServerURI: string;
    notebookFileRoot: string;
    changeDirOnImportExport: boolean;
    useDefaultConfigForJupyter: boolean;
    searchForJupyter: boolean;
    allowInput: boolean;
    showCellInputCode: boolean;
    collapseCellInputCodeByDefault: boolean;
    maxOutputSize: number;
    enableGather?: boolean;
    gatherToScript?: boolean;
    gatherRules?: IGatherRule[];
    sendSelectionToInteractiveWindow: boolean;
    markdownRegularExpression: string;
    codeRegularExpression: string;
    allowLiveShare?: boolean;
    errorBackgroundColor: string;
    ignoreVscodeTheme?: boolean;
    variableExplorerExclude?: string;
    liveShareConnectionTimeout?: number;
    decorateCells?: boolean;
    enableCellCodeLens?: boolean;
    askForLargeDataFrames?: boolean;
    enableAutoMoveToNextCell?: boolean;
    allowUnauthorizedRemoteConnection?: boolean;
    askForKernelRestart?: boolean;
    enablePlotViewer?: boolean;
    codeLenses?: string;
    debugCodeLenses?: string;
    ptvsdDistPath?: string;
    stopOnFirstLineWhileDebugging?: boolean;
    textOutputLimit?: number;
    magicCommandsAsComments?: boolean;
    stopOnError?: boolean;
    remoteDebuggerPort?: number;
    colorizeInputBox?: boolean;
    addGotoCodeLenses?: boolean;
    useNotebookEditor?: boolean;
    runMagicCommands?: string;
    runStartupCommands: string;
    debugJustMyCode: boolean;
    defaultCellMarker?: string;
    verboseLogging?: boolean;
    themeMatplotlibPlots?: boolean;
    useWebViewServer?: boolean;
}

export const IConfigurationService = Symbol('IConfigurationService');
export interface IConfigurationService {
    getSettings(resource?: Uri): IPythonSettings;
    isTestExecution(): boolean;
    updateSetting(setting: string, value?: {}, resource?: Uri, configTarget?: ConfigurationTarget): Promise<void>;
    updateSectionSetting(section: string, setting: string, value?: {}, resource?: Uri, configTarget?: ConfigurationTarget): Promise<void>;
}

export const ISocketServer = Symbol('ISocketServer');
export interface ISocketServer extends Disposable {
    readonly client: Promise<Socket>;
    Start(options?: { port?: number; host?: string }): Promise<number>;
}

export type DownloadOptions = {
    /**
     * Prefix for progress messages displayed.
     *
     * @type {('Downloading ... ' | string)}
     */
    progressMessagePrefix: 'Downloading ... ' | string;
    /**
     * Output panel into which progress information is written.
     *
     * @type {IOutputChannel}
     */
    outputChannel?: IOutputChannel;
    /**
     * Extension of file that'll be created when downloading the file.
     *
     * @type {('tmp' | string)}
     */
    extension: 'tmp' | string;
};

export const IFileDownloader = Symbol('IFileDownloader');
/**
 * File downloader, that'll display progress in the status bar.
 *
 * @export
 * @interface IFileDownloader
 */
export interface IFileDownloader {
    /**
     * Download file and display progress in statusbar.
     * Optionnally display progress in the provided output channel.
     *
     * @param {string} uri
     * @param {DownloadOptions} options
     * @returns {Promise<string>}
     * @memberof IFileDownloader
     */
    downloadFile(uri: string, options: DownloadOptions): Promise<string>;
}

export const IHttpClient = Symbol('IHttpClient');
export interface IHttpClient {
    downloadFile(uri: string): Promise<RequestResult>;
    /**
     * Downloads file from uri as string and parses them into JSON objects
     * @param uri The uri to download the JSON from
     * @param strict Set `false` to allow trailing comma and comments in the JSON, defaults to `true`
     */
    getJSON<T>(uri: string, strict?: boolean): Promise<T>;
}

export const IExtensionContext = Symbol('ExtensionContext');
export interface IExtensionContext extends ExtensionContext {}

export const IExtensions = Symbol('IExtensions');
export interface IExtensions {
    /**
     * All extensions currently known to the system.
     */
    // tslint:disable-next-line:no-any
    readonly all: readonly Extension<any>[];

    /**
     * An event which fires when `extensions.all` changes. This can happen when extensions are
     * installed, uninstalled, enabled or disabled.
     */
    readonly onDidChange: Event<void>;

    /**
     * Get an extension by its full identifier in the form of: `publisher.name`.
     *
     * @param extensionId An extension identifier.
     * @return An extension or `undefined`.
     */
    // tslint:disable-next-line:no-any
    getExtension(extensionId: string): Extension<any> | undefined;

    /**
     * Get an extension its full identifier in the form of: `publisher.name`.
     *
     * @param extensionId An extension identifier.
     * @return An extension or `undefined`.
     */
    getExtension<T>(extensionId: string): Extension<T> | undefined;
}

export const IBrowserService = Symbol('IBrowserService');
export interface IBrowserService {
    launch(url: string): void;
}

export const IPythonExtensionBanner = Symbol('IPythonExtensionBanner');
export interface IPythonExtensionBanner {
    readonly enabled: boolean;
    showBanner(): Promise<void>;
}
export const BANNER_NAME_LS_SURVEY: string = 'LSSurveyBanner';
export const BANNER_NAME_PROPOSE_LS: string = 'ProposeLS';
export const BANNER_NAME_DS_SURVEY: string = 'DSSurveyBanner';
export const BANNER_NAME_INTERACTIVE_SHIFTENTER: string = 'InteractiveShiftEnterBanner';

export type DeprecatedSettingAndValue = {
    setting: string;
    values?: {}[];
};

export type DeprecatedFeatureInfo = {
    doNotDisplayPromptStateKey: string;
    message: string;
    moreInfoUrl: string;
    commands?: CommandsWithoutArgs[];
    setting?: DeprecatedSettingAndValue;
};

export const IFeatureDeprecationManager = Symbol('IFeatureDeprecationManager');

export interface IFeatureDeprecationManager extends Disposable {
    initialize(): void;
    registerDeprecation(deprecatedInfo: DeprecatedFeatureInfo): void;
}

export const IEditorUtils = Symbol('IEditorUtils');
export interface IEditorUtils {
    getWorkspaceEditsFromPatch(originalContents: string, patch: string, uri: Uri): WorkspaceEdit;
}

export interface IDisposable {
    dispose(): void | undefined;
}
export interface IAsyncDisposable {
    dispose(): Promise<void>;
}

/**
 * Stores hash formats
 */
export interface IHashFormat {
    number: number; // If hash format is a number
    string: string; // If hash format is a string
}

/**
 * Interface used to implement cryptography tools
 */
export const ICryptoUtils = Symbol('ICryptoUtils');
export interface ICryptoUtils {
    /**
     * Creates hash using the data and encoding specified
     * @returns hash as number, or string
     * @param data The string to hash
     * @param hashFormat Return format of the hash, number or string
     */
    createHash<E extends keyof IHashFormat>(data: string, hashFormat: E, algorithm?: 'SHA512' | 'FNV'): IHashFormat[E];
}

export const IAsyncDisposableRegistry = Symbol('IAsyncDisposableRegistry');
export interface IAsyncDisposableRegistry extends IAsyncDisposable {
    push(disposable: IDisposable | IAsyncDisposable): void;
}

/* ABExperiments field carries the identity, and the range of the experiment,
 where the experiment is valid for users falling between the number 'min' and 'max'
 More details: https://en.wikipedia.org/wiki/A/B_testing
*/
export type ABExperiments = {
    name: string; // Name of the experiment
    salt: string; // Salt string for the experiment
    min: number; // Lower limit for the experiment
    max: number; // Upper limit for the experiment
}[];

/**
 * Interface used to implement AB testing
 */
export const IExperimentsManager = Symbol('IExperimentsManager');
export interface IExperimentsManager {
    /**
     * Checks if experiments are enabled, sets required environment to be used for the experiments, logs experiment groups
     */
    activate(): Promise<void>;

    /**
     * Checks if user is in experiment or not
     * @param experimentName Name of the experiment
     * @returns `true` if user is in experiment, `false` if user is not in experiment
     */
    inExperiment(experimentName: string): boolean;

    /**
     * Sends experiment telemetry if user is in experiment
     * @param experimentName Name of the experiment
     */
    sendTelemetryIfInExperiment(experimentName: string): void;
}
