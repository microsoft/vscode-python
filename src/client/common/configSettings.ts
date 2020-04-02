'use strict';

import * as child_process from 'child_process';
import * as path from 'path';
import {
    ConfigurationChangeEvent,
    ConfigurationTarget,
    DiagnosticSeverity,
    Disposable,
    Event,
    EventEmitter,
    Uri,
    WorkspaceConfiguration
} from 'vscode';
import { LanguageServerType } from '../activation/types';
import '../common/extensions';
import { IInterpreterAutoSeletionProxyService, IInterpreterSecurityService } from '../interpreter/autoSelection/types';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { IWorkspaceService } from './application/types';
import { WorkspaceService } from './application/workspace';
import { DEFAULT_INTERPRETER_SETTING, isTestExecution } from './constants';
import { DeprecatePythonPath } from './experimentGroups';
import { ExtensionChannels } from './insidersBuild/types';
import { IS_WINDOWS } from './platform/constants';
import {
    IAnalysisSettings,
    IAutoCompleteSettings,
    IDataScienceSettings,
    IExperiments,
    IExperimentsManager,
    IFormattingSettings,
    IInterpreterPathService,
    ILintingSettings,
    IPythonSettings,
    ISortImportSettings,
    ITerminalSettings,
    ITestingSettings,
    IWorkspaceSymbolSettings,
    Resource
} from './types';
import { debounceSync } from './utils/decorators';
import { SystemVariables } from './variables/systemVariables';

// tslint:disable:no-require-imports no-var-requires
const untildify = require('untildify');

