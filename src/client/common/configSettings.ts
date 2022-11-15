'use strict';

// eslint-disable-next-line camelcase
import * as path from 'path';
import * as fs from 'fs';
import {
    ConfigurationChangeEvent,
    ConfigurationTarget,
    DiagnosticSeverity,
    Disposable,
    Event,
    EventEmitter,
    Uri,
    WorkspaceConfiguration,
} from 'vscode';
import { LanguageServerType } from '../activation/types';
import './extensions';
import { IInterpreterAutoSelectionProxyService } from '../interpreter/autoSelection/types';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { sendSettingTelemetry } from '../telemetry/envFileTelemetry';
import { ITestingSettings } from '../testing/configuration/types';
import { IWorkspaceService } from './application/types';
import { WorkspaceService } from './application/workspace';
import { DEFAULT_INTERPRETER_SETTING, isTestExecution } from './constants';
import { IS_WINDOWS } from './platform/constants';
import {
    IAutoCompleteSettings,
    IDefaultLanguageServer,
    IExperiments,
    IFormattingSettings,
    IInterpreterPathService,
    IInterpreterSettings,
    ILintingSettings,
    IPythonSettings,
    ISortImportSettings,
    ITensorBoardSettings,
    ITerminalSettings,
    Resource,
} from './types';
import { debounceSync } from './utils/decorators';
import { SystemVariables } from './variables/systemVariables';
import { getOSType, OSType } from './utils/platform';

const untildify = require('untildify');

export class PythonSettings implements IPythonSettings {
    private get onDidChange(): Event<ConfigurationChangeEvent | undefined> {
        return this.changed.event;
    }

    // eslint-disable-next-line class-methods-use-this
    public static onConfigChange(): Event<ConfigurationChangeEvent | undefined> {
        return PythonSettings.configChanged.event;
    }

    public get pythonPath(): string {
        return this._pythonPath;
    }

    public set pythonPath(value: string) {
        if (this._pythonPath === value) {
            return;
        }
        // Add support for specifying just the directory where the python executable will be located.
        // E.g. virtual directory name.
        try {
            this._pythonPath = this.getPythonExecutable(value);
        } catch (ex) {
            this._pythonPath = value;
        }
    }

    public get defaultInterpreterPath(): string {
        return this._defaultInterpreterPath;
    }

    public set defaultInterpreterPath(value: string) {
        if (this._defaultInterpreterPath === value) {
            return;
        }
        // Add support for specifying just the directory where the python executable will be located.
        // E.g. virtual directory name.
        try {
            this._defaultInterpreterPath = this.getPythonExecutable(value);
        } catch (ex) {
            this._defaultInterpreterPath = value;
        }
    }

    private static pythonSettings: Map<string, PythonSettings> = new Map<string, PythonSettings>();

    public envFile = '';

    public venvPath = '';

    public interpreter!: IInterpreterSettings;

    public venvFolders: string[] = [];

    public condaPath = '';

    public pipenvPath = '';

    public poetryPath = '';

    public devOptions: string[] = [];

    public linting!: ILintingSettings;

    public formatting!: IFormattingSettings;

    public autoComplete!: IAutoCompleteSettings;

    public tensorBoard: ITensorBoardSettings | undefined;

    public testing!: ITestingSettings;

    public terminal!: ITerminalSettings;

    public sortImports!: ISortImportSettings;

    public globalModuleInstallation = false;

    public experiments!: IExperiments;

    public languageServer: LanguageServerType = LanguageServerType.Node;

    public languageServerIsDefault = true;

    protected readonly changed = new EventEmitter<ConfigurationChangeEvent | undefined>();

    private static readonly configChanged = new EventEmitter<ConfigurationChangeEvent | undefined>();

    private workspaceRoot: Resource;

    private disposables: Disposable[] = [];

    private _pythonPath = 'python';

    private _defaultInterpreterPath = '';

    private readonly workspace: IWorkspaceService;

    constructor(
        workspaceFolder: Resource,
        private readonly interpreterAutoSelectionService: IInterpreterAutoSelectionProxyService,
        workspace: IWorkspaceService,
        private readonly interpreterPathService: IInterpreterPathService,
        private readonly defaultLS: IDefaultLanguageServer | undefined,
    ) {
        this.workspace = workspace || new WorkspaceService();
        this.workspaceRoot = workspaceFolder;
        this.initialize();
    }

