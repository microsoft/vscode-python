// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
//tslint:disable:trailing-comma no-any
import * as child_process from 'child_process';
import { ReactWrapper } from 'enzyme';
import { interfaces } from 'inversify';
import * as os from 'os';
import * as path from 'path';
import { SemVer } from 'semver';
import { anything, instance, mock, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import {
    CancellationTokenSource,
    ConfigurationChangeEvent,
    Disposable,
    Event,
    EventEmitter,
    FileSystemWatcher,
    Uri,
    WorkspaceConfiguration,
    WorkspaceFolder,
    WorkspaceFoldersChangeEvent
} from 'vscode';
import * as vsls from 'vsls/vscode';

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
import { LSNotSupportedDiagnosticService, LSNotSupportedDiagnosticServiceId } from '../../client/application/diagnostics/checks/lsNotSupported';
import { DiagnosticFilterService } from '../../client/application/diagnostics/filter';
import { DiagnosticCommandPromptHandlerService, DiagnosticCommandPromptHandlerServiceId, MessageCommandPrompt } from '../../client/application/diagnostics/promptHandler';
import { IDiagnosticFilterService, IDiagnosticHandlerService, IDiagnosticsService } from '../../client/application/diagnostics/types';
import { TerminalManager } from '../../client/common/application/terminalManager';
import {
    IApplicationShell,
    ICommandManager,
    IDebugService,
    IDocumentManager,
    ILiveShareApi,
    ILiveShareTestingApi,
    ITerminalManager,
    IWebPanel,
    IWebPanelMessageListener,
    IWebPanelOptions,
    IWebPanelProvider,
    IWorkspaceService,
    WebPanelMessage
} from '../../client/common/application/types';
import { WorkspaceService } from '../../client/common/application/workspace';
import { AsyncDisposableRegistry } from '../../client/common/asyncDisposableRegistry';
import { PythonSettings } from '../../client/common/configSettings';
import { EXTENSION_ROOT_DIR } from '../../client/common/constants';
import { CryptoUtils } from '../../client/common/crypto';
import { DotNetCompatibilityService } from '../../client/common/dotnet/compatibilityService';
import { IDotNetCompatibilityService } from '../../client/common/dotnet/types';
import { ExperimentsManager } from '../../client/common/experiments';
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
import { PersistentStateFactory } from '../../client/common/persistentState';
import { IS_WINDOWS } from '../../client/common/platform/constants';
import { PathUtils } from '../../client/common/platform/pathUtils';
import { RegistryImplementation } from '../../client/common/platform/registry';
import { IRegistry } from '../../client/common/platform/types';
import { CurrentProcess } from '../../client/common/process/currentProcess';
import { BufferDecoder } from '../../client/common/process/decoder';
import { ProcessLogger } from '../../client/common/process/logger';
import { ProcessServiceFactory } from '../../client/common/process/processFactory';
import { PythonExecutionFactory } from '../../client/common/process/pythonExecutionFactory';
import { IBufferDecoder, IProcessLogger, IProcessServiceFactory, IPythonExecutionFactory } from '../../client/common/process/types';
import { Bash } from '../../client/common/terminal/environmentActivationProviders/bash';
import { CommandPromptAndPowerShell } from '../../client/common/terminal/environmentActivationProviders/commandPrompt';
import { CondaActivationCommandProvider } from '../../client/common/terminal/environmentActivationProviders/condaActivationProvider';
import { PipEnvActivationCommandProvider } from '../../client/common/terminal/environmentActivationProviders/pipEnvActivationProvider';
import { PyEnvActivationCommandProvider } from '../../client/common/terminal/environmentActivationProviders/pyenvActivationProvider';
import { TerminalHelper } from '../../client/common/terminal/helper';
import { TerminalNameShellDetector } from '../../client/common/terminal/shellDetectors/terminalNameShellDetector';
import { IShellDetector, ITerminalActivationCommandProvider, ITerminalHelper, TerminalActivationProviders } from '../../client/common/terminal/types';
import {
    BANNER_NAME_LS_SURVEY,
    IAsyncDisposableRegistry,
    IConfigurationService,
    ICryptoUtils,
    ICurrentProcess,
    IDataScienceSettings,
    IExperimentsManager,
    IExtensionContext,
    IExtensions,
    IInstaller,
    IOutputChannel,
    IPathUtils,
    IPersistentStateFactory,
    IPythonExtensionBanner,
    IsWindows,
    ProductType
} from '../../client/common/types';
import { Deferred, sleep } from '../../client/common/utils/async';
import { noop } from '../../client/common/utils/misc';
import { IMultiStepInputFactory, MultiStepInputFactory } from '../../client/common/utils/multiStepInput';
import { Architecture } from '../../client/common/utils/platform';
import { EnvironmentVariablesService } from '../../client/common/variables/environment';
import { EnvironmentVariablesProvider } from '../../client/common/variables/environmentVariablesProvider';
import { IEnvironmentVariablesProvider, IEnvironmentVariablesService } from '../../client/common/variables/types';
import { CodeCssGenerator } from '../../client/datascience/codeCssGenerator';
import { JUPYTER_OUTPUT_CHANNEL } from '../../client/datascience/constants';
import { ActiveEditorContextService } from '../../client/datascience/context/activeEditorContext';
import { DataViewer } from '../../client/datascience/data-viewing/dataViewer';
import { DataViewerProvider } from '../../client/datascience/data-viewing/dataViewerProvider';
import { DebugLocationTrackerFactory } from '../../client/datascience/debugLocationTrackerFactory';
import { CellHashProvider } from '../../client/datascience/editor-integration/cellhashprovider';
import { CodeLensFactory } from '../../client/datascience/editor-integration/codeLensFactory';
import { DataScienceCodeLensProvider } from '../../client/datascience/editor-integration/codelensprovider';
import { CodeWatcher } from '../../client/datascience/editor-integration/codewatcher';
import { DataScienceErrorHandler } from '../../client/datascience/errorHandler/errorHandler';
import { GatherExecution } from '../../client/datascience/gather/gather';
import { GatherListener } from '../../client/datascience/gather/gatherListener';
import { IntellisenseProvider } from '../../client/datascience/interactive-common/intellisense/intellisenseProvider';
import { AutoSaveService } from '../../client/datascience/interactive-ipynb/autoSaveService';
import { NativeEditor } from '../../client/datascience/interactive-ipynb/nativeEditor';
import { NativeEditorCommandListener } from '../../client/datascience/interactive-ipynb/nativeEditorCommandListener';
import { InteractiveWindow } from '../../client/datascience/interactive-window/interactiveWindow';
import { InteractiveWindowCommandListener } from '../../client/datascience/interactive-window/interactiveWindowCommandListener';
import { JupyterCommandFactory } from '../../client/datascience/jupyter/interpreter/jupyterCommand';
import { JupyterCommandFinder } from '../../client/datascience/jupyter/interpreter/jupyterCommandFinder';
import { JupyterCommandInterpreterDependencyService } from '../../client/datascience/jupyter/interpreter/jupyterCommandInterpreterDependencyService';
import { JupyterCommandFinderInterpreterExecutionService } from '../../client/datascience/jupyter/interpreter/jupyterCommandInterpreterExecutionService';
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
import { JupyterPasswordConnect } from '../../client/datascience/jupyter/jupyterPasswordConnect';
import { JupyterServerWrapper } from '../../client/datascience/jupyter/jupyterServerWrapper';
import { JupyterSessionManagerFactory } from '../../client/datascience/jupyter/jupyterSessionManagerFactory';
import { JupyterVariables } from '../../client/datascience/jupyter/jupyterVariables';
import { KernelSelectionProvider } from '../../client/datascience/jupyter/kernels/kernelSelections';
import { KernelSelector } from '../../client/datascience/jupyter/kernels/kernelSelector';
import { KernelService } from '../../client/datascience/jupyter/kernels/kernelService';
import { NotebookStarter } from '../../client/datascience/jupyter/notebookStarter';
import { ServerPreload } from '../../client/datascience/jupyter/serverPreload';
import { PlotViewer } from '../../client/datascience/plotting/plotViewer';
import { PlotViewerProvider } from '../../client/datascience/plotting/plotViewerProvider';
import { ProgressReporter } from '../../client/datascience/progress/progressReporter';
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
    IDataViewer,
    IDataViewerProvider,
    IDebugLocationTracker,
    IGatherExecution,
    IInteractiveWindow,
    IInteractiveWindowListener,
    IInteractiveWindowProvider,
    IJupyterCommandFactory,
    IJupyterDebugger,
    IJupyterExecution,
    IJupyterInterpreterDependencyManager,
    IJupyterPasswordConnect,
    IJupyterSessionManagerFactory,
    IJupyterSubCommandExecutionService,
    IJupyterVariables,
    INotebookEditor,
    INotebookEditorProvider,
    INotebookExecutionLogger,
    INotebookExporter,
    INotebookImporter,
    INotebookServer,
    IPlotViewer,
    IPlotViewerProvider,
    IStatusProvider,
    IThemeFinder
} from '../../client/datascience/types';
import { ProtocolParser } from '../../client/debugger/debugAdapter/Common/protocolParser';
import { IProtocolParser } from '../../client/debugger/debugAdapter/types';
import { EnvironmentActivationService } from '../../client/interpreter/activation/service';
import { IEnvironmentActivationService } from '../../client/interpreter/activation/types';
import { InterpreterComparer } from '../../client/interpreter/configuration/interpreterComparer';
import { InterpreterSelector } from '../../client/interpreter/configuration/interpreterSelector';
import { PythonPathUpdaterService } from '../../client/interpreter/configuration/pythonPathUpdaterService';
import { PythonPathUpdaterServiceFactory } from '../../client/interpreter/configuration/pythonPathUpdaterServiceFactory';
import { IInterpreterComparer, IInterpreterSelector, IPythonPathUpdaterServiceFactory, IPythonPathUpdaterServiceManager } from '../../client/interpreter/configuration/types';
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
    InterpreterType,
    IPipEnvService,
    IShebangCodeLensProvider,
    IVirtualEnvironmentsSearchPathProvider,
    KNOWN_PATH_SERVICE,
    PIPENV_SERVICE,
    PythonInterpreter,
    WINDOWS_REGISTRY_SERVICE,
    WORKSPACE_VIRTUAL_ENV_SERVICE
} from '../../client/interpreter/contracts';
import { ShebangCodeLensProvider } from '../../client/interpreter/display/shebangCodeLensProvider';
import { InterpreterHelper } from '../../client/interpreter/helpers';
import { InterpreterService } from '../../client/interpreter/interpreterService';
import { InterpreterVersionService } from '../../client/interpreter/interpreterVersion';
import { PythonInterpreterLocatorService } from '../../client/interpreter/locators';
import { InterpreterLocatorHelper } from '../../client/interpreter/locators/helpers';
import { CondaEnvFileService } from '../../client/interpreter/locators/services/condaEnvFileService';
import { CondaEnvService } from '../../client/interpreter/locators/services/condaEnvService';
import { CurrentPathService, PythonInPathCommandProvider } from '../../client/interpreter/locators/services/currentPathService';
import { GlobalVirtualEnvironmentsSearchPathProvider, GlobalVirtualEnvService } from '../../client/interpreter/locators/services/globalVirtualEnvService';
import { InterpreterHashProvider } from '../../client/interpreter/locators/services/hashProvider';
import { InterpeterHashProviderFactory } from '../../client/interpreter/locators/services/hashProviderFactory';
import { InterpreterFilter } from '../../client/interpreter/locators/services/interpreterFilter';
import { InterpreterWatcherBuilder } from '../../client/interpreter/locators/services/interpreterWatcherBuilder';
import { KnownPathsService, KnownSearchPathsForInterpreters } from '../../client/interpreter/locators/services/KnownPathsService';
import { PipEnvService } from '../../client/interpreter/locators/services/pipEnvService';
import { PipEnvServiceHelper } from '../../client/interpreter/locators/services/pipEnvServiceHelper';
import { WindowsRegistryService } from '../../client/interpreter/locators/services/windowsRegistryService';
import { WindowsStoreInterpreter } from '../../client/interpreter/locators/services/windowsStoreInterpreter';
import { WorkspaceVirtualEnvironmentsSearchPathProvider, WorkspaceVirtualEnvService } from '../../client/interpreter/locators/services/workspaceVirtualEnvService';
import { WorkspaceVirtualEnvWatcherService } from '../../client/interpreter/locators/services/workspaceVirtualEnvWatcherService';
import { IPipEnvServiceHelper, IPythonInPathCommandProvider } from '../../client/interpreter/locators/types';
import { VirtualEnvironmentManager } from '../../client/interpreter/virtualEnvs';
import { IVirtualEnvironmentManager } from '../../client/interpreter/virtualEnvs/types';
import { LanguageServerSurveyBanner } from '../../client/languageServices/languageServerSurveyBanner';
import { CodeExecutionHelper } from '../../client/terminals/codeExecution/helper';
import { ICodeExecutionHelper } from '../../client/terminals/types';
import { IVsCodeApi } from '../../datascience-ui/react-common/postOffice';
import { MockOutputChannel } from '../mockClasses';
import { MockAutoSelectionService } from '../mocks/autoSelector';
import { UnitTestIocContainer } from '../testing/serviceRegistry';
import { MockCommandManager } from './mockCommandManager';
import { MockDebuggerService } from './mockDebugService';
import { MockDocumentManager } from './mockDocumentManager';
import { MockExtensions } from './mockExtensions';
import { MockJupyterManager, SupportedCommands } from './mockJupyterManager';
import { MockJupyterManagerFactory } from './mockJupyterManagerFactory';
import { MockLanguageServerAnalysisOptions } from './mockLanguageServerAnalysisOptions';
import { MockLanguageServerProxy } from './mockLanguageServerProxy';
import { MockLiveShareApi } from './mockLiveShare';
import { MockWorkspaceConfiguration } from './mockWorkspaceConfig';
import { blurWindow, createMessageEvent } from './reactHelpers';
import { TestInteractiveWindowProvider } from './testInteractiveWindowProvider';
import { TestNativeEditorProvider } from './testNativeEditorProvider';