// tslint:disable-next-line:completed-docs
export class PythonSettings implements IPythonSettings {
    public get onDidChange(): Event<void> {
        return this.changed.event;
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
    public downloadLanguageServer = true;
    public jediEnabled = true;
    public jediPath = '';
    public jediMemoryLimit = 1024;
    public envFile = '';
    public venvPath = '';
    public venvFolders: string[] = [];
    public condaPath = '';
    public pipenvPath = '';
    public poetryPath = '';
    public devOptions: string[] = [];
    public linting!: ILintingSettings;
    public formatting!: IFormattingSettings;
    public autoComplete!: IAutoCompleteSettings;
    public testing!: ITestingSettings;
    public terminal!: ITerminalSettings;
    public sortImports!: ISortImportSettings;
    public workspaceSymbols!: IWorkspaceSymbolSettings;
    public disableInstallationChecks = false;
    public globalModuleInstallation = false;
    public analysis!: IAnalysisSettings;
    public autoUpdateLanguageServer: boolean = true;
    public datascience!: IDataScienceSettings;
    public insidersChannel!: ExtensionChannels;
    public experiments!: IExperiments;
    public languageServer: LanguageServerType = LanguageServerType.Microsoft;

    protected readonly changed = new EventEmitter<void>();
    private workspaceRoot: Resource;
    private disposables: Disposable[] = [];
    // tslint:disable-next-line:variable-name
    private _pythonPath = '';
    private _defaultInterpreterPath = '';
    private readonly workspace: IWorkspaceService;

    constructor(
        workspaceFolder: Resource,
        private readonly interpreterAutoSelectionService: IInterpreterAutoSeletionProxyService,
        workspace?: IWorkspaceService,
        private readonly experimentsManager?: IExperimentsManager,
        private readonly interpreterPathService?: IInterpreterPathService,
        private readonly interpreterSecurityService?: IInterpreterSecurityService
    ) {
        this.workspace = workspace || new WorkspaceService();
        this.workspaceRoot = workspaceFolder;
        this.initialize();
    }
    // tslint:disable-next-line:function-name
    public static getInstance(
        resource: Uri | undefined,
        interpreterAutoSelectionService: IInterpreterAutoSeletionProxyService,
        workspace?: IWorkspaceService,
        experimentsManager?: IExperimentsManager,
        interpreterPathService?: IInterpreterPathService,
        interpreterSecurityService?: IInterpreterSecurityService
    ): PythonSettings {
        workspace = workspace || new WorkspaceService();
        const workspaceFolderUri = PythonSettings.getSettingsUriAndTarget(resource, workspace).uri;
        const workspaceFolderKey = workspaceFolderUri ? workspaceFolderUri.fsPath : '';

        if (!PythonSettings.pythonSettings.has(workspaceFolderKey)) {
            const settings = new PythonSettings(
                workspaceFolderUri,
                interpreterAutoSelectionService,
                workspace,
                experimentsManager,
                interpreterPathService,
                interpreterSecurityService
            );
            PythonSettings.pythonSettings.set(workspaceFolderKey, settings);
            // Pass null to avoid VSC from complaining about not passing in a value.
            // tslint:disable-next-line:no-any
            const config = workspace.getConfiguration('editor', resource ? resource : (null as any));
            const formatOnType = config ? config.get('formatOnType', false) : false;
            sendTelemetryEvent(EventName.COMPLETION_ADD_BRACKETS, undefined, {
                enabled: settings.autoComplete ? settings.autoComplete.addBrackets : false
            });
            sendTelemetryEvent(EventName.FORMAT_ON_TYPE, undefined, { enabled: formatOnType });
        }
        // tslint:disable-next-line:no-non-null-assertion
        return PythonSettings.pythonSettings.get(workspaceFolderKey)!;
    }

    // tslint:disable-next-line:type-literal-delimiter
    public static getSettingsUriAndTarget(
        resource: Uri | undefined,
        workspace?: IWorkspaceService
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

    // tslint:disable-next-line:function-name
    public static dispose() {
        if (!isTestExecution()) {
            throw new Error('Dispose can only be called from unit tests');
        }
        // tslint:disable-next-line:no-void-expression
        PythonSettings.pythonSettings.forEach(item => item && item.dispose());
        PythonSettings.pythonSettings.clear();
    }
    public dispose() {
        // tslint:disable-next-line:no-unsafe-any
        this.disposables.forEach(disposable => disposable && disposable.dispose());
        this.disposables = [];
    }
    // tslint:disable-next-line:cyclomatic-complexity max-func-body-length
    protected update(pythonSettings: WorkspaceConfiguration) {
        const workspaceRoot = this.workspaceRoot?.fsPath;
        const systemVariables: SystemVariables = new SystemVariables(undefined, workspaceRoot, this.workspace);

        this.pythonPath = this.getPythonPath(pythonSettings, systemVariables, workspaceRoot);

        // tslint:disable-next-line:no-backbone-get-set-outside-model no-non-null-assertion
        const defaultInterpreterPath = systemVariables.resolveAny(pythonSettings.get<string>('defaultInterpreterPath'));
        this.defaultInterpreterPath = defaultInterpreterPath ? defaultInterpreterPath : DEFAULT_INTERPRETER_SETTING;
        this.defaultInterpreterPath = getAbsolutePath(this.defaultInterpreterPath, workspaceRoot);
        // tslint:disable-next-line:no-backbone-get-set-outside-model no-non-null-assertion
        this.venvPath = systemVariables.resolveAny(pythonSettings.get<string>('venvPath'))!;
        this.venvFolders = systemVariables.resolveAny(pythonSettings.get<string[]>('venvFolders'))!;
        const condaPath = systemVariables.resolveAny(pythonSettings.get<string>('condaPath'))!;
        this.condaPath = condaPath && condaPath.length > 0 ? getAbsolutePath(condaPath, workspaceRoot) : condaPath;
        const pipenvPath = systemVariables.resolveAny(pythonSettings.get<string>('pipenvPath'))!;
        this.pipenvPath = pipenvPath && pipenvPath.length > 0 ? getAbsolutePath(pipenvPath, workspaceRoot) : pipenvPath;
        const poetryPath = systemVariables.resolveAny(pythonSettings.get<string>('poetryPath'))!;
        this.poetryPath = poetryPath && poetryPath.length > 0 ? getAbsolutePath(poetryPath, workspaceRoot) : poetryPath;

        this.downloadLanguageServer = systemVariables.resolveAny(
            pythonSettings.get<boolean>('downloadLanguageServer', true)
        )!;
        this.jediEnabled = systemVariables.resolveAny(pythonSettings.get<boolean>('jediEnabled', true))!;
        this.autoUpdateLanguageServer = systemVariables.resolveAny(
            pythonSettings.get<boolean>('autoUpdateLanguageServer', true)
        )!;
        if (this.jediEnabled) {
            // tslint:disable-next-line:no-backbone-get-set-outside-model no-non-null-assertion
            this.jediPath = systemVariables.resolveAny(pythonSettings.get<string>('jediPath'))!;
            if (typeof this.jediPath === 'string' && this.jediPath.length > 0) {
                this.jediPath = getAbsolutePath(systemVariables.resolveAny(this.jediPath), workspaceRoot);
            } else {
                this.jediPath = '';
            }
            this.jediMemoryLimit = pythonSettings.get<number>('jediMemoryLimit')!;
        }

        let ls = pythonSettings.get<LanguageServerType>('languageServer');
        if (!ls) {
            ls = LanguageServerType.Jedi;
        }
        this.languageServer = systemVariables.resolveAny(ls)!;

        // tslint:disable-next-line:no-backbone-get-set-outside-model no-non-null-assertion
        this.envFile = systemVariables.resolveAny(pythonSettings.get<string>('envFile'))!;
        // tslint:disable-next-line:no-any
        // tslint:disable-next-line:no-backbone-get-set-outside-model no-non-null-assertion no-any
        this.devOptions = systemVariables.resolveAny(pythonSettings.get<any[]>('devOptions'))!;
        this.devOptions = Array.isArray(this.devOptions) ? this.devOptions : [];

        // tslint:disable-next-line:no-backbone-get-set-outside-model no-non-null-assertion
        const lintingSettings = systemVariables.resolveAny(pythonSettings.get<ILintingSettings>('linting'))!;
        if (this.linting) {
            Object.assign<ILintingSettings, ILintingSettings>(this.linting, lintingSettings);
        } else {
            this.linting = lintingSettings;
        }

        // tslint:disable-next-line:no-backbone-get-set-outside-model no-non-null-assertion
        const analysisSettings = systemVariables.resolveAny(pythonSettings.get<IAnalysisSettings>('analysis'))!;
        if (this.analysis) {
            Object.assign<IAnalysisSettings, IAnalysisSettings>(this.analysis, analysisSettings);
        } else {
            this.analysis = analysisSettings;
        }

        this.disableInstallationChecks = pythonSettings.get<boolean>('disableInstallationCheck') === true;
        this.globalModuleInstallation = pythonSettings.get<boolean>('globalModuleInstallation') === true;

        // tslint:disable-next-line:no-backbone-get-set-outside-model no-non-null-assertion
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
                  ignorePatterns: [],
                  flake8Args: [],
                  flake8Enabled: false,
                  flake8Path: 'flake',
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
                      warning: DiagnosticSeverity.Warning
                  },
                  pycodestyleCategorySeverity: {
                      E: DiagnosticSeverity.Error,
                      W: DiagnosticSeverity.Warning
                  },
                  flake8CategorySeverity: {
                      E: DiagnosticSeverity.Error,
                      W: DiagnosticSeverity.Warning,
                      // Per http://flake8.pycqa.org/en/latest/glossary.html#term-error-code
                      // 'F' does not mean 'fatal as in PyLint but rather 'pyflakes' such as
                      // unused imports, variables, etc.
                      F: DiagnosticSeverity.Warning
                  },
                  mypyCategorySeverity: {
                      error: DiagnosticSeverity.Error,
                      note: DiagnosticSeverity.Hint
                  },
                  pylintUseMinimalCheckers: false
              };
        this.linting.pylintPath = getAbsolutePath(systemVariables.resolveAny(this.linting.pylintPath), workspaceRoot);
        this.linting.flake8Path = getAbsolutePath(systemVariables.resolveAny(this.linting.flake8Path), workspaceRoot);
        this.linting.pycodestylePath = getAbsolutePath(
            systemVariables.resolveAny(this.linting.pycodestylePath),
            workspaceRoot
        );
        this.linting.pylamaPath = getAbsolutePath(systemVariables.resolveAny(this.linting.pylamaPath), workspaceRoot);
        this.linting.prospectorPath = getAbsolutePath(
            systemVariables.resolveAny(this.linting.prospectorPath),
            workspaceRoot
        );
        this.linting.pydocstylePath = getAbsolutePath(
            systemVariables.resolveAny(this.linting.pydocstylePath),
            workspaceRoot
        );
        this.linting.mypyPath = getAbsolutePath(systemVariables.resolveAny(this.linting.mypyPath), workspaceRoot);
        this.linting.banditPath = getAbsolutePath(systemVariables.resolveAny(this.linting.banditPath), workspaceRoot);

        // tslint:disable-next-line:no-backbone-get-set-outside-model no-non-null-assertion
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
                  yapfPath: 'yapf'
              };
        this.formatting.autopep8Path = getAbsolutePath(
            systemVariables.resolveAny(this.formatting.autopep8Path),
            workspaceRoot
        );
        this.formatting.yapfPath = getAbsolutePath(systemVariables.resolveAny(this.formatting.yapfPath), workspaceRoot);
        this.formatting.blackPath = getAbsolutePath(
            systemVariables.resolveAny(this.formatting.blackPath),
            workspaceRoot
        );