    public static getInstance(
        resource: Uri | undefined,
        interpreterAutoSelectionService: IInterpreterAutoSelectionProxyService,
        workspace: IWorkspaceService,
        interpreterPathService: IInterpreterPathService,
        defaultLS: IDefaultLanguageServer | undefined,
    ): PythonSettings {
        workspace = workspace || new WorkspaceService();
        const workspaceFolderUri = PythonSettings.getSettingsUriAndTarget(resource, workspace).uri;
        const workspaceFolderKey = workspaceFolderUri ? workspaceFolderUri.fsPath : '';

        if (!PythonSettings.pythonSettings.has(workspaceFolderKey)) {
            const settings = new PythonSettings(
                workspaceFolderUri,
                interpreterAutoSelectionService,
                workspace,
                interpreterPathService,
                defaultLS,
            );
            PythonSettings.pythonSettings.set(workspaceFolderKey, settings);
            settings.onDidChange((event) => PythonSettings.debounceConfigChangeNotification(event));
            // Pass null to avoid VSC from complaining about not passing in a value.

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const config = workspace.getConfiguration('editor', resource || (null as any));
            const formatOnType = config ? config.get('formatOnType', false) : false;
            sendTelemetryEvent(EventName.FORMAT_ON_TYPE, undefined, { enabled: formatOnType });
        }

        return PythonSettings.pythonSettings.get(workspaceFolderKey)!;
    }

    @debounceSync(1)
    // eslint-disable-next-line class-methods-use-this
    protected static debounceConfigChangeNotification(event?: ConfigurationChangeEvent): void {
        PythonSettings.configChanged.fire(event);
    }

    public static getSettingsUriAndTarget(
        resource: Uri | undefined,
        workspace?: IWorkspaceService,
    ): { uri: Uri | undefined; target: ConfigurationTarget } {
        workspace = workspace || new WorkspaceService();
        const workspaceFolder = resource ? workspace.getWorkspaceFolder(resource) : undefined;
        let workspaceFolderUri: Uri | undefined = workspaceFolder ? workspaceFolder.uri : undefined;

        if (!workspaceFolderUri && Array.isArray(workspace.workspaceFolders) && workspace.workspaceFolders.length > 0) {
            workspaceFolderUri = workspace.workspaceFolders[0].uri;
        }

        const target = workspaceFolderUri ? ConfigurationTarget.WorkspaceFolder : ConfigurationTarget.Global;
        return { uri: workspaceFolderUri, target };
    }

    public static dispose(): void {
        if (!isTestExecution()) {
            throw new Error('Dispose can only be called from unit tests');
        }

        PythonSettings.pythonSettings.forEach((item) => item && item.dispose());
        PythonSettings.pythonSettings.clear();
    }

    public static toSerializable(settings: IPythonSettings): IPythonSettings {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const clone: any = {};
        const keys = Object.entries(settings);
        keys.forEach((e) => {
            const [k, v] = e;
            if (!k.includes('Manager') && !k.includes('Service') && !k.includes('onDid')) {
                clone[k] = v;
            }
        });

        return clone as IPythonSettings;
    }

    public dispose(): void {
        this.disposables.forEach((disposable) => disposable && disposable.dispose());
        this.disposables = [];
    }