export class DataScienceIocContainer extends UnitTestIocContainer {
    public webPanelListener: IWebPanelMessageListener | undefined;
    public readonly useCommandFinderForJupyterServer = false;
    public wrapper: ReactWrapper<any, Readonly<{}>, React.Component> | undefined;
    public wrapperCreatedPromise: Deferred<boolean> | undefined;
    public postMessage: ((ev: MessageEvent) => void) | undefined;
    public mockedWorkspaceConfig!: WorkspaceConfiguration;
    public applicationShell!: TypeMoq.IMock<IApplicationShell>;
    // tslint:disable-next-line:no-any
    public datascience!: TypeMoq.IMock<IDataScience>;
    private missedMessages: any[] = [];
    private pythonSettings = new (class extends PythonSettings {
        public fireChangeEvent() {
            this.changed.fire();
        }
    })(undefined, new MockAutoSelectionService());
    private commandManager: MockCommandManager = new MockCommandManager();
    private setContexts: Record<string, boolean> = {};
    private contextSetEvent: EventEmitter<{ name: string; value: boolean }> = new EventEmitter<{ name: string; value: boolean }>();
    private jupyterMock: MockJupyterManagerFactory | undefined;
    private shouldMockJupyter: boolean;
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
    private extraListeners: ((m: string, p: any) => void)[] = [];