        // tslint:disable-next-line:no-backbone-get-set-outside-model no-non-null-assertion
        const autoCompleteSettings = systemVariables.resolveAny(
            pythonSettings.get<IAutoCompleteSettings>('autoComplete')
        )!;
        if (this.autoComplete) {
            Object.assign<IAutoCompleteSettings, IAutoCompleteSettings>(this.autoComplete, autoCompleteSettings);
        } else {
            this.autoComplete = autoCompleteSettings;
        }
        // Support for travis.
        this.autoComplete = this.autoComplete
            ? this.autoComplete
            : {
                  extraPaths: [],
                  addBrackets: false,
                  showAdvancedMembers: false,
                  typeshedPaths: []
              };

        // tslint:disable-next-line:no-backbone-get-set-outside-model no-non-null-assertion
        const workspaceSymbolsSettings = systemVariables.resolveAny(
            pythonSettings.get<IWorkspaceSymbolSettings>('workspaceSymbols')
        )!;
        if (this.workspaceSymbols) {
            Object.assign<IWorkspaceSymbolSettings, IWorkspaceSymbolSettings>(
                this.workspaceSymbols,
                workspaceSymbolsSettings
            );
        } else {
            this.workspaceSymbols = workspaceSymbolsSettings;
        }
        // Support for travis.
        this.workspaceSymbols = this.workspaceSymbols
            ? this.workspaceSymbols
            : {
                  ctagsPath: 'ctags',
                  enabled: true,
                  exclusionPatterns: [],
                  rebuildOnFileSave: true,
                  rebuildOnStart: true,
                  tagFilePath: workspaceRoot ? path.join(workspaceRoot, 'tags') : ''
              };
        this.workspaceSymbols.tagFilePath = getAbsolutePath(
            systemVariables.resolveAny(this.workspaceSymbols.tagFilePath),
            workspaceRoot
        );