    protected update(pythonSettings: WorkspaceConfiguration): void {
        const workspaceRoot = this.workspaceRoot?.fsPath;
        const systemVariables: SystemVariables = new SystemVariables(undefined, workspaceRoot, this.workspace);

        this.pythonPath = this.getPythonPath(systemVariables, workspaceRoot);

        const defaultInterpreterPath = systemVariables.resolveAny(pythonSettings.get<string>('defaultInterpreterPath'));
        this.defaultInterpreterPath = defaultInterpreterPath || DEFAULT_INTERPRETER_SETTING;
        if (this.defaultInterpreterPath === DEFAULT_INTERPRETER_SETTING) {
            const autoSelectedPythonInterpreter = this.interpreterAutoSelectionService.getAutoSelectedInterpreter(
                this.workspaceRoot,
            );
            this.defaultInterpreterPath = autoSelectedPythonInterpreter?.path ?? this.defaultInterpreterPath;
        }
        this.defaultInterpreterPath = getAbsolutePath(this.defaultInterpreterPath, workspaceRoot);

        this.venvPath = systemVariables.resolveAny(pythonSettings.get<string>('venvPath'))!;
        this.venvFolders = systemVariables.resolveAny(pythonSettings.get<string[]>('venvFolders'))!;
        const condaPath = systemVariables.resolveAny(pythonSettings.get<string>('condaPath'))!;
        this.condaPath = condaPath && condaPath.length > 0 ? getAbsolutePath(condaPath, workspaceRoot) : condaPath;
        const pipenvPath = systemVariables.resolveAny(pythonSettings.get<string>('pipenvPath'))!;
        this.pipenvPath = pipenvPath && pipenvPath.length > 0 ? getAbsolutePath(pipenvPath, workspaceRoot) : pipenvPath;
        const poetryPath = systemVariables.resolveAny(pythonSettings.get<string>('poetryPath'))!;
        this.poetryPath = poetryPath && poetryPath.length > 0 ? getAbsolutePath(poetryPath, workspaceRoot) : poetryPath;

        this.interpreter = pythonSettings.get<IInterpreterSettings>('interpreter') ?? {
            infoVisibility: 'onPythonRelated',
        };
        // Get as a string and verify; don't just accept.
        let userLS = pythonSettings.get<string>('languageServer');
        userLS = systemVariables.resolveAny(userLS);

        // Validate the user's input; if invalid, set it to the default.
        if (
            !userLS ||
            userLS === 'Default' ||
            userLS === 'Microsoft' ||
            !Object.values(LanguageServerType).includes(userLS as LanguageServerType)
        ) {
            this.languageServer = this.defaultLS?.defaultLSType ?? LanguageServerType.None;
            this.languageServerIsDefault = true;
        } else if (userLS === 'JediLSP') {
            // Switch JediLSP option to Jedi.
            this.languageServer = LanguageServerType.Jedi;
            this.languageServerIsDefault = false;
        } else {
            this.languageServer = userLS as LanguageServerType;
            this.languageServerIsDefault = false;
        }

        const autoCompleteSettings = systemVariables.resolveAny(
            pythonSettings.get<IAutoCompleteSettings>('autoComplete'),
        )!;
        if (this.autoComplete) {
            Object.assign<IAutoCompleteSettings, IAutoCompleteSettings>(this.autoComplete, autoCompleteSettings);
        } else {
            this.autoComplete = autoCompleteSettings;
        }

        const envFileSetting = pythonSettings.get<string>('envFile');
        this.envFile = systemVariables.resolveAny(envFileSetting)!;
        sendSettingTelemetry(this.workspace, envFileSetting);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.devOptions = systemVariables.resolveAny(pythonSettings.get<any[]>('devOptions'))!;
        this.devOptions = Array.isArray(this.devOptions) ? this.devOptions : [];

        const lintingSettings = systemVariables.resolveAny(pythonSettings.get<ILintingSettings>('linting'))!;
        if (this.linting) {
            Object.assign<ILintingSettings, ILintingSettings>(this.linting, lintingSettings);
        } else {
            this.linting = lintingSettings;
        }

        this.globalModuleInstallation = pythonSettings.get<boolean>('globalModuleInstallation') === true;

        const sortImportSettings = systemVariables.resolveAny(pythonSettings.get<ISortImportSettings>('sortImports'))!;
        if (this.sortImports) {
            Object.assign<ISortImportSettings, ISortImportSettings>(this.sortImports, sortImportSettings);
        } else {
            this.sortImports = sortImportSettings;
        }
        // Support for travis.
        this.sortImports = this.sortImports ? this.sortImports : { path: '', args: [] };
        // Support for travis.
        this.linting = this.linting
            ? this.linting
            : {
                  enabled: false,
                  cwd: undefined,
                  ignorePatterns: [],
                  flake8Args: [],
                  flake8Enabled: false,
                  flake8Path: 'flake8',
                  lintOnSave: false,
                  maxNumberOfProblems: 100,
                  mypyArgs: [],
                  mypyEnabled: false,
                  mypyPath: 'mypy',
                  banditArgs: [],
                  banditEnabled: false,
                  banditPath: 'bandit',
                  pycodestyleArgs: [],
                  pycodestyleEnabled: false,
                  pycodestylePath: 'pycodestyle',
                  pylamaArgs: [],
                  pylamaEnabled: false,
                  pylamaPath: 'pylama',
                  prospectorArgs: [],
                  prospectorEnabled: false,
                  prospectorPath: 'prospector',
                  pydocstyleArgs: [],
                  pydocstyleEnabled: false,
                  pydocstylePath: 'pydocstyle',
                  pylintArgs: [],
                  pylintEnabled: false,
                  pylintPath: 'pylint',
                  pylintCategorySeverity: {
                      convention: DiagnosticSeverity.Hint,
                      error: DiagnosticSeverity.Error,
                      fatal: DiagnosticSeverity.Error,
                      refactor: DiagnosticSeverity.Hint,
                      warning: DiagnosticSeverity.Warning,
                  },
                  pycodestyleCategorySeverity: {
                      E: DiagnosticSeverity.Error,
                      W: DiagnosticSeverity.Warning,
                  },
                  flake8CategorySeverity: {
                      E: DiagnosticSeverity.Error,
                      W: DiagnosticSeverity.Warning,
                      // Per http://flake8.pycqa.org/en/latest/glossary.html#term-error-code
                      // 'F' does not mean 'fatal as in PyLint but rather 'pyflakes' such as
                      // unused imports, variables, etc.
                      F: DiagnosticSeverity.Warning,
                  },
                  mypyCategorySeverity: {
                      error: DiagnosticSeverity.Error,
                      note: DiagnosticSeverity.Hint,
                  },
              };
        this.linting.pylintPath = getAbsolutePath(systemVariables.resolveAny(this.linting.pylintPath), workspaceRoot);
        this.linting.flake8Path = getAbsolutePath(systemVariables.resolveAny(this.linting.flake8Path), workspaceRoot);
        this.linting.pycodestylePath = getAbsolutePath(
            systemVariables.resolveAny(this.linting.pycodestylePath),
            workspaceRoot,
        );
        this.linting.pylamaPath = getAbsolutePath(systemVariables.resolveAny(this.linting.pylamaPath), workspaceRoot);
        this.linting.prospectorPath = getAbsolutePath(
            systemVariables.resolveAny(this.linting.prospectorPath),
            workspaceRoot,
        );
        this.linting.pydocstylePath = getAbsolutePath(
            systemVariables.resolveAny(this.linting.pydocstylePath),
            workspaceRoot,
        );
        this.linting.mypyPath = getAbsolutePath(systemVariables.resolveAny(this.linting.mypyPath), workspaceRoot);
        this.linting.banditPath = getAbsolutePath(systemVariables.resolveAny(this.linting.banditPath), workspaceRoot);

        if (this.linting.cwd) {
            this.linting.cwd = getAbsolutePath(systemVariables.resolveAny(this.linting.cwd), workspaceRoot);
        }

        const formattingSettings = systemVariables.resolveAny(pythonSettings.get<IFormattingSettings>('formatting'))!;
        if (this.formatting) {
            Object.assign<IFormattingSettings, IFormattingSettings>(this.formatting, formattingSettings);
        } else {
            this.formatting = formattingSettings;
        }
        // Support for travis.
        this.formatting = this.formatting
            ? this.formatting
            : {
                  autopep8Args: [],
                  autopep8Path: 'autopep8',
                  provider: 'autopep8',
                  blackArgs: [],
                  blackPath: 'black',
                  yapfArgs: [],
                  yapfPath: 'yapf',
              };
        this.formatting.autopep8Path = getAbsolutePath(
            systemVariables.resolveAny(this.formatting.autopep8Path),
            workspaceRoot,
        );
        this.formatting.yapfPath = getAbsolutePath(systemVariables.resolveAny(this.formatting.yapfPath), workspaceRoot);
        this.formatting.blackPath = getAbsolutePath(
            systemVariables.resolveAny(this.formatting.blackPath),
            workspaceRoot,
        );

        const testSettings = systemVariables.resolveAny(pythonSettings.get<ITestingSettings>('testing'))!;
        if (this.testing) {
            Object.assign<ITestingSettings, ITestingSettings>(this.testing, testSettings);
        } else {
            this.testing = testSettings;
            if (isTestExecution() && !this.testing) {
                this.testing = {
                    pytestArgs: [],
                    unittestArgs: [],
                    promptToConfigure: true,
                    debugPort: 3000,
                    pytestEnabled: false,
                    unittestEnabled: false,
                    pytestPath: 'pytest',
                    autoTestDiscoverOnSaveEnabled: true,
                } as ITestingSettings;
            }
        }

        // Support for travis.
        this.testing = this.testing
            ? this.testing
            : {
                  promptToConfigure: true,
                  debugPort: 3000,
                  pytestArgs: [],
                  pytestEnabled: false,
                  pytestPath: 'pytest',
                  unittestArgs: [],
                  unittestEnabled: false,
                  autoTestDiscoverOnSaveEnabled: true,
              };
        this.testing.pytestPath = getAbsolutePath(systemVariables.resolveAny(this.testing.pytestPath), workspaceRoot);
        if (this.testing.cwd) {
            this.testing.cwd = getAbsolutePath(systemVariables.resolveAny(this.testing.cwd), workspaceRoot);
        }

        // Resolve any variables found in the test arguments.
        this.testing.pytestArgs = this.testing.pytestArgs.map((arg) => systemVariables.resolveAny(arg));
        this.testing.unittestArgs = this.testing.unittestArgs.map((arg) => systemVariables.resolveAny(arg));

        const terminalSettings = systemVariables.resolveAny(pythonSettings.get<ITerminalSettings>('terminal'))!;
        if (this.terminal) {
            Object.assign<ITerminalSettings, ITerminalSettings>(this.terminal, terminalSettings);
        } else {
            this.terminal = terminalSettings;
            if (isTestExecution() && !this.terminal) {
                this.terminal = {} as ITerminalSettings;
            }
        }
        // Support for travis.
        this.terminal = this.terminal
            ? this.terminal
            : {
                  executeInFileDir: true,
                  focusAfterLaunch: false,
                  launchArgs: [],
                  activateEnvironment: true,
                  activateEnvInCurrentTerminal: false,
              };

        const experiments = systemVariables.resolveAny(pythonSettings.get<IExperiments>('experiments'))!;
        if (this.experiments) {
            Object.assign<IExperiments, IExperiments>(this.experiments, experiments);
        } else {
            this.experiments = experiments;
        }
        // Note we directly access experiment settings using workspace service in ExperimentService class.
        // Any changes here specific to these settings should propogate their as well.
        this.experiments = this.experiments
            ? this.experiments
            : {
                  enabled: true,
                  optInto: [],
                  optOutFrom: [],
              };

        const tensorBoardSettings = systemVariables.resolveAny(
            pythonSettings.get<ITensorBoardSettings>('tensorBoard'),
        )!;
        this.tensorBoard = tensorBoardSettings || { logDirectory: '' };
        if (this.tensorBoard.logDirectory) {
            this.tensorBoard.logDirectory = getAbsolutePath(this.tensorBoard.logDirectory, workspaceRoot);
        }
    }

