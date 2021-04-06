// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as child_process from 'child_process';
import { ReactWrapper } from 'enzyme';
import * as fs from 'fs-extra';
import * as glob from 'glob';
import { interfaces } from 'inversify';
import * as os from 'os';
import * as path from 'path';
import { anything, instance, mock, reset, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { promisify } from 'util';
import {
    ConfigurationChangeEvent,
    Disposable,
    EventEmitter,
    FileSystemWatcher,
    Uri,
    WorkspaceFolder,
    WorkspaceFoldersChangeEvent,
} from 'vscode';
import { LanguageServerType } from '../../client/activation/types';

import { ApplicationEnvironment } from '../../client/common/application/applicationEnvironment';
import { ApplicationShell } from '../../client/common/application/applicationShell';
import {
    IApplicationEnvironment,
    IApplicationShell,
    ICommandManager,
    IDocumentManager,
    IWebviewPanelOptions,
    IWebviewPanelProvider,
    IWorkspaceService,
} from '../../client/common/application/types';
import { WebviewPanelProvider } from '../../client/common/application/webviewPanels/webviewPanelProvider';
import { WorkspaceService } from '../../client/common/application/workspace';
import { AsyncDisposableRegistry } from '../../client/common/asyncDisposableRegistry';
import { PythonSettings } from '../../client/common/configSettings';
import { EXTENSION_ROOT_DIR } from '../../client/common/constants';
import { ExperimentsManager } from '../../client/common/experiments/manager';
import { ExperimentService } from '../../client/common/experiments/service';
import { InstallationChannelManager } from '../../client/common/installer/channelManager';
import { IInstallationChannelManager } from '../../client/common/installer/types';
import { HttpClient } from '../../client/common/net/httpClient';
import { IS_WINDOWS } from '../../client/common/platform/constants';
import { FileSystem } from '../../client/common/platform/fileSystem';
import { PathUtils } from '../../client/common/platform/pathUtils';
import { PlatformService } from '../../client/common/platform/platformService';
import { IFileSystem, IPlatformService } from '../../client/common/platform/types';
import { CurrentProcess } from '../../client/common/process/currentProcess';
import { CodeCssGenerator } from '../../client/common/startPage/codeCssGenerator';
import { StartPage } from '../../client/common/startPage/startPage';
import { ThemeFinder } from '../../client/common/startPage/themeFinder';
import { ICodeCssGenerator, IStartPage, IThemeFinder } from '../../client/common/startPage/types';
import {
    IConfigurationService,
    ICurrentProcess,
    IExperimentService,
    IExtensionContext,
    IExtensions,
    IHttpClient,
    IPathUtils,
    IPythonSettings,
    IsWindows,
    Resource,
} from '../../client/common/types';
import { sleep } from '../../client/common/utils/async';
import { noop } from '../../client/common/utils/misc';

import { EnvironmentActivationServiceCache } from '../../client/interpreter/activation/service';

import { CacheableLocatorPromiseCache } from '../../client/pythonEnvironments/discovery/locators/services/cacheableLocatorService';
import { MockAutoSelectionService } from '../mocks/autoSelector';
import { UnitTestIocContainer } from '../testing/serviceRegistry';
import { MockCommandManager } from './mockCommandManager';
import { MockDocumentManager } from './mockDocumentManager';
import { MockExtensions } from './mockExtensions';
import { MockPythonSettings } from './mockPythonSettings';
import { MockWorkspaceConfiguration } from './mockWorkspaceConfig';
import { MockWorkspaceFolder } from './mockWorkspaceFolder';
import { IMountedWebView } from './mountedWebView';
import { IMountedWebViewFactory, MountedWebViewFactory } from './mountedWebViewFactory';
import { WebBrowserPanelProvider } from './webBrowserPanelProvider';

export class StartPageIocContainer extends UnitTestIocContainer {
    private static foundPythonPath: string | undefined;

    public applicationShell!: ApplicationShell;

    public platformService!: PlatformService;

    private asyncRegistry: AsyncDisposableRegistry;

    private webPanelProvider = mock(WebviewPanelProvider);

    private settingsMap = new Map<string, any>();

    private experimentState = new Map<string, boolean>();

    private extensionRootPath: string | undefined;

    private pendingWebPanel: IMountedWebView | undefined;

    private configChangeEvent = new EventEmitter<ConfigurationChangeEvent>();

    private worksaceFoldersChangedEvent = new EventEmitter<WorkspaceFoldersChangeEvent>();

    private emptyConfig = new MockWorkspaceConfiguration();

    private configMap = new Map<string, MockWorkspaceConfiguration>();

    private languageServerType: LanguageServerType = LanguageServerType.Microsoft;

    private disposed = false;

    private defaultPythonPath: string | undefined;

    private workspaceFolders: MockWorkspaceFolder[] = [];

    private commandManager: MockCommandManager = new MockCommandManager();

    // public get onContextSet(): Event<{ name: string; value: boolean }> {
    //     return this.contextSetEvent.event;
    // }
    private setContexts: Record<string, boolean> = {};

    private documentManager = new MockDocumentManager();

    private contextSetEvent: EventEmitter<{ name: string; value: boolean }> = new EventEmitter<{
        name: string;
        value: boolean;
    }>();

    constructor(private readonly uiTest: boolean = false) {
        super();
        // this.pythonEnvs = mock(PythonEnvironments);
        this.useVSCodeAPI = false;
        this.asyncRegistry = new AsyncDisposableRegistry();
    }

    public async dispose(): Promise<void> {
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
            console.log(`Exception on cleanup: ${exc}`);
        }
        await this.asyncRegistry.dispose();
        await super.dispose();
        this.disposed = true;

        if (!this.uiTest) {
            // Blur window focus so we don't have editors polling

            const reactHelpers = require('./reactHelpers') as typeof import('./reactHelpers');
            reactHelpers.blurWindow();
        }

        // Bounce this so that our editor has time to shutdown
        await sleep(150);

        // Because there are outstanding promises holding onto this object, clear out everything we can
        this.workspaceFolders = [];
        this.settingsMap.clear();
        this.configMap.clear();
        this.setContexts = {};
        reset(this.webPanelProvider);

        CacheableLocatorPromiseCache.forceUseNormal();
        EnvironmentActivationServiceCache.forceUseNormal();
    }

    public registerStartPageTypes() {
        this.defaultPythonPath = this.findPythonPath();

        this.serviceManager.addSingletonInstance<StartPageIocContainer>(StartPageIocContainer, this);

        // Inform the cacheable locator service to use a static map so that it stays in memory in between tests
        CacheableLocatorPromiseCache.forceUseStatic();

        // Do the same thing for the environment variable activation service.
        EnvironmentActivationServiceCache.forceUseStatic();

        // Create the workspace service first as it's used to set config values.
        this.createWorkspaceService();

        const reactHelpers = require('./reactHelpers') as typeof import('./reactHelpers');
        reactHelpers.setUpDomEnvironment();

        // Setup our webpanel provider to create our dummy web panel
        when(this.webPanelProvider.create(anything())).thenCall(this.onCreateWebPanel.bind(this));
        if (this.uiTest) {
            this.serviceManager.addSingleton<IWebviewPanelProvider>(IWebviewPanelProvider, WebBrowserPanelProvider);
            this.serviceManager.addSingleton<IHttpClient>(IHttpClient, HttpClient);
        } else {
            this.serviceManager.addSingletonInstance<IWebviewPanelProvider>(
                IWebviewPanelProvider,
                instance(this.webPanelProvider),
            );
        }

        this.serviceManager.add<IStartPage>(IStartPage, StartPage);
        this.serviceManager.addSingleton<IMountedWebViewFactory>(IMountedWebViewFactory, MountedWebViewFactory);
        this.serviceManager.addSingleton<IExtensions>(IExtensions, MockExtensions);

        const currentProcess = new CurrentProcess();
        this.serviceManager.addSingletonInstance<ICurrentProcess>(ICurrentProcess, currentProcess);
        this.serviceManager.addSingleton<IFileSystem>(IFileSystem, FileSystem);

        const configurationService = TypeMoq.Mock.ofType<IConfigurationService>();
        configurationService.setup((c) => c.getSettings(TypeMoq.It.isAny())).returns(this.getSettings.bind(this));
        this.serviceManager.addSingletonInstance<IConfigurationService>(
            IConfigurationService,
            configurationService.object,
        );

        // Setup our command list
        this.commandManager.registerCommand('setContext', (name: string, value: boolean) => {
            this.setContexts[name] = value;
            this.contextSetEvent.fire({ name, value });
        });
        this.serviceManager.addSingletonInstance<ICommandManager>(ICommandManager, this.commandManager);
        this.serviceManager.addSingletonInstance<IDocumentManager>(IDocumentManager, this.documentManager);

        this.applicationShell = mock(ApplicationShell);
        this.serviceManager.addSingletonInstance<IApplicationShell>(IApplicationShell, instance(this.applicationShell));

        this.platformService = mock(PlatformService);
        this.serviceManager.addSingletonInstance<IPlatformService>(IPlatformService, this.platformService);

        this.serviceManager.addSingleton<IPathUtils>(IPathUtils, PathUtils);
        this.serviceManager.addSingletonInstance<boolean>(IsWindows, IS_WINDOWS);

        const experimentService = mock(ExperimentService);
        this.serviceManager.addSingletonInstance<IExperimentService>(IExperimentService, instance(experimentService));

        this.serviceManager.addSingleton<IApplicationEnvironment>(IApplicationEnvironment, ApplicationEnvironment);

        this.serviceManager.addSingleton<IThemeFinder>(IThemeFinder, ThemeFinder);
        this.serviceManager.addSingleton<ICodeCssGenerator>(ICodeCssGenerator, CodeCssGenerator);

        this.serviceManager.add<IInstallationChannelManager>(IInstallationChannelManager, InstallationChannelManager);

        const mockExtensionContext = TypeMoq.Mock.ofType<IExtensionContext>();
        mockExtensionContext.setup((m) => m.globalStoragePath).returns(() => os.tmpdir());
        mockExtensionContext.setup((m) => m.extensionPath).returns(() => this.extensionRootPath || os.tmpdir());
        this.serviceManager.addSingletonInstance<IExtensionContext>(IExtensionContext, mockExtensionContext.object);

        // Turn off experiments.
        const experimentManager = mock(ExperimentsManager);
        when(experimentManager.inExperiment(anything())).thenCall((exp) => {
            const setState = this.experimentState.get(exp);
            if (setState === undefined) {
                // All experiments to true by default if not mocking jupyter
                return true;
            }
            return setState;
        });
    }

    public createWebView(mount: () => ReactWrapper<any, Readonly<{}>, React.Component>, id: string) {
        // We need to mount the react control before we even create an interactive window object. Otherwise the mount will miss rendering some parts
        this.pendingWebPanel = this.get<IMountedWebViewFactory>(IMountedWebViewFactory).create(id, mount);
        return this.pendingWebPanel;
    }

    public get<T>(serviceIdentifier: interfaces.ServiceIdentifier<T>, name?: string | number | symbol): T {
        return this.serviceManager.get<T>(serviceIdentifier, name);
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
                this.serviceManager.get<IWorkspaceService>(IWorkspaceService),
            );
            this.settingsMap.set(key, setting);
        } else if (this.disposed) {
            setting = this.generatePythonSettings(this.languageServerType);
        }
        return setting;
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

    public addWorkspaceFolder(folderPath: string) {
        const workspaceFolder = new MockWorkspaceFolder(folderPath, this.workspaceFolders.length);
        this.workspaceFolders.push(workspaceFolder);
        return workspaceFolder;
    }

    private async onCreateWebPanel(options: IWebviewPanelOptions) {
        if (!this.pendingWebPanel) {
            throw new Error('Creating web panel without a mount');
        }
        const panel = this.pendingWebPanel;
        panel.attach(options);
        return panel;
    }

    private createWorkspaceService() {
        class MockFileSystemWatcher implements FileSystemWatcher {
            public ignoreCreateEvents = false;

            public ignoreChangeEvents = false;

            public ignoreDeleteEvents = false;

            public onDidChange(_listener: (e: Uri) => any, _thisArgs?: any, _disposables?: Disposable[]): Disposable {
                return { dispose: noop };
            }

            public onDidDelete(_listener: (e: Uri) => any, _thisArgs?: any, _disposables?: Disposable[]): Disposable {
                return { dispose: noop };
            }

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
        const testWorkspaceFolder = path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'startPage');

        when(workspaceService.createFileSystemWatcher(anything(), anything(), anything(), anything())).thenReturn(
            new MockFileSystemWatcher(),
        );
        when(workspaceService.createFileSystemWatcher(anything())).thenReturn(new MockFileSystemWatcher());
        when(workspaceService.hasWorkspaceFolders).thenReturn(true);
        when(workspaceService.workspaceFolders).thenReturn(this.workspaceFolders);
        when(workspaceService.rootPath).thenReturn(testWorkspaceFolder);
        when(workspaceService.getWorkspaceFolder(anything())).thenCall(this.getWorkspaceFolder.bind(this));
        this.addWorkspaceFolder(testWorkspaceFolder);
        return workspaceService;
    }

    private getResourceKey(resource: Resource): string {
        if (!this.disposed) {
            const workspace = this.serviceManager.get<IWorkspaceService>(IWorkspaceService);
            const workspaceFolderUri = PythonSettings.getSettingsUriAndTarget(resource, workspace).uri;
            return workspaceFolderUri ? workspaceFolderUri.fsPath : '';
        }
        return '';
    }

    private generatePythonWorkspaceConfig(languageServerType: LanguageServerType): MockWorkspaceConfiguration {
        const pythonSettings = this.generatePythonSettings(languageServerType);

        // Use these settings to default all of the settings in a python configuration
        return new MockWorkspaceConfiguration(pythonSettings);
    }

    private generatePythonSettings(languageServerType: LanguageServerType) {
        // Create a dummy settings just to setup the workspace config
        const pythonSettings = new MockPythonSettings(undefined, new MockAutoSelectionService());
        pythonSettings.pythonPath = this.defaultPythonPath!;
        pythonSettings.downloadLanguageServer = false;
        const folders = ['Envs', '.virtualenvs'];
        pythonSettings.venvFolders = folders;
        pythonSettings.venvPath = path.join('~', 'foo');
        pythonSettings.terminal = {
            executeInFileDir: false,
            launchArgs: [],
            activateEnvironment: true,
            activateEnvInCurrentTerminal: false,
        };
        pythonSettings.languageServer = languageServerType;
        return pythonSettings;
    }

    private getWorkspaceFolder(uri: Resource): WorkspaceFolder | undefined {
        if (uri) {
            return this.workspaceFolders.find((w) => w.ownedResources.has(uri.toString()));
        }
        return undefined;
    }

    private findPythonPath(): string {
        try {
            // Use a static variable so we don't have to recompute this on subsequenttests
            if (!StartPageIocContainer.foundPythonPath) {
                // Give preference to the CI test python (could also be set in launch.json for debugging).
                const output = child_process.execFileSync(
                    process.env.CI_PYTHON_PATH || 'python',
                    ['-c', 'import sys;print(sys.executable)'],
                    { encoding: 'utf8' },
                );
                StartPageIocContainer.foundPythonPath = output.replace(/\r?\n/g, '');
            }
            return StartPageIocContainer.foundPythonPath;
        } catch (ex) {
            return 'python';
        }
    }
}