        // tslint:disable-next-line:no-backbone-get-set-outside-model no-non-null-assertion
        const testSettings = systemVariables.resolveAny(pythonSettings.get<ITestingSettings>('testing'))!;
        if (this.testing) {
            Object.assign<ITestingSettings, ITestingSettings>(this.testing, testSettings);
        } else {
            this.testing = testSettings;
            if (isTestExecution() && !this.testing) {
                // tslint:disable-next-line:prefer-type-cast
                // tslint:disable-next-line:no-object-literal-type-assertion
                this.testing = {
                    nosetestArgs: [],
                    pytestArgs: [],
                    unittestArgs: [],
                    promptToConfigure: true,
                    debugPort: 3000,
                    nosetestsEnabled: false,
                    pytestEnabled: false,
                    unittestEnabled: false,
                    nosetestPath: 'nosetests',
                    pytestPath: 'pytest',
                    autoTestDiscoverOnSaveEnabled: true
                } as ITestingSettings;
            }
        }

        // Support for travis.
        this.testing = this.testing
            ? this.testing
            : {
                  promptToConfigure: true,
                  debugPort: 3000,
                  nosetestArgs: [],
                  nosetestPath: 'nosetest',
                  nosetestsEnabled: false,
                  pytestArgs: [],
                  pytestEnabled: false,
                  pytestPath: 'pytest',
                  unittestArgs: [],
                  unittestEnabled: false,
                  autoTestDiscoverOnSaveEnabled: true
              };
        this.testing.pytestPath = getAbsolutePath(systemVariables.resolveAny(this.testing.pytestPath), workspaceRoot);
        this.testing.nosetestPath = getAbsolutePath(
            systemVariables.resolveAny(this.testing.nosetestPath),
            workspaceRoot
        );
        if (this.testing.cwd) {
            this.testing.cwd = getAbsolutePath(systemVariables.resolveAny(this.testing.cwd), workspaceRoot);
        }