    // eslint-disable-next-line class-methods-use-this
    protected getPythonExecutable(pythonPath: string): string {
        return getPythonExecutable(pythonPath);
    }

    protected onWorkspaceFoldersChanged(): void {
        // If an activated workspace folder was removed, delete its key
        const workspaceKeys = this.workspace.workspaceFolders!.map((workspaceFolder) => workspaceFolder.uri.fsPath);
        const activatedWkspcKeys = Array.from(PythonSettings.pythonSettings.keys());
        const activatedWkspcFoldersRemoved = activatedWkspcKeys.filter((item) => workspaceKeys.indexOf(item) < 0);
        if (activatedWkspcFoldersRemoved.length > 0) {
            for (const folder of activatedWkspcFoldersRemoved) {
                PythonSettings.pythonSettings.delete(folder);
            }
        }
    }

    public register(): void {
        PythonSettings.pythonSettings = new Map();
        this.initialize();
    }

    private onDidChanged(event?: ConfigurationChangeEvent) {
        const currentConfig = this.workspace.getConfiguration('python', this.workspaceRoot);
        this.update(currentConfig);

        // If workspace config changes, then we could have a cascading effect of on change events.
        // Let's defer the change notification.
        this.debounceChangeNotification(event);
    }

    public initialize(): void {
        this.disposables.push(this.workspace.onDidChangeWorkspaceFolders(this.onWorkspaceFoldersChanged, this));
        this.disposables.push(
            this.interpreterAutoSelectionService.onDidChangeAutoSelectedInterpreter(() => {
                this.onDidChanged();
            }),
        );
        this.disposables.push(
            this.workspace.onDidChangeConfiguration((event: ConfigurationChangeEvent) => {
                if (event.affectsConfiguration('python')) {
                    this.onDidChanged(event);
                }
            }),
        );
        if (this.interpreterPathService) {
            this.disposables.push(
                this.interpreterPathService.onDidChange(() => {
                    this.onDidChanged();
                }),
            );
        }

        const initialConfig = this.workspace.getConfiguration('python', this.workspaceRoot);
        if (initialConfig) {
            this.update(initialConfig);
        }
    }

