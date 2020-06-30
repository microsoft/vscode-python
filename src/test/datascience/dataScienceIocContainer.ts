// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
//tslint:disable:trailing-comma no-any
import * as child_process from 'child_process';
import { ReactWrapper } from 'enzyme';
import * as fs from 'fs-extra';
import * as glob from 'glob';
import { interfaces } from 'inversify';
import * as os from 'os';
import * as path from 'path';
import { SemVer } from 'semver';
import { anything, instance, mock, reset, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import {
    CancellationTokenSource,
    ConfigurationChangeEvent,
    Disposable,
    Event,
    EventEmitter,
    FileSystemWatcher,
    Memento,
    Uri,
    WorkspaceFolder,
    WorkspaceFoldersChangeEvent
} from 'vscode';
import * as vsls from 'vsls/vscode';
import { KernelDaemonPool } from '../../client/datascience/kernel-launcher/kernelDaemonPool';

import { promisify } from 'util';
import { LanguageServerExtensionActivationService } from '../../client/activation/activationService';
import { LanguageServerDownloader } from '../../client/activation/common/downloader';
import { JediExtensionActivator } from '../../client/activation/jedi';
import { DotNetLanguageServerActivator } from '../../client/activation/languageServer/activator';
import { LanguageServerCompatibilityService } from '../../client/activation/languageServer/languageServerCompatibilityService';
import { LanguageServerExtension } from '../../client/activation/languageServer/languageServerExtension';
import { DotNetLanguageServerFolderService } from '../../client/activation/languageServer/languageServerFolderService';
import { DotNetLanguageServerPackageService } from '../../client/activation/languageServer/languageServerPackageService';
import { DotNetLanguageServerManager } from '../../client/activation/languageServer/manager';
import { NodeLanguageServerActivator } from '../../client/activation/node/activator';
import { NodeLanguageServerManager } from '../../client/activation/node/manager';
import {
    IExtensionSingleActivationService,
    ILanguageServerActivator,
    ILanguageServerAnalysisOptions,
    ILanguageServerCache,
    ILanguageServerCompatibilityService,
    ILanguageServerDownloader,
    ILanguageServerExtension,
    ILanguageServerFolderService,
    ILanguageServerManager,
    ILanguageServerPackageService,
    ILanguageServerProxy,
    LanguageServerType
} from '../../client/activation/types';
import {
    LSNotSupportedDiagnosticService,
    LSNotSupportedDiagnosticServiceId
} from '../../client/application/diagnostics/checks/lsNotSupported';
import { DiagnosticFilterService } from '../../client/application/diagnostics/filter';
import {
    DiagnosticCommandPromptHandlerService,
    DiagnosticCommandPromptHandlerServiceId,
    MessageCommandPrompt
} from '../../client/application/diagnostics/promptHandler';
import {
    IDiagnosticFilterService,
    IDiagnosticHandlerService,
    IDiagnosticsService
} from '../../client/application/diagnostics/types';
import { ApplicationEnvironment } from '../../client/common/application/applicationEnvironment';
import { ClipboardService } from '../../client/common/application/clipboard';
import { VSCodeNotebook } from '../../client/common/application/notebook';
import { TerminalManager } from '../../client/common/application/terminalManager';
import {
    IApplicationEnvironment,
    IApplicationShell,
    IClipboard,
    ICommandManager,
    ICustomEditorService,
    IDebugService,
    IDocumentManager,
    ILiveShareApi,
    ILiveShareTestingApi,
    ITerminalManager,
    IVSCodeNotebook,
    IWebPanelOptions,
    IWebPanelProvider,
    IWorkspaceService,
    WebPanelMessage
} from '../../client/common/application/types';
import { WebPanelProvider } from '../../client/common/application/webPanels/webPanelProvider';
import { WorkspaceService } from '../../client/common/application/workspace';
import { AsyncDisposableRegistry } from '../../client/common/asyncDisposableRegistry';
import { PythonSettings } from '../../client/common/configSettings';
import {
    EXTENSION_ROOT_DIR,
    UseCustomEditorApi,
    UseProposedApi,
    UseVSCodeNotebookEditorApi
} from '../../client/common/constants';
import { CryptoUtils } from '../../client/common/crypto';
import { DotNetCompatibilityService } from '../../client/common/dotnet/compatibilityService';
import { IDotNetCompatibilityService } from '../../client/common/dotnet/types';
import { LocalZMQKernel } from '../../client/common/experiments/groups';
import { ExperimentsManager } from '../../client/common/experiments/manager';
import { ExperimentService } from '../../client/common/experiments/service';
import { InstallationChannelManager } from '../../client/common/installer/channelManager';
import { ProductInstaller } from '../../client/common/installer/productInstaller';
import {
    CTagsProductPathService,
    DataScienceProductPathService,
    FormatterProductPathService,
    LinterProductPathService,
    RefactoringLibraryProductPathService,
    TestFrameworkProductPathService
} from '../../client/common/installer/productPath';
import { ProductService } from '../../client/common/installer/productService';
import { IInstallationChannelManager, IProductPathService, IProductService } from '../../client/common/installer/types';
import { InterpreterPathService } from '../../client/common/interpreterPathService';
import { traceInfo } from '../../client/common/logger';
import { BrowserService } from '../../client/common/net/browser';
import { HttpClient } from '../../client/common/net/httpClient';
import { IS_WINDOWS } from '../../client/common/platform/constants';
import { PathUtils } from '../../client/common/platform/pathUtils';
import { RegistryImplementation } from '../../client/common/platform/registry';
import { IFileSystem, IRegistry } from '../../client/common/platform/types';
import { CurrentProcess } from '../../client/common/process/currentProcess';
import { BufferDecoder } from '../../client/common/process/decoder';
import { ProcessLogger } from '../../client/common/process/logger';
import { ProcessServiceFactory } from '../../client/common/process/processFactory';
import { PythonExecutionFactory } from '../../client/common/process/pythonExecutionFactory';
import {
    IBufferDecoder,
    IProcessLogger,
    IProcessServiceFactory,
    IPythonExecutionFactory
} from '../../client/common/process/types';
import { StartPage } from '../../client/common/startPage/startPage';
import { IStartPage } from '../../client/common/startPage/types';
import { Bash } from '../../client/common/terminal/environmentActivationProviders/bash';
import { CommandPromptAndPowerShell } from '../../client/common/terminal/environmentActivationProviders/commandPrompt';
import { CondaActivationCommandProvider } from '../../client/common/terminal/environmentActivationProviders/condaActivationProvider';
import { PipEnvActivationCommandProvider } from '../../client/common/terminal/environmentActivationProviders/pipEnvActivationProvider';
import { PyEnvActivationCommandProvider } from '../../client/common/terminal/environmentActivationProviders/pyenvActivationProvider';
import { TerminalHelper } from '../../client/common/terminal/helper';
import { TerminalNameShellDetector } from '../../client/common/terminal/shellDetectors/terminalNameShellDetector';
import {
    IShellDetector,
    ITerminalActivationCommandProvider,
    ITerminalHelper,
    TerminalActivationProviders
} from '../../client/common/terminal/types';
import {
    BANNER_NAME_LS_SURVEY,
    GLOBAL_MEMENTO,
    IAsyncDisposableRegistry,
    IBrowserService,
    IConfigurationService,
    ICryptoUtils,
    ICurrentProcess,
    IDataScienceSettings,
    IDisposableRegistry,
    IExperimentService,
    IExperimentsManager,
    IExtensionContext,
    IExtensions,
    IHttpClient,
    IInstaller,
    IInterpreterPathService,
    IMemento,
    IOutputChannel,
    IPathUtils,
    IPersistentStateFactory,
    IPythonExtensionBanner,
    IPythonSettings,
    IsWindows,
    ProductType,
    Resource,
    WORKSPACE_MEMENTO
} from '../../client/common/types';
import { sleep } from '../../client/common/utils/async';
import { noop } from '../../client/common/utils/misc';
import { IMultiStepInputFactory, MultiStepInputFactory } from '../../client/common/utils/multiStepInput';
import { Architecture } from '../../client/common/utils/platform';
import { EnvironmentVariablesService } from '../../client/common/variables/environment';
import { EnvironmentVariablesProvider } from '../../client/common/variables/environmentVariablesProvider';
import { IEnvironmentVariablesProvider, IEnvironmentVariablesService } from '../../client/common/variables/types';
import { CodeCssGenerator } from '../../client/datascience/codeCssGenerator';
import { ExportCommands } from '../../client/datascience/commands/exportCommands';
import { Identifiers, JUPYTER_OUTPUT_CHANNEL } from '../../client/datascience/constants';
import { ActiveEditorContextService } from '../../client/datascience/context/activeEditorContext';
import { DataViewer } from '../../client/datascience/data-viewing/dataViewer';
import { DataViewerDependencyService } from '../../client/datascience/data-viewing/dataViewerDependencyService';
import { DataViewerFactory } from '../../client/datascience/data-viewing/dataViewerFactory';
import { JupyterVariableDataProvider } from '../../client/datascience/data-viewing/jupyterVariableDataProvider';
import { JupyterVariableDataProviderFactory } from '../../client/datascience/data-viewing/jupyterVariableDataProviderFactory';
import { IDataViewer, IDataViewerFactory } from '../../client/datascience/data-viewing/types';
import { DebugLocationTrackerFactory } from '../../client/datascience/debugLocationTrackerFactory';
import { CellHashProvider } from '../../client/datascience/editor-integration/cellhashprovider';
import { CodeLensFactory } from '../../client/datascience/editor-integration/codeLensFactory';
import { DataScienceCodeLensProvider } from '../../client/datascience/editor-integration/codelensprovider';
import { CodeWatcher } from '../../client/datascience/editor-integration/codewatcher';
import { HoverProvider } from '../../client/datascience/editor-integration/hoverProvider';
import { DataScienceErrorHandler } from '../../client/datascience/errorHandler/errorHandler';
import { ExportBase } from '../../client/datascience/export/exportBase';
import { ExportManager } from '../../client/datascience/export/exportManager';
import { ExportManagerDependencyChecker } from '../../client/datascience/export/exportManagerDependencyChecker';
import { ExportManagerFileOpener } from '../../client/datascience/export/exportManagerFileOpener';
import { ExportManagerFilePicker } from '../../client/datascience/export/exportManagerFilePicker';
import { ExportToHTML } from '../../client/datascience/export/exportToHTML';
import { ExportToPDF } from '../../client/datascience/export/exportToPDF';
import { ExportToPython } from '../../client/datascience/export/exportToPython';
import { ExportFormat, IExport, IExportManager, IExportManagerFilePicker } from '../../client/datascience/export/types';
import { GatherProvider } from '../../client/datascience/gather/gather';
import { GatherListener } from '../../client/datascience/gather/gatherListener';
import { GatherLogger } from '../../client/datascience/gather/gatherLogger';
import { IntellisenseProvider } from '../../client/datascience/interactive-common/intellisense/intellisenseProvider';
import { NotebookProvider } from '../../client/datascience/interactive-common/notebookProvider';
import { NotebookServerProvider } from '../../client/datascience/interactive-common/notebookServerProvider';
import { AutoSaveService } from '../../client/datascience/interactive-ipynb/autoSaveService';
import { DigestStorage } from '../../client/datascience/interactive-ipynb/digestStorage';
import { NativeEditor } from '../../client/datascience/interactive-ipynb/nativeEditor';
import { NativeEditorCommandListener } from '../../client/datascience/interactive-ipynb/nativeEditorCommandListener';
import { NativeEditorOldWebView } from '../../client/datascience/interactive-ipynb/nativeEditorOldWebView';
import { NativeEditorRunByLineListener } from '../../client/datascience/interactive-ipynb/nativeEditorRunByLineListener';
import { NativeEditorStorage } from '../../client/datascience/interactive-ipynb/nativeEditorStorage';
import { NativeEditorSynchronizer } from '../../client/datascience/interactive-ipynb/nativeEditorSynchronizer';
import {
    INotebookStorageProvider,
    NotebookStorageProvider
} from '../../client/datascience/interactive-ipynb/notebookStorageProvider';
import { TrustService } from '../../client/datascience/interactive-ipynb/trustService';
import { InteractiveWindow } from '../../client/datascience/interactive-window/interactiveWindow';
import { InteractiveWindowCommandListener } from '../../client/datascience/interactive-window/interactiveWindowCommandListener';
import { IPyWidgetHandler } from '../../client/datascience/ipywidgets/ipywidgetHandler';
import { IPyWidgetMessageDispatcherFactory } from '../../client/datascience/ipywidgets/ipyWidgetMessageDispatcherFactory';
import { IPyWidgetScriptSource } from '../../client/datascience/ipywidgets/ipyWidgetScriptSource';
import { DebuggerVariableRegistration } from '../../client/datascience/jupyter/debuggerVariableRegistration';
import { DebuggerVariables } from '../../client/datascience/jupyter/debuggerVariables';
import { JupyterCommandFactory } from '../../client/datascience/jupyter/interpreter/jupyterCommand';
import { JupyterInterpreterDependencyService } from '../../client/datascience/jupyter/interpreter/jupyterInterpreterDependencyService';
import { JupyterInterpreterOldCacheStateStore } from '../../client/datascience/jupyter/interpreter/jupyterInterpreterOldCacheStateStore';
import { JupyterInterpreterSelectionCommand } from '../../client/datascience/jupyter/interpreter/jupyterInterpreterSelectionCommand';
import { JupyterInterpreterSelector } from '../../client/datascience/jupyter/interpreter/jupyterInterpreterSelector';
import { JupyterInterpreterService } from '../../client/datascience/jupyter/interpreter/jupyterInterpreterService';
import { JupyterInterpreterStateStore } from '../../client/datascience/jupyter/interpreter/jupyterInterpreterStateStore';
import { JupyterInterpreterSubCommandExecutionService } from '../../client/datascience/jupyter/interpreter/jupyterInterpreterSubCommandExecutionService';
import { JupyterDebugger } from '../../client/datascience/jupyter/jupyterDebugger';
import { JupyterExecutionFactory } from '../../client/datascience/jupyter/jupyterExecutionFactory';
import { JupyterExporter } from '../../client/datascience/jupyter/jupyterExporter';
import { JupyterImporter } from '../../client/datascience/jupyter/jupyterImporter';
import { JupyterNotebookProvider } from '../../client/datascience/jupyter/jupyterNotebookProvider';
import { JupyterPasswordConnect } from '../../client/datascience/jupyter/jupyterPasswordConnect';
import { JupyterServerWrapper } from '../../client/datascience/jupyter/jupyterServerWrapper';
import { JupyterSessionManagerFactory } from '../../client/datascience/jupyter/jupyterSessionManagerFactory';
import { JupyterVariables } from '../../client/datascience/jupyter/jupyterVariables';
import { KernelDependencyService } from '../../client/datascience/jupyter/kernels/kernelDependencyService';
import { KernelSelectionProvider } from '../../client/datascience/jupyter/kernels/kernelSelections';
import { KernelSelector } from '../../client/datascience/jupyter/kernels/kernelSelector';
import { KernelService } from '../../client/datascience/jupyter/kernels/kernelService';
import { KernelSwitcher } from '../../client/datascience/jupyter/kernels/kernelSwitcher';
import { KernelVariables } from '../../client/datascience/jupyter/kernelVariables';
import { NotebookStarter } from '../../client/datascience/jupyter/notebookStarter';
import { OldJupyterVariables } from '../../client/datascience/jupyter/oldJupyterVariables';
import { ServerPreload } from '../../client/datascience/jupyter/serverPreload';
import { JupyterServerSelector } from '../../client/datascience/jupyter/serverSelector';
import { JupyterDebugService } from '../../client/datascience/jupyterDebugService';
import { JupyterUriProviderRegistration } from '../../client/datascience/jupyterUriProviderRegistration';
import { KernelDaemonPreWarmer } from '../../client/datascience/kernel-launcher/kernelDaemonPreWarmer';
import { KernelFinder } from '../../client/datascience/kernel-launcher/kernelFinder';
import { KernelLauncher } from '../../client/datascience/kernel-launcher/kernelLauncher';
import { IKernelFinder, IKernelLauncher } from '../../client/datascience/kernel-launcher/types';
import { NotebookAndInteractiveWindowUsageTracker } from '../../client/datascience/notebookAndInteractiveTracker';
import { NotebookModelFactory } from '../../client/datascience/notebookStorage/factory';
import { INotebookModelFactory } from '../../client/datascience/notebookStorage/types';
import { PlotViewer } from '../../client/datascience/plotting/plotViewer';
import { PlotViewerProvider } from '../../client/datascience/plotting/plotViewerProvider';
import { ProgressReporter } from '../../client/datascience/progress/progressReporter';
import { RawNotebookProviderWrapper } from '../../client/datascience/raw-kernel/rawNotebookProviderWrapper';
import { RawNotebookSupportedService } from '../../client/datascience/raw-kernel/rawNotebookSupportedService';
import { StatusProvider } from '../../client/datascience/statusProvider';
import { ThemeFinder } from '../../client/datascience/themeFinder';
import {
    ICellHashListener,
    ICellHashProvider,
    ICodeCssGenerator,
    ICodeLensFactory,
    ICodeWatcher,
    IDataScience,
    IDataScienceCodeLensProvider,
    IDataScienceCommandListener,
    IDataScienceErrorHandler,
    IDebugLocationTracker,
    IDigestStorage,
    IGatherLogger,
    IGatherProvider,
    IInteractiveWindow,
    IInteractiveWindowListener,
    IInteractiveWindowProvider,
    IJupyterCommandFactory,
    IJupyterDebugger,
    IJupyterDebugService,
    IJupyterExecution,
    IJupyterInterpreterDependencyManager,
    IJupyterNotebookProvider,
    IJupyterPasswordConnect,
    IJupyterServerProvider,
    IJupyterSessionManagerFactory,
    IJupyterSubCommandExecutionService,
    IJupyterUriProviderRegistration,
    IJupyterVariableDataProvider,
    IJupyterVariableDataProviderFactory,
    IJupyterVariables,
    IKernelDependencyService,
    INotebookAndInteractiveWindowUsageTracker,
    INotebookEditor,
    INotebookEditorProvider,
    INotebookExecutionLogger,
    INotebookExporter,
    INotebookImporter,
    INotebookProvider,
    INotebookServer,
    INotebookStorage,
    IPlotViewer,
    IPlotViewerProvider,
    IRawNotebookProvider,
    IRawNotebookSupportedService,
    IStatusProvider,
    IThemeFinder,
    ITrustService
} from '../../client/datascience/types';
import { ProtocolParser } from '../../client/debugger/extension/helpers/protocolParser';
import { IProtocolParser } from '../../client/debugger/extension/types';
import {
    EnvironmentActivationService,
    EnvironmentActivationServiceCache
} from '../../client/interpreter/activation/service';
import { IEnvironmentActivationService } from '../../client/interpreter/activation/types';
import { InterpreterEvaluation } from '../../client/interpreter/autoSelection/interpreterSecurity/interpreterEvaluation';
import { InterpreterSecurityService } from '../../client/interpreter/autoSelection/interpreterSecurity/interpreterSecurityService';
import { InterpreterSecurityStorage } from '../../client/interpreter/autoSelection/interpreterSecurity/interpreterSecurityStorage';
import {
    IInterpreterEvaluation,
    IInterpreterSecurityService,
    IInterpreterSecurityStorage
} from '../../client/interpreter/autoSelection/types';
import { InterpreterComparer } from '../../client/interpreter/configuration/interpreterComparer';
import { InterpreterSelector } from '../../client/interpreter/configuration/interpreterSelector/interpreterSelector';
import { PythonPathUpdaterService } from '../../client/interpreter/configuration/pythonPathUpdaterService';
import { PythonPathUpdaterServiceFactory } from '../../client/interpreter/configuration/pythonPathUpdaterServiceFactory';
import {
    IInterpreterComparer,
    IInterpreterSelector,
    IPythonPathUpdaterServiceFactory,
    IPythonPathUpdaterServiceManager
} from '../../client/interpreter/configuration/types';
import {
    CONDA_ENV_FILE_SERVICE,
    CONDA_ENV_SERVICE,
    CURRENT_PATH_SERVICE,
    GLOBAL_VIRTUAL_ENV_SERVICE,
    ICondaService,
    IInterpreterDisplay,
    IInterpreterHelper,
    IInterpreterLocatorHelper,
    IInterpreterLocatorService,
    IInterpreterService,
    IInterpreterVersionService,
    IInterpreterWatcher,
    IInterpreterWatcherBuilder,
    IKnownSearchPathsForInterpreters,
    INTERPRETER_LOCATOR_SERVICE,
    IShebangCodeLensProvider,
    IVirtualEnvironmentsSearchPathProvider,
    KNOWN_PATH_SERVICE,
    PIPENV_SERVICE,
    WINDOWS_REGISTRY_SERVICE,
    WORKSPACE_VIRTUAL_ENV_SERVICE
} from '../../client/interpreter/contracts';
import { ShebangCodeLensProvider } from '../../client/interpreter/display/shebangCodeLensProvider';
import { InterpreterHelper } from '../../client/interpreter/helpers';
import { InterpreterVersionService } from '../../client/interpreter/interpreterVersion';
import { IPipEnvServiceHelper, IPythonInPathCommandProvider } from '../../client/interpreter/locators/types';
import { registerInterpreterTypes } from '../../client/interpreter/serviceRegistry';
import { VirtualEnvironmentManager } from '../../client/interpreter/virtualEnvs';
import { IVirtualEnvironmentManager } from '../../client/interpreter/virtualEnvs/types';
import { LanguageServerSurveyBanner } from '../../client/languageServices/languageServerSurveyBanner';
import { PythonInterpreterLocatorService } from '../../client/pythonEnvironments/discovery/locators';
import { InterpreterLocatorHelper } from '../../client/pythonEnvironments/discovery/locators/helpers';
import { CacheableLocatorPromiseCache } from '../../client/pythonEnvironments/discovery/locators/services/cacheableLocatorService';
import { CondaEnvFileService } from '../../client/pythonEnvironments/discovery/locators/services/condaEnvFileService';
import { CondaEnvService } from '../../client/pythonEnvironments/discovery/locators/services/condaEnvService';
import {
    CurrentPathService,
    PythonInPathCommandProvider
} from '../../client/pythonEnvironments/discovery/locators/services/currentPathService';
import {
    GlobalVirtualEnvironmentsSearchPathProvider,
    GlobalVirtualEnvService
} from '../../client/pythonEnvironments/discovery/locators/services/globalVirtualEnvService';
import { InterpreterHashProvider } from '../../client/pythonEnvironments/discovery/locators/services/hashProvider';
import { InterpeterHashProviderFactory } from '../../client/pythonEnvironments/discovery/locators/services/hashProviderFactory';
import { InterpreterFilter } from '../../client/pythonEnvironments/discovery/locators/services/interpreterFilter';
import { InterpreterWatcherBuilder } from '../../client/pythonEnvironments/discovery/locators/services/interpreterWatcherBuilder';
import {
    KnownPathsService,
    KnownSearchPathsForInterpreters
} from '../../client/pythonEnvironments/discovery/locators/services/KnownPathsService';
import { PipEnvService } from '../../client/pythonEnvironments/discovery/locators/services/pipEnvService';
import { PipEnvServiceHelper } from '../../client/pythonEnvironments/discovery/locators/services/pipEnvServiceHelper';
import { WindowsRegistryService } from '../../client/pythonEnvironments/discovery/locators/services/windowsRegistryService';
import { WindowsStoreInterpreter } from '../../client/pythonEnvironments/discovery/locators/services/windowsStoreInterpreter';
import {
    WorkspaceVirtualEnvironmentsSearchPathProvider,
    WorkspaceVirtualEnvService
} from '../../client/pythonEnvironments/discovery/locators/services/workspaceVirtualEnvService';
import { WorkspaceVirtualEnvWatcherService } from '../../client/pythonEnvironments/discovery/locators/services/workspaceVirtualEnvWatcherService';
import { InterpreterType, PythonInterpreter } from '../../client/pythonEnvironments/info';
import { CodeExecutionHelper } from '../../client/terminals/codeExecution/helper';
import { ICodeExecutionHelper } from '../../client/terminals/types';
import { MockOutputChannel } from '../mockClasses';
import { MockAutoSelectionService } from '../mocks/autoSelector';
import { UnitTestIocContainer } from '../testing/serviceRegistry';
import { MockCommandManager } from './mockCommandManager';
import { MockCustomEditorService } from './mockCustomEditorService';
import { MockDebuggerService } from './mockDebugService';
import { MockDocumentManager } from './mockDocumentManager';
import { MockExtensions } from './mockExtensions';
import { MockFileSystem } from './mockFileSystem';
import { MockJupyterManager, SupportedCommands } from './mockJupyterManager';
import { MockJupyterManagerFactory } from './mockJupyterManagerFactory';
import { MockLanguageServerAnalysisOptions } from './mockLanguageServerAnalysisOptions';
import { MockLanguageServerProxy } from './mockLanguageServerProxy';
import { MockLiveShareApi } from './mockLiveShare';
import { MockPythonSettings } from './mockPythonSettings';
import { MockWorkspaceConfiguration } from './mockWorkspaceConfig';
import { MockWorkspaceFolder } from './mockWorkspaceFolder';
import { IMountedWebViewFactory, MountedWebViewFactory } from './mountedWebViewFactory';
import { TestExecutionLogger } from './testexecutionLogger';
import { TestInteractiveWindowProvider } from './testInteractiveWindowProvider';
import { TestNativeEditorProvider } from './testNativeEditorProvider';
import { TestPersistentStateFactory } from './testPersistentStateFactory';
import { WebBrowserPanelProvider } from './uiTests/webBrowserPanelProvider';

export class DataScienceIocContainer extends UnitTestIocContainer {
    public get workingInterpreter() {
        return this.workingPython;
    }

    public get workingInterpreter2() {
        return this.workingPython2;
    }

    public get onContextSet(): Event<{ name: string; value: boolean }> {
        return this.contextSetEvent.event;
    }

    public get mockJupyter(): MockJupyterManager | undefined {
        return this.jupyterMock ? this.jupyterMock.getManager() : undefined;
    }

    public get kernelService() {
        return this.kernelServiceMock;
    }
    private static jupyterInterpreters: PythonInterpreter[] = [];
    private static foundPythonPath: string | undefined;
    public applicationShell!: TypeMoq.IMock<IApplicationShell>;
    // tslint:disable-next-line:no-any
    public datascience!: TypeMoq.IMock<IDataScience>;
    public shouldMockJupyter: boolean;
    private commandManager: MockCommandManager = new MockCommandManager();
    private setContexts: Record<string, boolean> = {};
    private contextSetEvent: EventEmitter<{ name: string; value: boolean }> = new EventEmitter<{
        name: string;
        value: boolean;
    }>();
    private jupyterMock: MockJupyterManagerFactory | undefined;
    private asyncRegistry: AsyncDisposableRegistry;
    private configChangeEvent = new EventEmitter<ConfigurationChangeEvent>();
    private worksaceFoldersChangedEvent = new EventEmitter<WorkspaceFoldersChangeEvent>();
    private documentManager = new MockDocumentManager();
    private workingPython: PythonInterpreter = {
        path: '/foo/bar/python.exe',
        version: new SemVer('3.6.6-final'),
        sysVersion: '1.0.0.0',
        sysPrefix: 'Python',
        displayName: 'Python',
        type: InterpreterType.Unknown,
        architecture: Architecture.x64
    };
    private workingPython2: PythonInterpreter = {
        path: '/foo/baz/python.exe',
        version: new SemVer('3.6.7-final'),
        sysVersion: '1.0.0.0',
        sysPrefix: 'Python',
        displayName: 'Python',
        type: InterpreterType.Unknown,
        architecture: Architecture.x64
    };

    private webPanelProvider = mock(WebPanelProvider);
    private settingsMap = new Map<string, any>();
    private configMap = new Map<string, MockWorkspaceConfiguration>();
    private emptyConfig = new MockWorkspaceConfiguration();
    private workspaceFolders: MockWorkspaceFolder[] = [];
    private defaultPythonPath: string | undefined;
    private kernelServiceMock = mock(KernelService);
    private disposed = false;
    private experimentState = new Map<string, boolean>();
    private extensionRootPath: string | undefined;
    private languageServerType: LanguageServerType = LanguageServerType.Microsoft;

    constructor(private readonly uiTest: boolean = false) {
        super();
        this.useVSCodeAPI = false;
        const isRollingBuild = process.env ? process.env.VSCODE_PYTHON_ROLLING !== undefined : false;
        this.shouldMockJupyter = !isRollingBuild;
        this.asyncRegistry = new AsyncDisposableRegistry();
    }

    public async dispose(): Promise<void> {
        // Make sure to disable all command handling during dispose. Don't want
        // anything to startup again.
        this.commandManager.dispose();
        try {
            // Make sure to delete any temp files written by native editor storage
            const globPr = promisify(glob);
            const tempLocation = os.tmpdir;
            const tempFiles = await globPr(`${tempLocation}/*.ipynb`);
            if (tempFiles && tempFiles.length) {
                await Promise.all(tempFiles.map((t) => fs.remove(t)));
            }
        } catch (exc) {
            // tslint:disable-next-line: no-console
            console.log(`Exception on cleanup: ${exc}`);
        }
        await this.asyncRegistry.dispose();
        await super.dispose();
        this.disposed = true;

        if (!this.uiTest) {
            // Blur window focus so we don't have editors polling
            // tslint:disable-next-line: no-require-imports
            const reactHelpers = require('./reactHelpers') as typeof import('./reactHelpers');
            reactHelpers.blurWindow();
        }

        // Bounce this so that our editor has time to shutdown
        await sleep(150);

        if (!this.uiTest) {
            // Clear out the monaco global services. Some of these services are preventing shutdown.
            // tslint:disable: no-require-imports
            const services = require('monaco-editor/esm/vs/editor/standalone/browser/standaloneServices') as any;
            if (services.StaticServices) {
                const keys = Object.keys(services.StaticServices);
                keys.forEach((k) => {
                    const service = services.StaticServices[k] as any;
                    if (service && service._value && service._value.dispose) {
                        if (typeof service._value.dispose === 'function') {
                            service._value.dispose();
                        }
                    }
                });
            }
            // This file doesn't have an export so we can't force a dispose. Instead it has a 5 second timeout
            const config = require('monaco-editor/esm/vs/editor/browser/config/configuration') as any;
            if (config.getCSSBasedConfiguration) {
                config.getCSSBasedConfiguration().dispose();
            }
        }

        // Because there are outstanding promises holding onto this object, clear out everything we can
        this.workspaceFolders = [];
        this.settingsMap.clear();
        this.configMap.clear();
        this.setContexts = {};
        reset(this.webPanelProvider);

        // Turn off the static maps for the environment and conda services. Otherwise this
        // can mess up tests that don't depend upon them
        CacheableLocatorPromiseCache.forceUseNormal();
        EnvironmentActivationServiceCache.forceUseNormal();
    }

    //tslint:disable:max-func-body-length
    public registerDataScienceTypes(
        useCustomEditor: boolean = false,
        languageServerType: LanguageServerType = LanguageServerType.Microsoft
    ) {
        // Save our language server type
        this.languageServerType = languageServerType;

        // Inform the cacheable locator service to use a static map so that it stays in memory in between tests
        CacheableLocatorPromiseCache.forceUseStatic();

        // Do the same thing for the environment variable activation service.
        EnvironmentActivationServiceCache.forceUseStatic();

        // Make sure the default python path is set.
        this.defaultPythonPath = this.findPythonPath();

        // Create the workspace service first as it's used to set config values.
        this.createWorkspaceService();

        // Setup our webpanel provider to create our dummy web panel
        when(this.webPanelProvider.create(anything())).thenCall(this.onCreateWebPanel.bind(this));
        if (this.uiTest) {
            this.serviceManager.addSingleton<IWebPanelProvider>(IWebPanelProvider, WebBrowserPanelProvider);
            this.serviceManager.add<IInteractiveWindowListener>(IInteractiveWindowListener, IPyWidgetScriptSource);
            this.serviceManager.addSingleton<IHttpClient>(IHttpClient, HttpClient);
        } else {
            this.serviceManager.addSingletonInstance<IWebPanelProvider>(
                IWebPanelProvider,
                instance(this.webPanelProvider)
            );
        }
        this.serviceManager.addSingleton<IExportManager>(ExportManager, ExportManager);
        this.serviceManager.addSingleton<IExportManager>(
            ExportManagerDependencyChecker,
            ExportManagerDependencyChecker
        );
        this.serviceManager.addSingleton<INotebookModelFactory>(INotebookModelFactory, NotebookModelFactory);
        this.serviceManager.addSingleton<IExportManager>(IExportManager, ExportManagerFileOpener);
        this.serviceManager.addSingleton<IExport>(IExport, ExportToPDF, ExportFormat.pdf);
        this.serviceManager.addSingleton<IExport>(IExport, ExportToHTML, ExportFormat.html);
        this.serviceManager.addSingleton<IExport>(IExport, ExportToPython, ExportFormat.python);
        this.serviceManager.addSingleton<IExport>(IExport, ExportBase, 'Export Base');
        this.serviceManager.addSingleton<ExportCommands>(ExportCommands, ExportCommands);
        this.serviceManager.addSingleton<IExportManagerFilePicker>(IExportManagerFilePicker, ExportManagerFilePicker);
        this.serviceManager.addSingleton<IMountedWebViewFactory>(IMountedWebViewFactory, MountedWebViewFactory);
        this.registerFileSystemTypes();
        this.serviceManager.rebindInstance<IFileSystem>(IFileSystem, new MockFileSystem());
        this.serviceManager.addSingleton<IJupyterExecution>(IJupyterExecution, JupyterExecutionFactory);
        this.serviceManager.addSingleton<IInteractiveWindowProvider>(
            IInteractiveWindowProvider,
            TestInteractiveWindowProvider
        );
        this.serviceManager.addSingletonInstance(UseProposedApi, false);
        this.serviceManager.addSingletonInstance(UseCustomEditorApi, useCustomEditor);
        this.serviceManager.addSingletonInstance(UseVSCodeNotebookEditorApi, false);
        this.serviceManager.addSingleton<IDataViewerFactory>(IDataViewerFactory, DataViewerFactory);
        this.serviceManager.add<IJupyterVariableDataProvider>(
            IJupyterVariableDataProvider,
            JupyterVariableDataProvider
        );
        this.serviceManager.addSingleton<IJupyterVariableDataProviderFactory>(
            IJupyterVariableDataProviderFactory,
            JupyterVariableDataProviderFactory
        );
        this.serviceManager.addSingleton<IPlotViewerProvider>(IPlotViewerProvider, PlotViewerProvider);
        this.serviceManager.add<IInteractiveWindow>(IInteractiveWindow, InteractiveWindow);
        this.serviceManager.add<IDataViewer>(IDataViewer, DataViewer);
        this.serviceManager.add<IPlotViewer>(IPlotViewer, PlotViewer);
        this.serviceManager.add<IStartPage>(IStartPage, StartPage);
        this.serviceManager.addSingleton<IExperimentService>(IExperimentService, ExperimentService);
        this.serviceManager.addSingleton<IApplicationEnvironment>(IApplicationEnvironment, ApplicationEnvironment);
        this.serviceManager.add<INotebookImporter>(INotebookImporter, JupyterImporter);
        this.serviceManager.add<INotebookExporter>(INotebookExporter, JupyterExporter);
        this.serviceManager.addSingleton<ILiveShareApi>(ILiveShareApi, MockLiveShareApi);
        this.serviceManager.addSingleton<IExtensions>(IExtensions, MockExtensions);
        this.serviceManager.add<INotebookServer>(INotebookServer, JupyterServerWrapper);
        this.serviceManager.add<IJupyterCommandFactory>(IJupyterCommandFactory, JupyterCommandFactory);
        this.serviceManager.addSingleton<IRawNotebookProvider>(IRawNotebookProvider, RawNotebookProviderWrapper);
        this.serviceManager.addSingleton<IRawNotebookSupportedService>(
            IRawNotebookSupportedService,
            RawNotebookSupportedService
        );
        this.serviceManager.addSingleton<IThemeFinder>(IThemeFinder, ThemeFinder);
        this.serviceManager.addSingleton<ICodeCssGenerator>(ICodeCssGenerator, CodeCssGenerator);
        this.serviceManager.addSingleton<IStatusProvider>(IStatusProvider, StatusProvider);
        this.serviceManager.addSingleton<IInterpreterPathService>(IInterpreterPathService, InterpreterPathService);
        this.serviceManager.addSingleton<IBrowserService>(IBrowserService, BrowserService);
        this.serviceManager.addSingletonInstance<IAsyncDisposableRegistry>(
            IAsyncDisposableRegistry,
            this.asyncRegistry
        );
        this.serviceManager.addSingleton<IEnvironmentActivationService>(
            IEnvironmentActivationService,
            EnvironmentActivationService
        );
        this.serviceManager.add<ICodeWatcher>(ICodeWatcher, CodeWatcher);
        this.serviceManager.add<IDataScienceCodeLensProvider>(
            IDataScienceCodeLensProvider,
            DataScienceCodeLensProvider
        );
        this.serviceManager.add<ICodeExecutionHelper>(ICodeExecutionHelper, CodeExecutionHelper);
        this.serviceManager.add<IDataScienceCommandListener>(
            IDataScienceCommandListener,
            InteractiveWindowCommandListener
        );
        this.serviceManager.addSingleton<IDataScienceErrorHandler>(IDataScienceErrorHandler, DataScienceErrorHandler);
        this.serviceManager.add<IInstallationChannelManager>(IInstallationChannelManager, InstallationChannelManager);
        this.serviceManager.addSingleton<IExtensionSingleActivationService>(
            IExtensionSingleActivationService,
            DebuggerVariableRegistration
        );
        this.serviceManager.addSingleton<IJupyterVariables>(
            IJupyterVariables,
            JupyterVariables,
            Identifiers.ALL_VARIABLES
        );
        this.serviceManager.addSingleton<IJupyterVariables>(
            IJupyterVariables,
            OldJupyterVariables,
            Identifiers.OLD_VARIABLES
        );
        this.serviceManager.addSingleton<IJupyterVariables>(
            IJupyterVariables,
            KernelVariables,
            Identifiers.KERNEL_VARIABLES
        );
        this.serviceManager.addSingleton<IJupyterVariables>(
            IJupyterVariables,
            DebuggerVariables,
            Identifiers.DEBUGGER_VARIABLES
        );
        this.serviceManager.addSingleton<IJupyterDebugger>(IJupyterDebugger, JupyterDebugger, undefined, [
            ICellHashListener
        ]);
        this.serviceManager.addSingleton<IDebugLocationTracker>(IDebugLocationTracker, DebugLocationTrackerFactory);
        this.serviceManager.addSingleton<INotebookEditorProvider>(INotebookEditorProvider, TestNativeEditorProvider);
        this.serviceManager.addSingleton<DataViewerDependencyService>(
            DataViewerDependencyService,
            DataViewerDependencyService
        );
        this.serviceManager.add<INotebookEditor>(
            INotebookEditor,
            useCustomEditor ? NativeEditor : NativeEditorOldWebView
        );

        this.serviceManager.addSingleton<IDataScienceCommandListener>(
            IDataScienceCommandListener,
            NativeEditorCommandListener
        );
        this.serviceManager.addSingletonInstance<IOutputChannel>(
            IOutputChannel,
            mock(MockOutputChannel),
            JUPYTER_OUTPUT_CHANNEL
        );
        this.serviceManager.addSingleton<ICryptoUtils>(ICryptoUtils, CryptoUtils);
        this.serviceManager.addSingleton<IExtensionSingleActivationService>(
            IExtensionSingleActivationService,
            ServerPreload
        );
        const mockExtensionContext = TypeMoq.Mock.ofType<IExtensionContext>();
        mockExtensionContext.setup((m) => m.globalStoragePath).returns(() => os.tmpdir());
        mockExtensionContext.setup((m) => m.extensionPath).returns(() => this.extensionRootPath || os.tmpdir());
        this.serviceManager.addSingletonInstance<IExtensionContext>(IExtensionContext, mockExtensionContext.object);

        const mockServerSelector = mock(JupyterServerSelector);
        this.serviceManager.addSingletonInstance<JupyterServerSelector>(
            JupyterServerSelector,
            instance(mockServerSelector)
        );

        this.serviceManager.addSingleton<ITerminalHelper>(ITerminalHelper, TerminalHelper);
        this.serviceManager.addSingleton<ITerminalActivationCommandProvider>(
            ITerminalActivationCommandProvider,
            Bash,
            TerminalActivationProviders.bashCShellFish
        );
        this.serviceManager.addSingleton<ITerminalActivationCommandProvider>(
            ITerminalActivationCommandProvider,
            CommandPromptAndPowerShell,
            TerminalActivationProviders.commandPromptAndPowerShell
        );
        this.serviceManager.addSingleton<ITerminalActivationCommandProvider>(
            ITerminalActivationCommandProvider,
            PyEnvActivationCommandProvider,
            TerminalActivationProviders.pyenv
        );
        this.serviceManager.addSingleton<ITerminalActivationCommandProvider>(
            ITerminalActivationCommandProvider,
            CondaActivationCommandProvider,
            TerminalActivationProviders.conda
        );
        this.serviceManager.addSingleton<ITerminalActivationCommandProvider>(
            ITerminalActivationCommandProvider,
            PipEnvActivationCommandProvider,
            TerminalActivationProviders.pipenv
        );
        this.serviceManager.addSingleton<ITerminalManager>(ITerminalManager, TerminalManager);
        this.serviceManager.addSingleton<ILanguageServerProxy>(ILanguageServerProxy, MockLanguageServerProxy);
        this.serviceManager.addSingleton<ILanguageServerCache>(
            ILanguageServerCache,
            LanguageServerExtensionActivationService
        );
        this.serviceManager.addSingleton<ILanguageServerExtension>(ILanguageServerExtension, LanguageServerExtension);

        this.serviceManager.add<ILanguageServerActivator>(
            ILanguageServerActivator,
            JediExtensionActivator,
            LanguageServerType.Jedi
        );
        this.serviceManager.addSingleton<ILanguageServerAnalysisOptions>(
            ILanguageServerAnalysisOptions,
            MockLanguageServerAnalysisOptions
        );
        if (languageServerType === LanguageServerType.Microsoft) {
            this.serviceManager.add<ILanguageServerActivator>(
                ILanguageServerActivator,
                DotNetLanguageServerActivator,
                LanguageServerType.Microsoft
            );
            this.serviceManager.add<ILanguageServerManager>(ILanguageServerManager, DotNetLanguageServerManager);
        } else if (languageServerType === LanguageServerType.Node) {
            this.serviceManager.add<ILanguageServerActivator>(
                ILanguageServerActivator,
                NodeLanguageServerActivator,
                LanguageServerType.Node
            );
            this.serviceManager.add<ILanguageServerManager>(ILanguageServerManager, NodeLanguageServerManager);
        }

        this.serviceManager.addSingleton<INotebookProvider>(INotebookProvider, NotebookProvider);
        this.serviceManager.addSingleton<IJupyterNotebookProvider>(IJupyterNotebookProvider, JupyterNotebookProvider);
        this.serviceManager.addSingleton<IJupyterServerProvider>(IJupyterServerProvider, NotebookServerProvider);

        this.serviceManager.add<IInteractiveWindowListener>(IInteractiveWindowListener, IntellisenseProvider);
        this.serviceManager.add<IInteractiveWindowListener>(IInteractiveWindowListener, AutoSaveService);
        this.serviceManager.add<IInteractiveWindowListener>(IInteractiveWindowListener, GatherListener);
        this.serviceManager.add<IInteractiveWindowListener>(IInteractiveWindowListener, NativeEditorRunByLineListener);
        this.serviceManager.addSingleton<IPyWidgetMessageDispatcherFactory>(
            IPyWidgetMessageDispatcherFactory,
            IPyWidgetMessageDispatcherFactory
        );
        if (this.uiTest) {
            this.serviceManager.add<IInteractiveWindowListener>(IInteractiveWindowListener, IPyWidgetHandler);
        }
        this.serviceManager.add<IProtocolParser>(IProtocolParser, ProtocolParser);
        this.serviceManager.addSingleton<IJupyterDebugService>(
            IJupyterDebugService,
            JupyterDebugService,
            Identifiers.RUN_BY_LINE_DEBUGSERVICE
        );
        const mockDebugService = new MockDebuggerService(
            this.serviceManager.get<IJupyterDebugService>(IJupyterDebugService, Identifiers.RUN_BY_LINE_DEBUGSERVICE)
        );
        this.serviceManager.addSingletonInstance<IDebugService>(IDebugService, mockDebugService);
        this.serviceManager.addSingletonInstance<IJupyterDebugService>(
            IJupyterDebugService,
            mockDebugService,
            Identifiers.MULTIPLEXING_DEBUGSERVICE
        );
        this.serviceManager.add<ICellHashProvider>(ICellHashProvider, CellHashProvider, undefined, [
            INotebookExecutionLogger
        ]);
        this.serviceManager.add<INotebookExecutionLogger>(INotebookExecutionLogger, HoverProvider);
        this.serviceManager.add<IGatherProvider>(IGatherProvider, GatherProvider);
        this.serviceManager.add<IGatherLogger>(IGatherLogger, GatherLogger, undefined, [INotebookExecutionLogger]);
        this.serviceManager.add<INotebookExecutionLogger>(INotebookExecutionLogger, TestExecutionLogger);
        this.serviceManager.addSingleton<ICodeLensFactory>(ICodeLensFactory, CodeLensFactory, undefined, [
            IInteractiveWindowListener
        ]);
        this.serviceManager.addSingleton<IShellDetector>(IShellDetector, TerminalNameShellDetector);
        this.serviceManager.addSingleton<IDiagnosticsService>(
            IDiagnosticsService,
            LSNotSupportedDiagnosticService,
            LSNotSupportedDiagnosticServiceId
        );
        this.serviceManager.addSingleton<ILanguageServerCompatibilityService>(
            ILanguageServerCompatibilityService,
            LanguageServerCompatibilityService
        );
        this.serviceManager.addSingleton<IDiagnosticHandlerService<MessageCommandPrompt>>(
            IDiagnosticHandlerService,
            DiagnosticCommandPromptHandlerService,
            DiagnosticCommandPromptHandlerServiceId
        );
        this.serviceManager.addSingleton<IDiagnosticFilterService>(IDiagnosticFilterService, DiagnosticFilterService);
        this.serviceManager.addSingleton<NotebookStarter>(NotebookStarter, NotebookStarter);
        this.serviceManager.addSingleton<KernelSelector>(KernelSelector, KernelSelector);
        this.serviceManager.addSingleton<KernelSelectionProvider>(KernelSelectionProvider, KernelSelectionProvider);
        this.serviceManager.addSingleton<KernelSwitcher>(KernelSwitcher, KernelSwitcher);
        this.serviceManager.addSingleton<IKernelDependencyService>(IKernelDependencyService, KernelDependencyService);
        this.serviceManager.addSingleton<INotebookAndInteractiveWindowUsageTracker>(
            INotebookAndInteractiveWindowUsageTracker,
            NotebookAndInteractiveWindowUsageTracker
        );
        this.serviceManager.addSingleton<IProductService>(IProductService, ProductService);
        this.serviceManager.addSingleton<KernelDaemonPool>(KernelDaemonPool, KernelDaemonPool);
        this.serviceManager.addSingleton<KernelDaemonPreWarmer>(KernelDaemonPreWarmer, KernelDaemonPreWarmer);
        this.serviceManager.addSingleton<IVSCodeNotebook>(IVSCodeNotebook, VSCodeNotebook);
        this.serviceManager.addSingleton<IProductPathService>(
            IProductPathService,
            CTagsProductPathService,
            ProductType.WorkspaceSymbols
        );
        this.serviceManager.addSingleton<IProductPathService>(
            IProductPathService,
            FormatterProductPathService,
            ProductType.Formatter
        );
        this.serviceManager.addSingleton<IProductPathService>(
            IProductPathService,
            LinterProductPathService,
            ProductType.Linter
        );
        this.serviceManager.addSingleton<IProductPathService>(
            IProductPathService,
            TestFrameworkProductPathService,
            ProductType.TestFramework
        );
        this.serviceManager.addSingleton<IProductPathService>(
            IProductPathService,
            RefactoringLibraryProductPathService,
            ProductType.RefactoringLibrary
        );
        this.serviceManager.addSingleton<IProductPathService>(
            IProductPathService,
            DataScienceProductPathService,
            ProductType.DataScience
        );
        this.serviceManager.addSingleton<IMultiStepInputFactory>(IMultiStepInputFactory, MultiStepInputFactory);

        // No need of reporting progress.
        const progressReporter = mock(ProgressReporter);
        when(progressReporter.createProgressIndicator(anything())).thenReturn({
            dispose: noop,
            token: new CancellationTokenSource().token
        });
        this.serviceManager.addSingletonInstance<ProgressReporter>(ProgressReporter, instance(progressReporter));

        // Don't check for dot net compatibility
        const dotNetCompability = mock(DotNetCompatibilityService);
        when(dotNetCompability.isSupported()).thenResolve(true);
        this.serviceManager.addSingletonInstance<IDotNetCompatibilityService>(
            IDotNetCompatibilityService,
            instance(dotNetCompability)
        );

        // Don't allow a banner to show up
        const extensionBanner = mock(LanguageServerSurveyBanner);
        this.serviceManager.addSingletonInstance<IPythonExtensionBanner>(
            IPythonExtensionBanner,
            instance(extensionBanner),
            BANNER_NAME_LS_SURVEY
        );

        // Don't allow the download to happen
        const downloader = mock(LanguageServerDownloader);
        this.serviceManager.addSingletonInstance<ILanguageServerDownloader>(
            ILanguageServerDownloader,
            instance(downloader)
        );

        const folderService = mock(DotNetLanguageServerFolderService);
        const packageService = mock(DotNetLanguageServerPackageService);
        this.serviceManager.addSingletonInstance<ILanguageServerFolderService>(
            ILanguageServerFolderService,
            instance(folderService)
        );
        this.serviceManager.addSingletonInstance<ILanguageServerPackageService>(
            ILanguageServerPackageService,
            instance(packageService)
        );

        // Turn off experiments.
        const experimentManager = mock(ExperimentsManager);
        when(experimentManager.inExperiment(anything())).thenCall((exp) => {
            const setState = this.experimentState.get(exp);
            if (setState === undefined) {
                // Default to true if not the zmq kernel
                return exp !== LocalZMQKernel.experiment;
            }
            return setState;
        });
        when(experimentManager.activate()).thenResolve();
        this.serviceManager.addSingletonInstance<IExperimentsManager>(IExperimentsManager, instance(experimentManager));

        // Setup our command list
        this.commandManager.registerCommand('setContext', (name: string, value: boolean) => {
            this.setContexts[name] = value;
            this.contextSetEvent.fire({ name: name, value: value });
        });
        this.serviceManager.addSingletonInstance<ICommandManager>(ICommandManager, this.commandManager);

        // Mock the app shell
        const appShell = (this.applicationShell = TypeMoq.Mock.ofType<IApplicationShell>());
        const configurationService = TypeMoq.Mock.ofType<IConfigurationService>();

        configurationService.setup((c) => c.getSettings(TypeMoq.It.isAny())).returns(this.getSettings.bind(this));

        this.serviceManager.addSingleton<IEnvironmentVariablesProvider>(
            IEnvironmentVariablesProvider,
            EnvironmentVariablesProvider
        );

        this.serviceManager.addSingletonInstance<IApplicationShell>(IApplicationShell, appShell.object);
        this.serviceManager.addSingleton<IClipboard>(IClipboard, ClipboardService);
        this.serviceManager.addSingletonInstance<IDocumentManager>(IDocumentManager, this.documentManager);
        this.serviceManager.addSingletonInstance<IConfigurationService>(
            IConfigurationService,
            configurationService.object
        );

        const startTime = Date.now();
        this.datascience = TypeMoq.Mock.ofType<IDataScience>();
        this.datascience.setup((d) => d.activationStartTime).returns(() => startTime);
        this.serviceManager.addSingletonInstance<IDataScience>(IDataScience, this.datascience.object);
        this.serviceManager.addSingleton<IBufferDecoder>(IBufferDecoder, BufferDecoder);
        this.serviceManager.addSingleton<IEnvironmentVariablesService>(
            IEnvironmentVariablesService,
            EnvironmentVariablesService
        );
        this.serviceManager.addSingleton<IPathUtils>(IPathUtils, PathUtils);
        this.serviceManager.addSingletonInstance<boolean>(IsWindows, IS_WINDOWS);

        const globalStorage = this.serviceManager.get<Memento>(IMemento, GLOBAL_MEMENTO);
        const localStorage = this.serviceManager.get<Memento>(IMemento, WORKSPACE_MEMENTO);

        // Create a custom persistent state factory that remembers specific things between tests
        this.serviceManager.addSingletonInstance<IPersistentStateFactory>(
            IPersistentStateFactory,
            new TestPersistentStateFactory(globalStorage, localStorage)
        );

        const currentProcess = new CurrentProcess();
        this.serviceManager.addSingletonInstance<ICurrentProcess>(ICurrentProcess, currentProcess);
        this.serviceManager.addSingleton<IRegistry>(IRegistry, RegistryImplementation);

        this.serviceManager.addSingleton<JupyterInterpreterStateStore>(
            JupyterInterpreterStateStore,
            JupyterInterpreterStateStore
        );
        this.serviceManager.addSingleton<IExtensionSingleActivationService>(
            IExtensionSingleActivationService,
            JupyterInterpreterSelectionCommand
        );
        this.serviceManager.addSingleton<JupyterInterpreterSelector>(
            JupyterInterpreterSelector,
            JupyterInterpreterSelector
        );
        this.serviceManager.addSingleton<JupyterInterpreterDependencyService>(
            JupyterInterpreterDependencyService,
            JupyterInterpreterDependencyService
        );
        this.serviceManager.addSingleton<JupyterInterpreterService>(
            JupyterInterpreterService,
            JupyterInterpreterService
        );
        this.serviceManager.addSingleton<JupyterInterpreterOldCacheStateStore>(
            JupyterInterpreterOldCacheStateStore,
            JupyterInterpreterOldCacheStateStore
        );
        this.serviceManager.addSingleton<ActiveEditorContextService>(
            ActiveEditorContextService,
            ActiveEditorContextService
        );
        this.serviceManager.addSingleton<IKernelLauncher>(IKernelLauncher, KernelLauncher);
        this.serviceManager.addSingleton<IKernelFinder>(IKernelFinder, KernelFinder);

        this.serviceManager.addSingleton<IJupyterSubCommandExecutionService>(
            IJupyterSubCommandExecutionService,
            JupyterInterpreterSubCommandExecutionService
        );
        this.serviceManager.addSingleton<IJupyterInterpreterDependencyManager>(
            IJupyterInterpreterDependencyManager,
            JupyterInterpreterSubCommandExecutionService
        );

        const interpreterDisplay = TypeMoq.Mock.ofType<IInterpreterDisplay>();
        interpreterDisplay.setup((i) => i.refresh(TypeMoq.It.isAny())).returns(() => Promise.resolve());

        this.serviceManager.add<INotebookStorage>(INotebookStorage, NativeEditorStorage);
        this.serviceManager.addSingleton<INotebookStorageProvider>(INotebookStorageProvider, NotebookStorageProvider);
        this.serviceManager.addSingleton<ICustomEditorService>(ICustomEditorService, MockCustomEditorService);

        // Create our jupyter mock if necessary
        if (this.shouldMockJupyter) {
            this.jupyterMock = new MockJupyterManagerFactory(this.serviceManager);
            // When using mocked Jupyter, default to using default kernel.
            when(this.kernelServiceMock.searchAndRegisterKernel(anything(), anything())).thenResolve(undefined);
            when(this.kernelServiceMock.getKernelSpecs(anything(), anything())).thenResolve([]);
            this.serviceManager.addSingletonInstance<KernelService>(KernelService, instance(this.kernelServiceMock));

            this.serviceManager.addSingleton<InterpeterHashProviderFactory>(
                InterpeterHashProviderFactory,
                InterpeterHashProviderFactory
            );
            this.serviceManager.addSingleton<IInterpreterSecurityService>(
                IInterpreterSecurityService,
                InterpreterSecurityService
            );
            this.serviceManager.addSingleton<IInterpreterSecurityStorage>(
                IInterpreterSecurityStorage,
                InterpreterSecurityStorage
            );
            this.serviceManager.addSingleton<IInterpreterEvaluation>(IInterpreterEvaluation, InterpreterEvaluation);
            this.serviceManager.addSingleton<WindowsStoreInterpreter>(WindowsStoreInterpreter, WindowsStoreInterpreter);
            this.serviceManager.addSingleton<InterpreterHashProvider>(InterpreterHashProvider, InterpreterHashProvider);
            this.serviceManager.addSingleton<InterpreterFilter>(InterpreterFilter, InterpreterFilter);
            this.serviceManager.add<IInterpreterWatcher>(
                IInterpreterWatcher,
                WorkspaceVirtualEnvWatcherService,
                WORKSPACE_VIRTUAL_ENV_SERVICE
            );
            this.serviceManager.addSingleton<IInterpreterWatcherBuilder>(
                IInterpreterWatcherBuilder,
                InterpreterWatcherBuilder
            );
            this.serviceManager.add<IInterpreterWatcher>(
                IInterpreterWatcher,
                WorkspaceVirtualEnvWatcherService,
                WORKSPACE_VIRTUAL_ENV_SERVICE
            );
            this.serviceManager.addSingleton<IInterpreterWatcherBuilder>(
                IInterpreterWatcherBuilder,
                InterpreterWatcherBuilder
            );

            this.serviceManager.addSingleton<IInterpreterLocatorService>(
                IInterpreterLocatorService,
                PythonInterpreterLocatorService,
                INTERPRETER_LOCATOR_SERVICE
            );
            this.serviceManager.addSingleton<IInterpreterLocatorService>(
                IInterpreterLocatorService,
                CondaEnvFileService,
                CONDA_ENV_FILE_SERVICE
            );
            this.serviceManager.addSingleton<IInterpreterLocatorService>(
                IInterpreterLocatorService,
                CondaEnvService,
                CONDA_ENV_SERVICE
            );
            this.serviceManager.addSingleton<IInterpreterLocatorService>(
                IInterpreterLocatorService,
                CurrentPathService,
                CURRENT_PATH_SERVICE
            );
            this.serviceManager.addSingleton<IInterpreterLocatorService>(
                IInterpreterLocatorService,
                GlobalVirtualEnvService,
                GLOBAL_VIRTUAL_ENV_SERVICE
            );
            this.serviceManager.addSingleton<IInterpreterLocatorService>(
                IInterpreterLocatorService,
                WorkspaceVirtualEnvService,
                WORKSPACE_VIRTUAL_ENV_SERVICE
            );
            this.serviceManager.addSingleton<IInterpreterLocatorService>(
                IInterpreterLocatorService,
                PipEnvService,
                PIPENV_SERVICE
            );
            this.serviceManager.addSingleton<IInterpreterLocatorService>(
                IInterpreterLocatorService,
                WindowsRegistryService,
                WINDOWS_REGISTRY_SERVICE
            );

            this.serviceManager.addSingleton<IInterpreterLocatorService>(
                IInterpreterLocatorService,
                KnownPathsService,
                KNOWN_PATH_SERVICE
            );

            this.serviceManager.addSingleton<IInterpreterHelper>(IInterpreterHelper, InterpreterHelper);
            this.serviceManager.addSingleton<IInterpreterLocatorHelper>(
                IInterpreterLocatorHelper,
                InterpreterLocatorHelper
            );
            this.serviceManager.addSingleton<IInterpreterComparer>(IInterpreterComparer, InterpreterComparer);
            this.serviceManager.addSingleton<IInterpreterVersionService>(
                IInterpreterVersionService,
                InterpreterVersionService
            );
            this.serviceManager.addSingleton<IPythonInPathCommandProvider>(
                IPythonInPathCommandProvider,
                PythonInPathCommandProvider
            );

            this.serviceManager.addSingleton<IPipEnvServiceHelper>(IPipEnvServiceHelper, PipEnvServiceHelper);
            this.serviceManager.addSingleton<IInterpreterSelector>(IInterpreterSelector, InterpreterSelector);
            this.serviceManager.addSingleton<IShebangCodeLensProvider>(
                IShebangCodeLensProvider,
                ShebangCodeLensProvider
            );
            this.serviceManager.addSingleton<IPythonPathUpdaterServiceFactory>(
                IPythonPathUpdaterServiceFactory,
                PythonPathUpdaterServiceFactory
            );
            this.serviceManager.addSingleton<IPythonPathUpdaterServiceManager>(
                IPythonPathUpdaterServiceManager,
                PythonPathUpdaterService
            );

            // Don't use conda at all when mocking
            const condaService = TypeMoq.Mock.ofType<ICondaService>();
            this.serviceManager.addSingletonInstance<ICondaService>(ICondaService, condaService.object);
            condaService.setup((c) => c.isCondaAvailable()).returns(() => Promise.resolve(false));
            condaService.setup((c) => c.isCondaEnvironment(TypeMoq.It.isAny())).returns(() => Promise.resolve(false));
            condaService.setup((c) => c.condaEnvironmentsFile).returns(() => undefined);

            this.serviceManager.addSingleton<IVirtualEnvironmentsSearchPathProvider>(
                IVirtualEnvironmentsSearchPathProvider,
                GlobalVirtualEnvironmentsSearchPathProvider,
                'global'
            );
            this.serviceManager.addSingleton<IVirtualEnvironmentsSearchPathProvider>(
                IVirtualEnvironmentsSearchPathProvider,
                WorkspaceVirtualEnvironmentsSearchPathProvider,
                'workspace'
            );
            this.serviceManager.addSingleton<IVirtualEnvironmentManager>(
                IVirtualEnvironmentManager,
                VirtualEnvironmentManager
            );
            this.serviceManager.add<IKnownSearchPathsForInterpreters>(
                IKnownSearchPathsForInterpreters,
                KnownSearchPathsForInterpreters
            );
            this.serviceManager.addSingleton<IPythonInPathCommandProvider>(
                IPythonInPathCommandProvider,
                PythonInPathCommandProvider
            );
            this.serviceManager.addSingletonInstance<IInterpreterDisplay>(
                IInterpreterDisplay,
                interpreterDisplay.object
            );
        } else {
            this.serviceManager.addSingleton<IInstaller>(IInstaller, ProductInstaller);
            this.serviceManager.addSingleton<KernelService>(KernelService, KernelService);
            this.serviceManager.addSingleton<IProcessServiceFactory>(IProcessServiceFactory, ProcessServiceFactory);
            this.serviceManager.addSingleton<IPythonExecutionFactory>(IPythonExecutionFactory, PythonExecutionFactory);

            // Make sure full interpreter services are available.
            registerInterpreterTypes(this.serviceManager);

            // Rebind the interpreter display as we don't want to use the real one
            this.serviceManager.rebindInstance<IInterpreterDisplay>(IInterpreterDisplay, interpreterDisplay.object);

            this.serviceManager.addSingleton<IJupyterSessionManagerFactory>(
                IJupyterSessionManagerFactory,
                JupyterSessionManagerFactory
            );
            this.serviceManager.addSingleton<IJupyterPasswordConnect>(IJupyterPasswordConnect, JupyterPasswordConnect);
            this.serviceManager.addSingleton<IProcessLogger>(IProcessLogger, ProcessLogger);
        }
        this.serviceManager.addSingleton<NativeEditorSynchronizer>(NativeEditorSynchronizer, NativeEditorSynchronizer);
        this.serviceManager.addSingleton<ITrustService>(ITrustService, TrustService);
        this.serviceManager.addSingleton<IDigestStorage>(IDigestStorage, DigestStorage);
        // Disable syncrhonizing edits
        this.serviceContainer.get<NativeEditorSynchronizer>(NativeEditorSynchronizer).disable();
        const dummyDisposable = {
            dispose: () => {
                return;
            }
        };

        appShell.setup((a) => a.showErrorMessage(TypeMoq.It.isAnyString())).returns(() => Promise.resolve(''));
        appShell
            .setup((a) => a.showErrorMessage(TypeMoq.It.isAnyString(), anything()))
            .returns(() => Promise.resolve(''));
        appShell
            .setup((a) => a.showErrorMessage(TypeMoq.It.isAnyString(), anything(), anything()))
            .returns(() => Promise.resolve(''));
        appShell
            .setup((a) => a.showInformationMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(''));
        appShell
            .setup((a) => a.showInformationMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns((_a1: string, a2: string, _a3: string) => Promise.resolve(a2));
        appShell
            .setup((a) =>
                a.showInformationMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())
            )
            .returns((_a1: string, a2: any, _a3: string, a4: string) => {
                if (typeof a2 === 'string') {
                    return Promise.resolve(a2);
                } else {
                    return Promise.resolve(a4);
                }
            });
        appShell
            .setup((a) => a.showSaveDialog(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(Uri.file('test.ipynb')));
        appShell.setup((a) => a.setStatusBarMessage(TypeMoq.It.isAny())).returns(() => dummyDisposable);
        appShell.setup((a) => a.showInputBox(TypeMoq.It.isAny())).returns(() => Promise.resolve('Python'));

        const interpreterManager = this.serviceContainer.get<IInterpreterService>(IInterpreterService);
        interpreterManager.initialize();

        if (this.mockJupyter) {
            this.addInterpreter(this.workingPython2, SupportedCommands.all);
            this.addInterpreter(this.workingPython, SupportedCommands.all);
        }
        this.serviceManager.addSingleton<IJupyterUriProviderRegistration>(
            IJupyterUriProviderRegistration,
            JupyterUriProviderRegistration
        );
    }
    public setFileContents(uri: Uri, contents: string) {
        const fileSystem = this.serviceManager.get<IFileSystem>(IFileSystem) as MockFileSystem;
        fileSystem.addFileContents(uri.fsPath, contents);
    }

    public async activate(): Promise<void> {
        // Activate all of the extension activation services
        const activationServices = this.serviceManager.getAll<IExtensionSingleActivationService>(
            IExtensionSingleActivationService
        );

        await Promise.all(activationServices.map((a) => a.activate()));

        // Then force our interpreter to be one that supports jupyter (unless in a mock state when we don't have to)
        if (!this.mockJupyter) {
            const interpreterService = this.serviceManager.get<IInterpreterService>(IInterpreterService);
            const activeInterpreter = await interpreterService.getActiveInterpreter();
            if (!activeInterpreter || !(await this.hasFunctionalDependencies(activeInterpreter))) {
                const list = await this.getFunctionalTestInterpreters();
                if (list.length) {
                    this.forceSettingsChanged(undefined, list[0].path);

                    // Log this all the time. Useful in determining why a test may not pass.
                    const message = `Setting interpreter to ${list[0].displayName || list[0].path} -> ${list[0].path}`;
                    traceInfo(message);
                    // tslint:disable-next-line: no-console
                    console.log(message);

                    // Also set this as the interpreter to use for jupyter
                    await this.serviceManager
                        .get<JupyterInterpreterService>(JupyterInterpreterService)
                        .setAsSelectedInterpreter(list[0]);
                } else {
                    throw new Error(
                        'No jupyter capable interpreter found. Make sure you install all of the functional requirements before running a test'
                    );
                }
            }
        }
    }

    // tslint:disable:any
    public createWebView(
        mount: () => ReactWrapper<any, Readonly<{}>, React.Component>,
        type: 'notebook' | 'default',
        role: vsls.Role = vsls.Role.None
    ) {
        // Force the container to mock actual live share if necessary
        if (role !== vsls.Role.None) {
            const liveShareTest = this.get<ILiveShareApi>(ILiveShareApi) as ILiveShareTestingApi;
            liveShareTest.forceRole(role);
        }

        // We need to mount the react control before we even create an interactive window object. Otherwise the mount will miss rendering some parts
        return this.get<IMountedWebViewFactory>(IMountedWebViewFactory).create(type, mount).wrapper;
    }

    public getDefaultWrapper() {
        return this.getDefaultWebPanel().wrapper;
    }

    public getDefaultWebPanel() {
        return this.getWebPanel('default');
    }

    public getWebPanel(type: 'notebook' | 'default') {
        return this.get<IMountedWebViewFactory>(IMountedWebViewFactory).get(type);
    }

    public postMessage(m: WebPanelMessage, type: 'notebook' | 'default') {
        return this.get<IMountedWebViewFactory>(IMountedWebViewFactory).get(type).postMessage(m);
    }

    public getContext(name: string): boolean {
        if (this.setContexts.hasOwnProperty(name)) {
            return this.setContexts[name];
        }

        return false;
    }

    public getSettings(resource?: Uri): IPythonSettings {
        const key = this.getResourceKey(resource);
        let setting = this.settingsMap.get(key);
        if (!setting && !this.disposed) {
            // Make sure we have the default config for this resource first.
            this.getWorkspaceConfig('python', resource);
            setting = new MockPythonSettings(
                resource,
                new MockAutoSelectionService(),
                this.serviceManager.get<IWorkspaceService>(IWorkspaceService)
            );
            this.settingsMap.set(key, setting);
        } else if (this.disposed) {
            setting = this.generatePythonSettings(this.languageServerType);
        }
        return setting;
    }

    public forceDataScienceSettingsChanged(dataScienceSettings: Partial<IDataScienceSettings>) {
        this.forceSettingsChanged(undefined, this.getSettings().pythonPath, {
            ...this.getSettings().datascience,
            ...dataScienceSettings
        });
    }

    public forceSettingsChanged(resource: Resource, newPath: string, datascienceSettings?: IDataScienceSettings) {
        const settings = this.getSettings(resource) as any;
        settings.pythonPath = newPath;
        settings.datascience = datascienceSettings ? datascienceSettings : settings.datascience;

        // The workspace config must be updated too as a config change event will cause the data to be reread from
        // the config.
        const config = this.getWorkspaceConfig('python', resource);
        config.update('pythonPath', newPath).ignoreErrors();
        config.update('dataScience', settings.datascience).ignoreErrors();
        settings.fireChangeEvent();
        this.configChangeEvent.fire({
            affectsConfiguration(_s: string, _r?: Uri): boolean {
                return true;
            }
        });
    }

    public setExtensionRootPath(newRoot: string) {
        this.extensionRootPath = newRoot;
    }

    public async getJupyterCapableInterpreter(): Promise<PythonInterpreter | undefined> {
        const list = await this.getFunctionalTestInterpreters();
        return list ? list[0] : undefined;
    }

    public async getFunctionalTestInterpreters(): Promise<PythonInterpreter[]> {
        // This should be cacheable as we don't install new interpreters during tests
        if (DataScienceIocContainer.jupyterInterpreters.length > 0) {
            return DataScienceIocContainer.jupyterInterpreters;
        }
        const list = await this.get<IInterpreterService>(IInterpreterService).getInterpreters(undefined);
        const promises = list.map((f) => this.hasFunctionalDependencies(f).then((b) => (b ? f : undefined)));
        const resolved = await Promise.all(promises);
        DataScienceIocContainer.jupyterInterpreters = resolved.filter((r) => r) as PythonInterpreter[];
        return DataScienceIocContainer.jupyterInterpreters;
    }

    public addWorkspaceFolder(folderPath: string) {
        const workspaceFolder = new MockWorkspaceFolder(folderPath, this.workspaceFolders.length);
        this.workspaceFolders.push(workspaceFolder);
        return workspaceFolder;
    }

    public addResourceToFolder(resource: Uri, folderPath: string) {
        let folder = this.workspaceFolders.find((f) => f.uri.fsPath === folderPath);
        if (!folder) {
            folder = this.addWorkspaceFolder(folderPath);
        }
        folder.ownedResources.add(resource.toString());
    }

    public get<T>(serviceIdentifier: interfaces.ServiceIdentifier<T>, name?: string | number | symbol): T {
        return this.serviceManager.get<T>(serviceIdentifier, name);
    }

    public getAll<T>(serviceIdentifier: interfaces.ServiceIdentifier<T>, name?: string | number | symbol): T[] {
        return this.serviceManager.getAll<T>(serviceIdentifier, name);
    }

    public addDocument(code: string, file: string) {
        this.documentManager.addDocument(code, file);
    }

    public addInterpreter(newInterpreter: PythonInterpreter, commands: SupportedCommands) {
        if (this.mockJupyter) {
            this.mockJupyter.addInterpreter(newInterpreter, commands);
        }
    }
    public changeViewState(type: 'notebook' | 'default', active: boolean, visible: boolean) {
        const webPanel = this.getWebPanel(type);
        if (webPanel) {
            webPanel.changeViewState(active, visible);
        }
    }

    public getWorkspaceConfig(section: string | undefined, resource?: Resource): MockWorkspaceConfiguration {
        if (!section || section !== 'python') {
            return this.emptyConfig;
        }
        const key = this.getResourceKey(resource);
        let result = this.configMap.get(key);
        if (!result) {
            result = this.generatePythonWorkspaceConfig(this.languageServerType);
            this.configMap.set(key, result);
        }
        return result;
    }

    public setExperimentState(experimentName: string, enabled: boolean) {
        this.experimentState.set(experimentName, enabled);
    }

    private computeWebPanelId(title: string): 'notebook' | 'default' {
        // Should be based on title (for now)
        if (title && (title.toLowerCase().endsWith('.ipynb') || title.toLowerCase().includes('notebook'))) {
            return `notebook`;
        }

        return 'default';
    }

    private async onCreateWebPanel(options: IWebPanelOptions) {
        const id = this.computeWebPanelId(options.title);
        const panel = this.getWebPanel(id);
        this.get<IDisposableRegistry>(IDisposableRegistry).push(panel);
        panel.attach(options);
        return panel;
    }

    private generatePythonSettings(languageServerType: LanguageServerType) {
        // Create a dummy settings just to setup the workspace config
        const pythonSettings = new MockPythonSettings(undefined, new MockAutoSelectionService());
        pythonSettings.pythonPath = this.defaultPythonPath!;
        pythonSettings.datascience = {
            allowImportFromNotebook: true,
            alwaysTrustNotebooks: true,
            jupyterLaunchTimeout: 60000,
            jupyterLaunchRetries: 3,
            enabled: true,
            jupyterServerURI: 'local',
            // tslint:disable-next-line: no-invalid-template-strings
            notebookFileRoot: '${fileDirname}',
            changeDirOnImportExport: false,
            useDefaultConfigForJupyter: true,
            jupyterInterruptTimeout: 10000,
            searchForJupyter: true,
            showCellInputCode: true,
            collapseCellInputCodeByDefault: true,
            allowInput: true,
            maxOutputSize: 400,
            enableScrollingForCellOutputs: true,
            errorBackgroundColor: '#FFFFFF',
            sendSelectionToInteractiveWindow: false,
            codeRegularExpression: '^(#\\s*%%|#\\s*\\<codecell\\>|#\\s*In\\[\\d*?\\]|#\\s*In\\[ \\])',
            markdownRegularExpression: '^(#\\s*%%\\s*\\[markdown\\]|#\\s*\\<markdowncell\\>)',
            variableExplorerExclude: 'module;function;builtin_function_or_method',
            liveShareConnectionTimeout: 100,
            enablePlotViewer: true,
            stopOnFirstLineWhileDebugging: true,
            stopOnError: true,
            addGotoCodeLenses: true,
            enableCellCodeLens: true,
            runStartupCommands: '',
            debugJustMyCode: true,
            variableQueries: [],
            jupyterCommandLineArguments: [],
            disableJupyterAutoStart: false,
            widgetScriptSources: ['jsdelivr.com', 'unpkg.com']
        };
        pythonSettings.downloadLanguageServer = false;
        const folders = ['Envs', '.virtualenvs'];
        pythonSettings.venvFolders = folders;
        pythonSettings.venvPath = path.join('~', 'foo');
        pythonSettings.terminal = {
            executeInFileDir: false,
            launchArgs: [],
            activateEnvironment: true,
            activateEnvInCurrentTerminal: false
        };
        pythonSettings.languageServer = languageServerType;
        return pythonSettings;
    }

    private generatePythonWorkspaceConfig(languageServerType: LanguageServerType): MockWorkspaceConfiguration {
        const pythonSettings = this.generatePythonSettings(languageServerType);

        // Use these settings to default all of the settings in a python configuration
        return new MockWorkspaceConfiguration(pythonSettings);
    }

    private createWorkspaceService() {
        class MockFileSystemWatcher implements FileSystemWatcher {
            public ignoreCreateEvents: boolean = false;
            public ignoreChangeEvents: boolean = false;
            public ignoreDeleteEvents: boolean = false;
            //tslint:disable-next-line:no-any
            public onDidChange(_listener: (e: Uri) => any, _thisArgs?: any, _disposables?: Disposable[]): Disposable {
                return { dispose: noop };
            }
            //tslint:disable-next-line:no-any
            public onDidDelete(_listener: (e: Uri) => any, _thisArgs?: any, _disposables?: Disposable[]): Disposable {
                return { dispose: noop };
            }
            //tslint:disable-next-line:no-any
            public onDidCreate(_listener: (e: Uri) => any, _thisArgs?: any, _disposables?: Disposable[]): Disposable {
                return { dispose: noop };
            }
            public dispose() {
                noop();
            }
        }

        const workspaceService = mock(WorkspaceService);
        this.serviceManager.addSingletonInstance<IWorkspaceService>(IWorkspaceService, instance(workspaceService));
        when(workspaceService.onDidChangeConfiguration).thenReturn(this.configChangeEvent.event);
        when(workspaceService.onDidChangeWorkspaceFolders).thenReturn(this.worksaceFoldersChangedEvent.event);

        // Create another config for other parts of the workspace config.
        when(workspaceService.getConfiguration(anything())).thenCall(this.getWorkspaceConfig.bind(this));
        when(workspaceService.getConfiguration(anything(), anything())).thenCall(this.getWorkspaceConfig.bind(this));
        const testWorkspaceFolder = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'datascience');

        when(workspaceService.createFileSystemWatcher(anything(), anything(), anything(), anything())).thenReturn(
            new MockFileSystemWatcher()
        );
        when(workspaceService.createFileSystemWatcher(anything())).thenReturn(new MockFileSystemWatcher());
        when(workspaceService.hasWorkspaceFolders).thenReturn(true);
        when(workspaceService.workspaceFolders).thenReturn(this.workspaceFolders);
        when(workspaceService.rootPath).thenReturn(testWorkspaceFolder);
        when(workspaceService.getWorkspaceFolder(anything())).thenCall(this.getWorkspaceFolder.bind(this));
        this.addWorkspaceFolder(testWorkspaceFolder);
        return workspaceService;
    }

    private getWorkspaceFolder(uri: Resource): WorkspaceFolder | undefined {
        if (uri) {
            return this.workspaceFolders.find((w) => w.ownedResources.has(uri.toString()));
        }
        return undefined;
    }

    private getResourceKey(resource: Resource): string {
        if (!this.disposed) {
            const workspace = this.serviceManager.get<IWorkspaceService>(IWorkspaceService);
            const workspaceFolderUri = PythonSettings.getSettingsUriAndTarget(resource, workspace).uri;
            return workspaceFolderUri ? workspaceFolderUri.fsPath : '';
        }
        return '';
    }

    private async hasFunctionalDependencies(interpreter: PythonInterpreter): Promise<boolean | undefined> {
        try {
            const dependencyChecker = this.serviceManager.get<JupyterInterpreterDependencyService>(
                JupyterInterpreterDependencyService
            );
            if (await dependencyChecker.areDependenciesInstalled(interpreter)) {
                // Functional tests require livelossplot too. Make sure this interpreter has that value as well
                const pythonProcess = await this.serviceContainer
                    .get<IPythonExecutionFactory>(IPythonExecutionFactory)
                    .createActivatedEnvironment({
                        resource: undefined,
                        interpreter,
                        allowEnvironmentFetchExceptions: true
                    });
                return pythonProcess.isModuleInstalled('livelossplot'); // Should we check all dependencies?
            }
        } catch (ex) {
            return false;
        }
    }

    private findPythonPath(): string {
        try {
            // Use a static variable so we don't have to recompute this on subsequenttests
            if (!DataScienceIocContainer.foundPythonPath) {
                // Give preference to the CI test python (could also be set in launch.json for debugging).
                const output = child_process.execFileSync(
                    process.env.CI_PYTHON_PATH || 'python',
                    ['-c', 'import sys;print(sys.executable)'],
                    { encoding: 'utf8' }
                );
                DataScienceIocContainer.foundPythonPath = output.replace(/\r?\n/g, '');
            }
            return DataScienceIocContainer.foundPythonPath;
        } catch (ex) {
            return 'python';
        }
    }
}