        // Resolve any variables found in the test arguments.
        this.testing.nosetestArgs = this.testing.nosetestArgs.map(arg => systemVariables.resolveAny(arg));
        this.testing.pytestArgs = this.testing.pytestArgs.map(arg => systemVariables.resolveAny(arg));
        this.testing.unittestArgs = this.testing.unittestArgs.map(arg => systemVariables.resolveAny(arg));

        // tslint:disable-next-line:no-backbone-get-set-outside-model no-non-null-assertion
        const terminalSettings = systemVariables.resolveAny(pythonSettings.get<ITerminalSettings>('terminal'))!;
        if (this.terminal) {
            Object.assign<ITerminalSettings, ITerminalSettings>(this.terminal, terminalSettings);
        } else {
            this.terminal = terminalSettings;
            if (isTestExecution() && !this.terminal) {
                // tslint:disable-next-line:prefer-type-cast
                // tslint:disable-next-line:no-object-literal-type-assertion
                this.terminal = {} as ITerminalSettings;
            }
        }
        // Support for travis.
        this.terminal = this.terminal
            ? this.terminal
            : {
                  executeInFileDir: true,
                  launchArgs: [],
                  activateEnvironment: true,
                  activateEnvInCurrentTerminal: false
              };

        const experiments = systemVariables.resolveAny(pythonSettings.get<IExperiments>('experiments'))!;
        if (this.experiments) {
            Object.assign<IExperiments, IExperiments>(this.experiments, experiments);
        } else {
            this.experiments = experiments;
        }
        this.experiments = this.experiments
            ? this.experiments
            : {
                  enabled: true,
                  optInto: [],
                  optOutFrom: []
              };

        const dataScienceSettings = systemVariables.resolveAny(
            pythonSettings.get<IDataScienceSettings>('dataScience')
        )!;
        if (this.datascience) {
            Object.assign<IDataScienceSettings, IDataScienceSettings>(this.datascience, dataScienceSettings);
        } else {
            this.datascience = dataScienceSettings;
        }