    @debounceSync(1)
    protected debounceChangeNotification(event?: ConfigurationChangeEvent): void {
        this.changed.fire(event);
    }

    private getPythonPath(systemVariables: SystemVariables, workspaceRoot: string | undefined) {
        this.pythonPath = systemVariables.resolveAny(this.interpreterPathService.get(this.workspaceRoot))!;
        if (
            !process.env.CI_DISABLE_AUTO_SELECTION &&
            (this.pythonPath.length === 0 || this.pythonPath === 'python') &&
            this.interpreterAutoSelectionService
        ) {
            const autoSelectedPythonInterpreter = this.interpreterAutoSelectionService.getAutoSelectedInterpreter(
                this.workspaceRoot,
            );
            if (autoSelectedPythonInterpreter) {
                this.pythonPath = autoSelectedPythonInterpreter.path;
                if (this.workspaceRoot) {
                    this.interpreterAutoSelectionService
                        .setWorkspaceInterpreter(this.workspaceRoot, autoSelectedPythonInterpreter)
                        .ignoreErrors();
                }
            }
        }
        return getAbsolutePath(this.pythonPath, workspaceRoot);
    }
}

function getAbsolutePath(pathToCheck: string, rootDir: string | undefined): string {
    if (!rootDir) {
        rootDir = __dirname;
    }

    pathToCheck = untildify(pathToCheck) as string;
    if (isTestExecution() && !pathToCheck) {
        return rootDir;
    }
    if (pathToCheck.indexOf(path.sep) === -1) {
        return pathToCheck;
    }
    return path.isAbsolute(pathToCheck) ? pathToCheck : path.resolve(rootDir, pathToCheck);
}