    private webPanelProvider: TypeMoq.IMock<IWebPanelProvider> | undefined;

    constructor() {
        super();
        this.useVSCodeAPI = false;
        const isRollingBuild = process.env ? process.env.VSCODE_PYTHON_ROLLING !== undefined : false;
        this.shouldMockJupyter = !isRollingBuild;
        this.asyncRegistry = new AsyncDisposableRegistry();
    }

    public get workingInterpreter() {
        return this.workingPython;
    }

    public get workingInterpreter2() {
        return this.workingPython2;
    }

    public get onContextSet(): Event<{ name: string; value: boolean }> {
        return this.contextSetEvent.event;
    }

    public async dispose(): Promise<void> {
        await this.asyncRegistry.dispose();
        await super.dispose();

        // Blur window focus so we don't have editors polling
        blurWindow();

        if (this.wrapper && this.wrapper.length) {
            this.wrapper.unmount();
            this.wrapper = undefined;
        }

        // Bounce this so that our editor has time to shutdown
        await sleep(10);

        // Clear out the monaco global services. Some of these services are preventing shutdown.
        // tslint:disable: no-require-imports
        const services = require('monaco-editor/esm/vs/editor/standalone/browser/standaloneServices') as any;
        if (services.StaticServices) {
            const keys = Object.keys(services.StaticServices);
            keys.forEach(k => {
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

    //tslint:disable:max-func-body-length
    public registerDataScienceTypes() {
        const testWorkspaceFolder = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'datascience');

        this.registerFileSystemTypes();
        this.serviceManager.addSingleton<IJupyterExecution>(IJupyterExecution, JupyterExecutionFactory);
        this.serviceManager.addSingleton<IInteractiveWindowProvider>(IInteractiveWindowProvider, TestInteractiveWindowProvider);
        this.serviceManager.addSingleton<IDataViewerProvider>(IDataViewerProvider, DataViewerProvider);
        this.serviceManager.addSingleton<IPlotViewerProvider>(IPlotViewerProvider, PlotViewerProvider);
        this.serviceManager.add<IInteractiveWindow>(IInteractiveWindow, InteractiveWindow);
        this.serviceManager.add<IDataViewer>(IDataViewer, DataViewer);
        this.serviceManager.add<IPlotViewer>(IPlotViewer, PlotViewer);
        this.serviceManager.add<INotebookImporter>(INotebookImporter, JupyterImporter);
        this.serviceManager.add<INotebookExporter>(INotebookExporter, JupyterExporter);
        this.serviceManager.addSingleton<ILiveShareApi>(ILiveShareApi, MockLiveShareApi);
        this.serviceManager.addSingleton<IExtensions>(IExtensions, MockExtensions);
        this.serviceManager.add<INotebookServer>(INotebookServer, JupyterServerWrapper);
        this.serviceManager.add<IJupyterCommandFactory>(IJupyterCommandFactory, JupyterCommandFactory);
        this.serviceManager.addSingleton<IThemeFinder>(IThemeFinder, ThemeFinder);
        this.serviceManager.addSingleton<ICodeCssGenerator>(ICodeCssGenerator, CodeCssGenerator);
        this.serviceManager.addSingleton<IStatusProvider>(IStatusProvider, StatusProvider);
        this.serviceManager.add<IKnownSearchPathsForInterpreters>(IKnownSearchPathsForInterpreters, KnownSearchPathsForInterpreters);
        this.serviceManager.addSingletonInstance<IAsyncDisposableRegistry>(IAsyncDisposableRegistry, this.asyncRegistry);
        this.serviceManager.addSingleton<IPythonInPathCommandProvider>(IPythonInPathCommandProvider, PythonInPathCommandProvider);
        this.serviceManager.addSingleton<IEnvironmentActivationService>(IEnvironmentActivationService, EnvironmentActivationService);
        this.serviceManager.add<ICodeWatcher>(ICodeWatcher, CodeWatcher);
        this.serviceManager.add<IDataScienceCodeLensProvider>(IDataScienceCodeLensProvider, DataScienceCodeLensProvider);
        this.serviceManager.add<ICodeExecutionHelper>(ICodeExecutionHelper, CodeExecutionHelper);
        this.serviceManager.add<IDataScienceCommandListener>(IDataScienceCommandListener, InteractiveWindowCommandListener);
        this.serviceManager.add<IDataScienceErrorHandler>(IDataScienceErrorHandler, DataScienceErrorHandler);
        this.serviceManager.add<IInstallationChannelManager>(IInstallationChannelManager, InstallationChannelManager);
        this.serviceManager.addSingleton<IJupyterVariables>(IJupyterVariables, JupyterVariables);
        this.serviceManager.addSingleton<IJupyterDebugger>(IJupyterDebugger, JupyterDebugger);
        this.serviceManager.addSingleton<IDebugLocationTracker>(IDebugLocationTracker, DebugLocationTrackerFactory);
        this.serviceManager.addSingleton<INotebookEditorProvider>(INotebookEditorProvider, TestNativeEditorProvider);
        this.serviceManager.add<INotebookEditor>(INotebookEditor, NativeEditor);
        this.serviceManager.addSingleton<IDataScienceCommandListener>(IDataScienceCommandListener, NativeEditorCommandListener);
        this.serviceManager.addSingletonInstance<IOutputChannel>(IOutputChannel, mock(MockOutputChannel), JUPYTER_OUTPUT_CHANNEL);
        this.serviceManager.addSingleton<ICryptoUtils>(ICryptoUtils, CryptoUtils);
        this.serviceManager.addSingleton<IExtensionSingleActivationService>(IExtensionSingleActivationService, ServerPreload);
        const mockExtensionContext = TypeMoq.Mock.ofType<IExtensionContext>();
        mockExtensionContext.setup(m => m.globalStoragePath).returns(() => os.tmpdir());
        this.serviceManager.addSingletonInstance<IExtensionContext>(IExtensionContext, mockExtensionContext.object);

        this.serviceManager.addSingleton<ITerminalHelper>(ITerminalHelper, TerminalHelper);
        this.serviceManager.addSingleton<ITerminalActivationCommandProvider>(ITerminalActivationCommandProvider, Bash, TerminalActivationProviders.bashCShellFish);
        this.serviceManager.addSingleton<ITerminalActivationCommandProvider>(
            ITerminalActivationCommandProvider,
            CommandPromptAndPowerShell,
            TerminalActivationProviders.commandPromptAndPowerShell
        );
        this.serviceManager.addSingleton<ITerminalActivationCommandProvider>(ITerminalActivationCommandProvider, PyEnvActivationCommandProvider, TerminalActivationProviders.pyenv);
        this.serviceManager.addSingleton<ITerminalActivationCommandProvider>(ITerminalActivationCommandProvider, CondaActivationCommandProvider, TerminalActivationProviders.conda);
        this.serviceManager.addSingleton<ITerminalActivationCommandProvider>(
            ITerminalActivationCommandProvider,
            PipEnvActivationCommandProvider,
            TerminalActivationProviders.pipenv
        );
        this.serviceManager.addSingleton<ITerminalManager>(ITerminalManager, TerminalManager);
        this.serviceManager.addSingleton<IPipEnvServiceHelper>(IPipEnvServiceHelper, PipEnvServiceHelper);

        //const configuration = this.serviceManager.get<IConfigurationService>(IConfigurationService);
        //const pythonSettings = configuration.getSettings();
        const languageServerType = LanguageServerType.Microsoft; // pythonSettings.languageServer;

        this.serviceManager.addSingleton<ILanguageServerProxy>(ILanguageServerProxy, MockLanguageServerProxy);
        this.serviceManager.addSingleton<ILanguageServerCache>(ILanguageServerCache, LanguageServerExtensionActivationService);
        this.serviceManager.addSingleton<ILanguageServerExtension>(ILanguageServerExtension, LanguageServerExtension);

        this.serviceManager.add<ILanguageServerActivator>(ILanguageServerActivator, JediExtensionActivator, LanguageServerType.Jedi);
        if (languageServerType === LanguageServerType.Microsoft) {
            this.serviceManager.add<ILanguageServerActivator>(ILanguageServerActivator, DotNetLanguageServerActivator, LanguageServerType.Microsoft);
            this.serviceManager.add<ILanguageServerManager>(ILanguageServerManager, DotNetLanguageServerManager);
            this.serviceManager.addSingleton<ILanguageServerAnalysisOptions>(ILanguageServerAnalysisOptions, MockLanguageServerAnalysisOptions);
        } else if (languageServerType === LanguageServerType.Node) {
            this.serviceManager.add<ILanguageServerActivator>(ILanguageServerActivator, NodeLanguageServerActivator, LanguageServerType.Node);
            this.serviceManager.add<ILanguageServerManager>(ILanguageServerManager, NodeLanguageServerManager);
        }

        this.serviceManager.add<IInteractiveWindowListener>(IInteractiveWindowListener, IntellisenseProvider);
        this.serviceManager.add<IInteractiveWindowListener>(IInteractiveWindowListener, AutoSaveService);
        this.serviceManager.add<IProtocolParser>(IProtocolParser, ProtocolParser);
        this.serviceManager.addSingleton<IDebugService>(IDebugService, MockDebuggerService);
        this.serviceManager.addSingleton<ICellHashProvider>(ICellHashProvider, CellHashProvider);
        this.serviceManager.addBinding(ICellHashProvider, IInteractiveWindowListener);
        this.serviceManager.add<IInteractiveWindowListener>(IInteractiveWindowListener, GatherListener);
        this.serviceManager.addBinding(ICellHashProvider, INotebookExecutionLogger);
        this.serviceManager.addBinding(IJupyterDebugger, ICellHashListener);
        this.serviceManager.add<IGatherExecution>(IGatherExecution, GatherExecution);
        this.serviceManager.addSingleton<ICodeLensFactory>(ICodeLensFactory, CodeLensFactory);
        this.serviceManager.addSingleton<IShellDetector>(IShellDetector, TerminalNameShellDetector);
        this.serviceManager.addSingleton<InterpeterHashProviderFactory>(InterpeterHashProviderFactory, InterpeterHashProviderFactory);
        this.serviceManager.addSingleton<WindowsStoreInterpreter>(WindowsStoreInterpreter, WindowsStoreInterpreter);
        this.serviceManager.addSingleton<InterpreterHashProvider>(InterpreterHashProvider, InterpreterHashProvider);
        this.serviceManager.addSingleton<InterpreterFilter>(InterpreterFilter, InterpreterFilter);
        this.serviceManager.addSingleton<JupyterCommandFinder>(JupyterCommandFinder, JupyterCommandFinder);
        this.serviceManager.addSingleton<IDiagnosticsService>(IDiagnosticsService, LSNotSupportedDiagnosticService, LSNotSupportedDiagnosticServiceId);
        this.serviceManager.addSingleton<ILanguageServerCompatibilityService>(ILanguageServerCompatibilityService, LanguageServerCompatibilityService);
        this.serviceManager.addSingleton<IDiagnosticHandlerService<MessageCommandPrompt>>(
            IDiagnosticHandlerService,
            DiagnosticCommandPromptHandlerService,
            DiagnosticCommandPromptHandlerServiceId
        );
        this.serviceManager.addSingleton<IDiagnosticFilterService>(IDiagnosticFilterService, DiagnosticFilterService);
        this.serviceManager.addSingleton<NotebookStarter>(NotebookStarter, NotebookStarter);
        this.serviceManager.addSingleton<KernelSelector>(KernelSelector, KernelSelector);
        this.serviceManager.addSingleton<KernelSelectionProvider>(KernelSelectionProvider, KernelSelectionProvider);
        this.serviceManager.addSingleton<IInterpreterSelector>(IInterpreterSelector, InterpreterSelector);
        this.serviceManager.addSingleton<IShebangCodeLensProvider>(IShebangCodeLensProvider, ShebangCodeLensProvider);
        this.serviceManager.addSingleton<IProductService>(IProductService, ProductService);
        this.serviceManager.addSingleton<IProductPathService>(IProductPathService, CTagsProductPathService, ProductType.WorkspaceSymbols);
        this.serviceManager.addSingleton<IProductPathService>(IProductPathService, FormatterProductPathService, ProductType.Formatter);
        this.serviceManager.addSingleton<IProductPathService>(IProductPathService, LinterProductPathService, ProductType.Linter);
        this.serviceManager.addSingleton<IProductPathService>(IProductPathService, TestFrameworkProductPathService, ProductType.TestFramework);
        this.serviceManager.addSingleton<IProductPathService>(IProductPathService, RefactoringLibraryProductPathService, ProductType.RefactoringLibrary);
        this.serviceManager.addSingleton<IProductPathService>(IProductPathService, DataScienceProductPathService, ProductType.DataScience);
        this.serviceManager.addSingleton<IMultiStepInputFactory>(IMultiStepInputFactory, MultiStepInputFactory);

        // No need of reporting progress.
        const progressReporter = mock(ProgressReporter);
        when(progressReporter.createProgressIndicator(anything())).thenReturn({ dispose: noop, token: new CancellationTokenSource().token });
        this.serviceManager.addSingletonInstance<ProgressReporter>(ProgressReporter, instance(progressReporter));

        // Don't check for dot net compatibility
        const dotNetCompability = mock(DotNetCompatibilityService);
        when(dotNetCompability.isSupported()).thenResolve(true);
        this.serviceManager.addSingletonInstance<IDotNetCompatibilityService>(IDotNetCompatibilityService, instance(dotNetCompability));

        // Don't allow a banner to show up
        const extensionBanner = mock(LanguageServerSurveyBanner);
        this.serviceManager.addSingletonInstance<IPythonExtensionBanner>(IPythonExtensionBanner, instance(extensionBanner), BANNER_NAME_LS_SURVEY);

        // Don't allow the download to happen
        const downloader = mock(LanguageServerDownloader);
        this.serviceManager.addSingletonInstance<ILanguageServerDownloader>(ILanguageServerDownloader, instance(downloader));

        const folderService = mock(DotNetLanguageServerFolderService);
        const packageService = mock(DotNetLanguageServerPackageService);
        this.serviceManager.addSingletonInstance<ILanguageServerFolderService>(ILanguageServerFolderService, instance(folderService));
        this.serviceManager.addSingletonInstance<ILanguageServerPackageService>(ILanguageServerPackageService, instance(packageService));

        // Disable experiments.
        const experimentManager = mock(ExperimentsManager);
        when(experimentManager.inExperiment(anything())).thenReturn(false);
        when(experimentManager.activate()).thenResolve();
        this.serviceManager.addSingletonInstance<IExperimentsManager>(IExperimentsManager, instance(experimentManager));

        // Setup our command list
        this.commandManager.registerCommand('setContext', (name: string, value: boolean) => {
            this.setContexts[name] = value;
            this.contextSetEvent.fire({ name: name, value: value });
        });
        this.serviceManager.addSingletonInstance<ICommandManager>(ICommandManager, this.commandManager);

        // Also setup a mock execution service and interpreter service
        const appShell = (this.applicationShell = TypeMoq.Mock.ofType<IApplicationShell>());
        // const workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        const workspaceService = mock(WorkspaceService);
        const configurationService = TypeMoq.Mock.ofType<IConfigurationService>();
        const interpreterDisplay = TypeMoq.Mock.ofType<IInterpreterDisplay>();
        this.datascience = TypeMoq.Mock.ofType<IDataScience>();

        // Setup default settings
        this.pythonSettings.datascience = {
            allowImportFromNotebook: true,
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
            variableQueries: []
        };
        this.pythonSettings.jediEnabled = false;
        this.pythonSettings.downloadLanguageServer = false;

        const workspaceConfig = (this.mockedWorkspaceConfig = mock(MockWorkspaceConfiguration));
        configurationService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => this.pythonSettings);
        when(workspaceConfig.get(anything(), anything())).thenCall((_, defaultValue) => defaultValue);
        when(workspaceConfig.has(anything())).thenReturn(false);
        when((workspaceConfig as any).then).thenReturn(undefined);
        when(workspaceService.getConfiguration(anything())).thenReturn(instance(workspaceConfig));
        when(workspaceService.getConfiguration(anything(), anything())).thenReturn(instance(workspaceConfig));
        when(workspaceService.onDidChangeConfiguration).thenReturn(this.configChangeEvent.event);
        when(workspaceService.onDidChangeWorkspaceFolders).thenReturn(this.worksaceFoldersChangedEvent.event);

        interpreterDisplay.setup(i => i.refresh(TypeMoq.It.isAny())).returns(() => Promise.resolve());
        const startTime = Date.now();
        this.datascience.setup(d => d.activationStartTime).returns(() => startTime);

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
        when(workspaceService.createFileSystemWatcher(anything(), anything(), anything(), anything())).thenReturn(new MockFileSystemWatcher());
        when(workspaceService.createFileSystemWatcher(anything())).thenReturn(new MockFileSystemWatcher());
        when(workspaceService.hasWorkspaceFolders).thenReturn(true);
        const workspaceFolder = this.createMoqWorkspaceFolder(testWorkspaceFolder);
        when(workspaceService.workspaceFolders).thenReturn([workspaceFolder]);
        when(workspaceService.rootPath).thenReturn('~');

        // Look on the path for python
        const pythonPath = this.findPythonPath();

        this.pythonSettings.pythonPath = pythonPath;
        const folders = ['Envs', '.virtualenvs'];
        this.pythonSettings.venvFolders = folders;
        this.pythonSettings.venvPath = path.join('~', 'foo');
        this.pythonSettings.terminal = {
            executeInFileDir: false,
            launchArgs: [],
            activateEnvironment: true,
            activateEnvInCurrentTerminal: false
        };

        this.serviceManager.addSingleton<IEnvironmentVariablesProvider>(IEnvironmentVariablesProvider, EnvironmentVariablesProvider);
        this.serviceManager.addSingleton<IVirtualEnvironmentsSearchPathProvider>(IVirtualEnvironmentsSearchPathProvider, GlobalVirtualEnvironmentsSearchPathProvider, 'global');
        this.serviceManager.addSingleton<IVirtualEnvironmentsSearchPathProvider>(
            IVirtualEnvironmentsSearchPathProvider,
            WorkspaceVirtualEnvironmentsSearchPathProvider,
            'workspace'
        );
        this.serviceManager.addSingleton<IVirtualEnvironmentManager>(IVirtualEnvironmentManager, VirtualEnvironmentManager);

        this.serviceManager.addSingletonInstance<IApplicationShell>(IApplicationShell, appShell.object);
        this.serviceManager.addSingletonInstance<IDocumentManager>(IDocumentManager, this.documentManager);
        this.serviceManager.addSingletonInstance<IWorkspaceService>(IWorkspaceService, instance(workspaceService));
        this.serviceManager.addSingletonInstance<IConfigurationService>(IConfigurationService, configurationService.object);
        this.serviceManager.addSingletonInstance<IDataScience>(IDataScience, this.datascience.object);
        this.serviceManager.addSingleton<IBufferDecoder>(IBufferDecoder, BufferDecoder);
        this.serviceManager.addSingleton<IEnvironmentVariablesService>(IEnvironmentVariablesService, EnvironmentVariablesService);
        this.serviceManager.addSingleton<IPathUtils>(IPathUtils, PathUtils);
        this.serviceManager.addSingletonInstance<boolean>(IsWindows, IS_WINDOWS);

        this.serviceManager.add<IInterpreterWatcher>(IInterpreterWatcher, WorkspaceVirtualEnvWatcherService, WORKSPACE_VIRTUAL_ENV_SERVICE);
        this.serviceManager.addSingleton<IInterpreterWatcherBuilder>(IInterpreterWatcherBuilder, InterpreterWatcherBuilder);

        this.serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, PythonInterpreterLocatorService, INTERPRETER_LOCATOR_SERVICE);
        this.serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, CondaEnvFileService, CONDA_ENV_FILE_SERVICE);
        this.serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, CondaEnvService, CONDA_ENV_SERVICE);
        this.serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, CurrentPathService, CURRENT_PATH_SERVICE);
        this.serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, GlobalVirtualEnvService, GLOBAL_VIRTUAL_ENV_SERVICE);
        this.serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, WorkspaceVirtualEnvService, WORKSPACE_VIRTUAL_ENV_SERVICE);
        this.serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, PipEnvService, PIPENV_SERVICE);
        this.serviceManager.addSingleton<IInterpreterLocatorService>(IPipEnvService, PipEnvService);
        this.serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, WindowsRegistryService, WINDOWS_REGISTRY_SERVICE);

        this.serviceManager.addSingleton<IInterpreterLocatorService>(IInterpreterLocatorService, KnownPathsService, KNOWN_PATH_SERVICE);

        this.serviceManager.addSingleton<IInterpreterHelper>(IInterpreterHelper, InterpreterHelper);
        this.serviceManager.addSingleton<IInterpreterLocatorHelper>(IInterpreterLocatorHelper, InterpreterLocatorHelper);
        this.serviceManager.addSingleton<IInterpreterComparer>(IInterpreterComparer, InterpreterComparer);
        this.serviceManager.addSingleton<IInterpreterVersionService>(IInterpreterVersionService, InterpreterVersionService);
        this.serviceManager.addSingleton<IPersistentStateFactory>(IPersistentStateFactory, PersistentStateFactory);
        this.serviceManager.addSingletonInstance<IInterpreterDisplay>(IInterpreterDisplay, interpreterDisplay.object);

        this.serviceManager.addSingleton<IPythonPathUpdaterServiceFactory>(IPythonPathUpdaterServiceFactory, PythonPathUpdaterServiceFactory);
        this.serviceManager.addSingleton<IPythonPathUpdaterServiceManager>(IPythonPathUpdaterServiceManager, PythonPathUpdaterService);

        const currentProcess = new CurrentProcess();
        this.serviceManager.addSingletonInstance<ICurrentProcess>(ICurrentProcess, currentProcess);
        this.serviceManager.addSingleton<IRegistry>(IRegistry, RegistryImplementation);

        this.serviceManager.addSingleton<JupyterInterpreterStateStore>(JupyterInterpreterStateStore, JupyterInterpreterStateStore);
        this.serviceManager.addSingleton<IExtensionSingleActivationService>(IExtensionSingleActivationService, JupyterInterpreterSelectionCommand);
        this.serviceManager.addSingleton<JupyterInterpreterSelector>(JupyterInterpreterSelector, JupyterInterpreterSelector);
        this.serviceManager.addSingleton<JupyterInterpreterDependencyService>(JupyterInterpreterDependencyService, JupyterInterpreterDependencyService);
        this.serviceManager.addSingleton<JupyterInterpreterService>(JupyterInterpreterService, JupyterInterpreterService);
        this.serviceManager.addSingleton<JupyterInterpreterOldCacheStateStore>(JupyterInterpreterOldCacheStateStore, JupyterInterpreterOldCacheStateStore);
        this.serviceManager.addSingleton<ActiveEditorContextService>(ActiveEditorContextService, ActiveEditorContextService);

        if (this.useCommandFinderForJupyterServer) {
            this.serviceManager.addSingleton<IJupyterSubCommandExecutionService>(IJupyterSubCommandExecutionService, JupyterCommandFinderInterpreterExecutionService);
            this.serviceManager.addSingleton<IJupyterInterpreterDependencyManager>(IJupyterInterpreterDependencyManager, JupyterCommandInterpreterDependencyService);
        } else {
            this.serviceManager.addSingleton<IJupyterSubCommandExecutionService>(IJupyterSubCommandExecutionService, JupyterInterpreterSubCommandExecutionService);
            this.serviceManager.addSingleton<IJupyterInterpreterDependencyManager>(IJupyterInterpreterDependencyManager, JupyterInterpreterSubCommandExecutionService);
        }

        // Don't use conda at all during functional tests.
        const condaService = TypeMoq.Mock.ofType<ICondaService>();
        this.serviceManager.addSingletonInstance<ICondaService>(ICondaService, condaService.object);
        condaService.setup(c => c.isCondaAvailable()).returns(() => Promise.resolve(false));
        condaService.setup(c => c.isCondaEnvironment(TypeMoq.It.isValue(pythonPath))).returns(() => Promise.resolve(false));
        condaService.setup(c => c.condaEnvironmentsFile).returns(() => undefined);

        // Create our jupyter mock if necessary
        if (this.shouldMockJupyter) {
            this.jupyterMock = new MockJupyterManagerFactory(this.serviceManager);
            // When using mocked Jupyter, default to using default kernel.
            const kernelService = mock(KernelService);
            when(kernelService.searchAndRegisterKernel(anything(), anything())).thenResolve(undefined);
            this.serviceManager.addSingletonInstance<KernelService>(KernelService, instance(kernelService));
        } else {
            this.serviceManager.addSingleton<IInstaller>(IInstaller, ProductInstaller);
            this.serviceManager.addSingleton<KernelService>(KernelService, KernelService);
            this.serviceManager.addSingleton<IProcessServiceFactory>(IProcessServiceFactory, ProcessServiceFactory);
            this.serviceManager.addSingleton<IPythonExecutionFactory>(IPythonExecutionFactory, PythonExecutionFactory);
            this.serviceManager.addSingleton<IInterpreterService>(IInterpreterService, InterpreterService);
            this.serviceManager.addSingleton<IJupyterSessionManagerFactory>(IJupyterSessionManagerFactory, JupyterSessionManagerFactory);
            this.serviceManager.addSingleton<IJupyterPasswordConnect>(IJupyterPasswordConnect, JupyterPasswordConnect);
            this.serviceManager.addSingleton<IProcessLogger>(IProcessLogger, ProcessLogger);
        }

        const dummyDisposable = {
            dispose: () => {
                return;
            }
        };

        appShell
            .setup(a => a.showErrorMessage(TypeMoq.It.isAnyString()))
            .returns(e => {
                throw e;
            });
        appShell.setup(a => a.showInformationMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(''));
        appShell
            .setup(a => a.showInformationMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns((_a1: string, a2: string, _a3: string) => Promise.resolve(a2));
        appShell
            .setup(a => a.showInformationMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns((_a1: string, a2: string, _a3: string, _a4: string) => Promise.resolve(a2));
        appShell.setup(a => a.showSaveDialog(TypeMoq.It.isAny())).returns(() => Promise.resolve(Uri.file('test.ipynb')));
        appShell.setup(a => a.setStatusBarMessage(TypeMoq.It.isAny())).returns(() => dummyDisposable);
        appShell.setup(a => a.showInputBox(TypeMoq.It.isAny())).returns(() => Promise.resolve('Python'));

        const interpreterManager = this.serviceContainer.get<IInterpreterService>(IInterpreterService);
        interpreterManager.initialize();

        this.addInterpreter(this.workingPython2, SupportedCommands.all);
        this.addInterpreter(this.workingPython, SupportedCommands.all);
    }

    public async activate(): Promise<void> {
        // Activate all of the extension activation services
        const activationServices = this.serviceManager.getAll<IExtensionSingleActivationService>(IExtensionSingleActivationService);
        await Promise.all(activationServices.map(a => a.activate()));
    }

    // tslint:disable:any
    public createWebView(mount: () => ReactWrapper<any, Readonly<{}>, React.Component>, role: vsls.Role = vsls.Role.None) {
        // Force the container to mock actual live share if necessary
        if (role !== vsls.Role.None) {
            const liveShareTest = this.get<ILiveShareApi>(ILiveShareApi) as ILiveShareTestingApi;
            liveShareTest.forceRole(role);
        }

        if (!this.webPanelProvider) {
            this.webPanelProvider = TypeMoq.Mock.ofType<IWebPanelProvider>();
            this.serviceManager.addSingletonInstance<IWebPanelProvider>(IWebPanelProvider, this.webPanelProvider.object);
        } else {
            this.webPanelProvider.reset();
        }
        const webPanel = TypeMoq.Mock.ofType<IWebPanel>();

        // Setup the webpanel provider so that it returns our dummy web panel. It will have to talk to our global JSDOM window so that the react components can link into it
        this.webPanelProvider
            .setup(p => p.create(TypeMoq.It.isAny()))
            .returns((options: IWebPanelOptions) => {
                // Keep track of the current listener. It listens to messages through the vscode api
                this.webPanelListener = options.listener;

                // Send messages that were already posted but were missed.
                // During normal operation, the react control will not be created before
                // the webPanelListener
                if (this.missedMessages.length && this.webPanelListener) {
                    // This needs to be async because we are being called in the ctor of the webpanel. It can't
                    // handle some messages during the ctor.
                    setTimeout(() => {
                        this.missedMessages.forEach(m => (this.webPanelListener ? this.webPanelListener.onMessage(m.type, m.payload) : noop()));
                    }, 0);

                    // Note, you might think we should clean up the messages. However since the mount only occurs once, we might
                    // create multiple webpanels with the same mount. We need to resend these messages to
                    // other webpanels that get created with the same mount.
                }

                // Return our dummy web panel
                return Promise.resolve(webPanel.object);
            });
        webPanel
            .setup(p => p.postMessage(TypeMoq.It.isAny()))
            .callback((m: WebPanelMessage) => {
                const message = createMessageEvent(m);
                if (this.postMessage) {
                    this.postMessage(message);
                } else {
                    throw new Error('postMessage callback not defined');
                }
            });
        webPanel.setup(p => p.show(TypeMoq.It.isAny())).returns(() => Promise.resolve());

        // See https://github.com/florinn/typemoq/issues/67 for why this is necessary
        webPanel.setup((p: any) => p.then).returns(() => undefined);

        // We need to mount the react control before we even create an interactive window object. Otherwise the mount will miss rendering some parts
        this.mountReactControl(mount);
    }

    public createMoqWorkspaceFolder(folderPath: string) {
        const folder = TypeMoq.Mock.ofType<WorkspaceFolder>();
        folder.setup(f => f.uri).returns(() => Uri.file(folderPath));
        return folder.object;
    }

    public getContext(name: string): boolean {
        if (this.setContexts.hasOwnProperty(name)) {
            return this.setContexts[name];
        }

        return false;
    }

    public getSettings() {
        return this.pythonSettings;
    }

    public forceSettingsChanged(newPath: string, datascienceSettings?: IDataScienceSettings) {
        this.pythonSettings.pythonPath = newPath;
        this.pythonSettings.datascience = datascienceSettings ? datascienceSettings : this.pythonSettings.datascience;
        this.pythonSettings.fireChangeEvent();
        this.configChangeEvent.fire({
            affectsConfiguration(_s: string, _r?: Uri): boolean {
                return true;
            }
        });
    }

    public get mockJupyter(): MockJupyterManager | undefined {
        return this.jupyterMock ? this.jupyterMock.getManager() : undefined;
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

    public addMessageListener(callback: (m: string, p: any) => void) {
        this.extraListeners.push(callback);
    }

    public removeMessageListener(callback: (m: string, p: any) => void) {
        const index = this.extraListeners.indexOf(callback);
        if (index >= 0) {
            this.extraListeners.splice(index, 1);
        }
    }

    public addInterpreter(newInterpreter: PythonInterpreter, commands: SupportedCommands) {
        if (this.mockJupyter) {
            this.mockJupyter.addInterpreter(newInterpreter, commands);
        }
    }

    public postMessageToWebPanel(msg: any) {
        if (this.webPanelListener) {
            this.webPanelListener.onMessage(msg.type, msg.payload);
        } else {
            this.missedMessages.push(msg);
        }

        if (this.extraListeners.length) {
            this.extraListeners.forEach(e => e(msg.type, msg.payload));
        }
        if (this.wrapperCreatedPromise && !this.wrapperCreatedPromise.resolved) {
            this.wrapperCreatedPromise.resolve();
        }
    }

    private findPythonPath(): string {
        try {
            // Give preference to the CI test python (could also be set in launch.json for debugging).
            const output = child_process.execFileSync(process.env.CI_PYTHON_PATH || 'python', ['-c', 'import sys;print(sys.executable)'], { encoding: 'utf8' });
            return output.replace(/\r?\n/g, '');
        } catch (ex) {
            return 'python';
        }
    }

    private mountReactControl(mount: () => ReactWrapper<any, Readonly<{}>, React.Component>) {
        // This is a remount (or first time). Clear out messages that were sent
        // by the last mount
        this.missedMessages = [];
        this.webPanelListener = undefined;
        this.extraListeners = [];
        this.wrapperCreatedPromise = undefined;

        // Setup the acquireVsCodeApi. The react control will cache this value when it's mounted.
        const globalAcquireVsCodeApi = (): IVsCodeApi => {
            return {
                // tslint:disable-next-line:no-any
                postMessage: (msg: any) => {
                    this.postMessageToWebPanel(msg);
                },
                // tslint:disable-next-line:no-any no-empty
                setState: (_msg: any) => {},
                // tslint:disable-next-line:no-any no-empty
                getState: () => {
                    return {};
                }
            };
        };
        // tslint:disable-next-line:no-string-literal
        (global as any)['acquireVsCodeApi'] = globalAcquireVsCodeApi;

        // Remap event handlers to point to the container.
        const oldListener = window.addEventListener;
        window.addEventListener = (event: string, cb: any) => {
            if (event === 'message') {
                this.postMessage = cb;
            }
        };

        // Mount our main panel. This will make the global api be cached and have the event handler registered
        this.wrapper = mount();

        // We can remove the global api and event listener now.
        delete (global as any).acquireVsCodeApi;
        window.addEventListener = oldListener;
    }
}