        this.insidersChannel = pythonSettings.get<ExtensionChannels>('insidersChannel')!;
    }

    protected getPythonExecutable(pythonPath: string) {
        return getPythonExecutable(pythonPath);
    }
    protected onWorkspaceFoldersChanged() {
        //If an activated workspace folder was removed, delete its key
        const workspaceKeys = this.workspace.workspaceFolders!.map(workspaceFolder => workspaceFolder.uri.fsPath);
        const activatedWkspcKeys = Array.from(PythonSettings.pythonSettings.keys());
        const activatedWkspcFoldersRemoved = activatedWkspcKeys.filter(item => workspaceKeys.indexOf(item) < 0);
        if (activatedWkspcFoldersRemoved.length > 0) {
            for (const folder of activatedWkspcFoldersRemoved) {
                PythonSettings.pythonSettings.delete(folder);
            }
        }
    }
    protected initialize(): void {
        const onDidChange = () => {
            const currentConfig = this.workspace.getConfiguration('python', this.workspaceRoot);
            this.update(currentConfig);

            // If workspace config changes, then we could have a cascading effect of on change events.
            // Let's defer the change notification.
            this.debounceChangeNotification();
        };
        this.disposables.push(this.workspace.onDidChangeWorkspaceFolders(this.onWorkspaceFoldersChanged, this));
        this.disposables.push(
            this.interpreterAutoSelectionService.onDidChangeAutoSelectedInterpreter(onDidChange.bind(this))
        );
        if (this.interpreterSecurityService) {
            this.disposables.push(this.interpreterSecurityService.onDidChangeSafeInterpreters(onDidChange.bind(this)));
        }
        this.disposables.push(
            this.workspace.onDidChangeConfiguration((event: ConfigurationChangeEvent) => {
                if (event.affectsConfiguration('python')) {
                    onDidChange();
                }
            })
        );
        if (this.interpreterPathService) {
            this.disposables.push(this.interpreterPathService.onDidChange(onDidChange.bind(this)));
        }

        const initialConfig = this.workspace.getConfiguration('python', this.workspaceRoot);
        if (initialConfig) {
            this.update(initialConfig);
        }
    }
    @debounceSync(1)
    protected debounceChangeNotification() {
        this.changed.fire();
    }

    private getPythonPath(
        pythonSettings: WorkspaceConfiguration,
        systemVariables: SystemVariables,
        workspaceRoot: string | undefined
    ) {
        /**
         * Note that while calling `IExperimentsManager.inExperiment()`, we assume `IExperimentsManager.activate()` is already called.
         * That's not true here, as this method is often called in the constructor,which runs before `.activate()` methods.
         * But we can still use it here for this particular experiment. Reason being that this experiment only changes
         * `pythonPath` setting, and I've checked that `pythonPath` setting is not accessed anywhere in the constructor.
         */
        const inExperiment = this.experimentsManager?.inExperiment(DeprecatePythonPath.experiment);
        this.experimentsManager?.sendTelemetryIfInExperiment(DeprecatePythonPath.control);
        // Use the interpreter path service if in the experiment otherwise use the normal settings
        this.pythonPath = systemVariables.resolveAny(
            inExperiment && this.interpreterPathService
                ? this.interpreterPathService.get(this.workspaceRoot)
                : pythonSettings.get<string>('pythonPath')
        )!;
        if (this.pythonPath.length === 0 || this.pythonPath === 'python') {
            const autoSelectedPythonInterpreter = this.interpreterAutoSelectionService.getAutoSelectedInterpreter(
                this.workspaceRoot
            );
            if (inExperiment && this.interpreterSecurityService) {
                if (
                    autoSelectedPythonInterpreter &&
                    this.interpreterSecurityService.isSafe(autoSelectedPythonInterpreter) &&
                    this.workspaceRoot
                ) {
                    this.pythonPath = autoSelectedPythonInterpreter.path;
                    this.interpreterAutoSelectionService
                        .setWorkspaceInterpreter(this.workspaceRoot, autoSelectedPythonInterpreter)
                        .ignoreErrors();
                }
            } else {
                if (autoSelectedPythonInterpreter && this.workspaceRoot) {
                    this.pythonPath = autoSelectedPythonInterpreter.path;
                    this.interpreterAutoSelectionService
                        .setWorkspaceInterpreter(this.workspaceRoot, autoSelectedPythonInterpreter)
                        .ignoreErrors();
                }
            }
        }
        if (inExperiment && this.pythonPath === DEFAULT_INTERPRETER_SETTING) {
            // This is to ensure that we ask users to select an interpreter in case auto selected interpreter is not safe to select
            this.pythonPath = '';
        }
        return getAbsolutePath(this.pythonPath, workspaceRoot);
    }
}

function getAbsolutePath(pathToCheck: string, rootDir: string | undefined): string {
    if (!rootDir) {
        rootDir = __dirname;
    }
    // tslint:disable-next-line:prefer-type-cast no-unsafe-any
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
    // tslint:disable-next-line:prefer-type-cast no-unsafe-any
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
    // tslint:disable-next-line:variable-name
    const KnownPythonExecutables = ['python', 'python4', 'python3.6', 'python3.5', 'python3', 'python2.7', 'python2'];

    for (let executableName of KnownPythonExecutables) {
        // Suffix with 'python' for linux and 'osx', and 'python.exe' for 'windows'.
        if (IS_WINDOWS) {
            executableName = `${executableName}.exe`;
            if (isValidPythonPath(path.join(pythonPath, executableName))) {
                return path.join(pythonPath, executableName);
            }
            if (isValidPythonPath(path.join(pythonPath, 'scripts', executableName))) {
                return path.join(pythonPath, 'scripts', executableName);
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
    try {
        const output = child_process.execFileSync(pythonPath, ['-c', 'print(1234)'], { encoding: 'utf8' });
        return output.startsWith('1234');
    } catch (ex) {
        return false;
    }
}