function getPythonExecutable(pythonPath: string): string {
    pythonPath = untildify(pythonPath) as string;

    // If only 'python'.
    if (
        pythonPath === 'python' ||
        pythonPath.indexOf(path.sep) === -1 ||
        path.basename(pythonPath) === path.dirname(pythonPath)
    ) {
        return pythonPath;
    }

    if (isValidPythonPath(pythonPath)) {
        return pythonPath;
    }
    // Keep python right on top, for backwards compatibility.

    const KnownPythonExecutables = [
        'python',
        'python4',
        'python3.6',
        'python3.5',
        'python3',
        'python2.7',
        'python2',
        'python3.7',
        'python3.8',
        'python3.9',
    ];

    for (let executableName of KnownPythonExecutables) {
        // Suffix with 'python' for linux and 'osx', and 'python.exe' for 'windows'.
        if (IS_WINDOWS) {
            executableName = `${executableName}.exe`;
            if (isValidPythonPath(path.join(pythonPath, executableName))) {
                return path.join(pythonPath, executableName);
            }
            if (isValidPythonPath(path.join(pythonPath, 'Scripts', executableName))) {
                return path.join(pythonPath, 'Scripts', executableName);
            }
        } else {
            if (isValidPythonPath(path.join(pythonPath, executableName))) {
                return path.join(pythonPath, executableName);
            }
            if (isValidPythonPath(path.join(pythonPath, 'bin', executableName))) {
                return path.join(pythonPath, 'bin', executableName);
            }
        }
    }

    return pythonPath;
}

function isValidPythonPath(pythonPath: string): boolean {
    return (
        fs.existsSync(pythonPath) &&
        path.basename(getOSType() === OSType.Windows ? pythonPath.toLowerCase() : pythonPath).startsWith('python')
    );
}
