import * as path from 'path';
import { instance, mock } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { ConfigurationTarget, Uri } from 'vscode';
import { IExtensionSingleActivationService } from '../../client/activation/types';
import { ActiveResourceService } from '../../client/common/application/activeResource';
import { ApplicationEnvironment } from '../../client/common/application/applicationEnvironment';
import { ClipboardService } from '../../client/common/application/clipboard';
import { ReloadVSCodeCommandHandler } from '../../client/common/application/commands/reloadCommand';
import { ReportIssueCommandHandler } from '../../client/common/application/commands/reportIssueCommand';
import { DebugService } from '../../client/common/application/debugService';
import { DebugSessionTelemetry } from '../../client/common/application/debugSessionTelemetry';
import { DocumentManager } from '../../client/common/application/documentManager';
import { Extensions } from '../../client/common/application/extensions';
import {
    IActiveResourceService,
    IApplicationEnvironment,
    IApplicationShell,
    IClipboard,
    ICommandManager,
    IDebugService,
    IDocumentManager,
    IWorkspaceService,
} from '../../client/common/application/types';
import { WorkspaceService } from '../../client/common/application/workspace';
import { AsyncDisposableRegistry } from '../../client/common/asyncDisposableRegistry';
import { ConfigurationService } from '../../client/common/configuration/service';
import { CryptoUtils } from '../../client/common/crypto';
import { EditorUtils } from '../../client/common/editor';
import { ExperimentService } from '../../client/common/experiments/service';
import {
    ExtensionInsidersDailyChannelRule,
    ExtensionInsidersOffChannelRule,
    ExtensionInsidersWeeklyChannelRule,
} from '../../client/common/insidersBuild/downloadChannelRules';
import { ExtensionChannelService } from '../../client/common/insidersBuild/downloadChannelService';
import { InsidersExtensionPrompt } from '../../client/common/insidersBuild/insidersExtensionPrompt';
import { InsidersExtensionService } from '../../client/common/insidersBuild/insidersExtensionService';
import {
    ExtensionChannel,
    IExtensionChannelRule,
    IExtensionChannelService,
    IInsiderExtensionPrompt,
} from '../../client/common/insidersBuild/types';
import { InstallationChannelManager } from '../../client/common/installer/channelManager';
import { ProductInstaller } from '../../client/common/installer/productInstaller';
import {
    CTagsProductPathService,
    FormatterProductPathService,
    LinterProductPathService,
    RefactoringLibraryProductPathService,
    TestFrameworkProductPathService,
} from '../../client/common/installer/productPath';
import { ProductService } from '../../client/common/installer/productService';
import {
    IInstallationChannelManager,
    IModuleInstaller,
    IProductPathService,
    IProductService,
} from '../../client/common/installer/types';
import { InterpreterPathService } from '../../client/common/interpreterPathService';
import { BrowserService } from '../../client/common/net/browser';
import { FileDownloader } from '../../client/common/net/fileDownloader';
import { HttpClient } from '../../client/common/net/httpClient';
import { NugetService } from '../../client/common/nuget/nugetService';
import { INugetService } from '../../client/common/nuget/types';
import { PersistentStateFactory } from '../../client/common/persistentState';
import { PathUtils } from '../../client/common/platform/pathUtils';
import { CurrentProcess } from '../../client/common/process/currentProcess';
import { ProcessLogger } from '../../client/common/process/logger';
import { IProcessLogger, IProcessServiceFactory } from '../../client/common/process/types';
import { TerminalActivator } from '../../client/common/terminal/activator';
import { PowershellTerminalActivationFailedHandler } from '../../client/common/terminal/activator/powershellFailedHandler';
import { Bash } from '../../client/common/terminal/environmentActivationProviders/bash';
import { CommandPromptAndPowerShell } from '../../client/common/terminal/environmentActivationProviders/commandPrompt';
import { CondaActivationCommandProvider } from '../../client/common/terminal/environmentActivationProviders/condaActivationProvider';
import { PipEnvActivationCommandProvider } from '../../client/common/terminal/environmentActivationProviders/pipEnvActivationProvider';
import { PyEnvActivationCommandProvider } from '../../client/common/terminal/environmentActivationProviders/pyenvActivationProvider';
import { TerminalServiceFactory } from '../../client/common/terminal/factory';
import { TerminalHelper } from '../../client/common/terminal/helper';
import { SettingsShellDetector } from '../../client/common/terminal/shellDetectors/settingsShellDetector';
import { TerminalNameShellDetector } from '../../client/common/terminal/shellDetectors/terminalNameShellDetector';
import { UserEnvironmentShellDetector } from '../../client/common/terminal/shellDetectors/userEnvironmentShellDetector';
import { VSCEnvironmentShellDetector } from '../../client/common/terminal/shellDetectors/vscEnvironmentShellDetector';
import {
    IShellDetector,
    ITerminalActivationCommandProvider,
    ITerminalActivationHandler,
    ITerminalActivator,
    ITerminalHelper,
    ITerminalServiceFactory,
    TerminalActivationProviders,
} from '../../client/common/terminal/types';
import {
    IAsyncDisposableRegistry,
    IBrowserService,
    IConfigurationService,
    ICryptoUtils,
    ICurrentProcess,
    IEditorUtils,
    IExperimentService,
    IExtensions,
    IFileDownloader,
    IHttpClient,
    IInstaller,
    IInterpreterPathService,
    IPathUtils,
    IPersistentStateFactory,
    IRandom,
    IsWindows,
    ModuleNamePurpose,
    Product,
    ProductType,
} from '../../client/common/types';
import { createDeferred } from '../../client/common/utils/async';
import { getNamesAndValues } from '../../client/common/utils/enum';
import { IMultiStepInputFactory, MultiStepInputFactory } from '../../client/common/utils/multiStepInput';
import { Random } from '../../client/common/utils/random';
import { ImportTracker } from '../../client/telemetry/importTracker';
import { IImportTracker } from '../../client/telemetry/types';
import { rootWorkspaceUri, updateSetting } from '../common';
import { MockModuleInstaller } from '../mocks/moduleInstaller';
import { MockProcessService } from '../mocks/proc';
import { UnitTestIocContainer } from '../testing/serviceRegistry';
import { closeActiveWindows, initializeTest, IS_MULTI_ROOT_TEST } from '../initialize';

suite('Installer', () => {
    let ioc: UnitTestIocContainer;
    const workspaceUri = Uri.file(path.join(__dirname, '..', '..', '..', 'src', 'test'));
    const resource = IS_MULTI_ROOT_TEST ? workspaceUri : undefined;
    suiteSetup(initializeTest);
    setup(async () => {
        await initializeTest();
        await resetSettings();
        await initializeDI();
    });
    suiteTeardown(async () => {
        await closeActiveWindows();
        await resetSettings();
    });
    teardown(async () => {
        await ioc.dispose();
        await closeActiveWindows();
    });

    async function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerUnitTestTypes();
        ioc.registerFileSystemTypes();
        ioc.registerVariableTypes();
        ioc.registerLinterTypes();
        ioc.registerFormatterTypes();
        ioc.registerInterpreterStorageTypes();

        ioc.serviceManager.addSingleton<IPersistentStateFactory>(IPersistentStateFactory, PersistentStateFactory);
        ioc.serviceManager.addSingleton<IInstaller>(IInstaller, ProductInstaller);
        ioc.serviceManager.addSingleton<IPathUtils>(IPathUtils, PathUtils);
        ioc.serviceManager.addSingleton<IProcessLogger>(IProcessLogger, ProcessLogger);
        ioc.serviceManager.addSingleton<ICurrentProcess>(ICurrentProcess, CurrentProcess);
        ioc.serviceManager.addSingleton<IInstallationChannelManager>(
            IInstallationChannelManager,
            InstallationChannelManager,
        );
        ioc.serviceManager.addSingletonInstance<ICommandManager>(
            ICommandManager,
            TypeMoq.Mock.ofType<ICommandManager>().object,
        );

        ioc.serviceManager.addSingletonInstance<IApplicationShell>(
            IApplicationShell,
            TypeMoq.Mock.ofType<IApplicationShell>().object,
        );
        ioc.serviceManager.addSingleton<IConfigurationService>(IConfigurationService, ConfigurationService);
        ioc.serviceManager.addSingleton<IWorkspaceService>(IWorkspaceService, WorkspaceService);

        await ioc.registerMockInterpreterTypes();
        ioc.registerMockProcessTypes();
        ioc.serviceManager.addSingletonInstance<boolean>(IsWindows, false);
        ioc.serviceManager.addSingletonInstance<IProductService>(IProductService, new ProductService());
        ioc.serviceManager.addSingleton<IProductPathService>(
            IProductPathService,
            CTagsProductPathService,
            ProductType.WorkspaceSymbols,
        );
        ioc.serviceManager.addSingleton<IProductPathService>(
            IProductPathService,
            FormatterProductPathService,
            ProductType.Formatter,
        );
        ioc.serviceManager.addSingleton<IProductPathService>(
            IProductPathService,
            LinterProductPathService,
            ProductType.Linter,
        );
        ioc.serviceManager.addSingleton<IProductPathService>(
            IProductPathService,
            TestFrameworkProductPathService,
            ProductType.TestFramework,
        );
        ioc.serviceManager.addSingleton<IProductPathService>(
            IProductPathService,
            RefactoringLibraryProductPathService,
            ProductType.RefactoringLibrary,
        );
        ioc.serviceManager.addSingleton<IActiveResourceService>(IActiveResourceService, ActiveResourceService);
        ioc.serviceManager.addSingleton<IInterpreterPathService>(IInterpreterPathService, InterpreterPathService);
        ioc.serviceManager.addSingleton<IExtensions>(IExtensions, Extensions);
        ioc.serviceManager.addSingleton<IRandom>(IRandom, Random);
        ioc.serviceManager.addSingleton<ITerminalServiceFactory>(ITerminalServiceFactory, TerminalServiceFactory);
        ioc.serviceManager.addSingleton<IClipboard>(IClipboard, ClipboardService);
        ioc.serviceManager.addSingleton<IDocumentManager>(IDocumentManager, DocumentManager);
        ioc.serviceManager.addSingleton<IDebugService>(IDebugService, DebugService);
        ioc.serviceManager.addSingleton<IApplicationEnvironment>(IApplicationEnvironment, ApplicationEnvironment);
        ioc.serviceManager.addSingleton<IBrowserService>(IBrowserService, BrowserService);
        ioc.serviceManager.addSingleton<IHttpClient>(IHttpClient, HttpClient);
        ioc.serviceManager.addSingleton<IFileDownloader>(IFileDownloader, FileDownloader);
        ioc.serviceManager.addSingleton<IEditorUtils>(IEditorUtils, EditorUtils);
        ioc.serviceManager.addSingleton<INugetService>(INugetService, NugetService);
        ioc.serviceManager.addSingleton<ITerminalActivator>(ITerminalActivator, TerminalActivator);
        ioc.serviceManager.addSingleton<ITerminalActivationHandler>(
            ITerminalActivationHandler,
            PowershellTerminalActivationFailedHandler,
        );
        ioc.serviceManager.addSingleton<ICryptoUtils>(ICryptoUtils, CryptoUtils);
        ioc.serviceManager.addSingleton<IExperimentService>(IExperimentService, ExperimentService);

        ioc.serviceManager.addSingleton<ITerminalHelper>(ITerminalHelper, TerminalHelper);
        ioc.serviceManager.addSingleton<ITerminalActivationCommandProvider>(
            ITerminalActivationCommandProvider,
            Bash,
            TerminalActivationProviders.bashCShellFish,
        );
        ioc.serviceManager.addSingleton<ITerminalActivationCommandProvider>(
            ITerminalActivationCommandProvider,
            CommandPromptAndPowerShell,
            TerminalActivationProviders.commandPromptAndPowerShell,
        );
        ioc.serviceManager.addSingleton<ITerminalActivationCommandProvider>(
            ITerminalActivationCommandProvider,
            PyEnvActivationCommandProvider,
            TerminalActivationProviders.pyenv,
        );
        ioc.serviceManager.addSingleton<ITerminalActivationCommandProvider>(
            ITerminalActivationCommandProvider,
            CondaActivationCommandProvider,
            TerminalActivationProviders.conda,
        );
        ioc.serviceManager.addSingleton<ITerminalActivationCommandProvider>(
            ITerminalActivationCommandProvider,
            PipEnvActivationCommandProvider,
            TerminalActivationProviders.pipenv,
        );
        ioc.serviceManager.addSingleton<IAsyncDisposableRegistry>(IAsyncDisposableRegistry, AsyncDisposableRegistry);
        ioc.serviceManager.addSingleton<IMultiStepInputFactory>(IMultiStepInputFactory, MultiStepInputFactory);
        ioc.serviceManager.addSingleton<IImportTracker>(IImportTracker, ImportTracker);
        ioc.serviceManager.addBinding(IImportTracker, IExtensionSingleActivationService);
        ioc.serviceManager.addSingleton<IShellDetector>(IShellDetector, TerminalNameShellDetector);
        ioc.serviceManager.addSingleton<IShellDetector>(IShellDetector, SettingsShellDetector);
        ioc.serviceManager.addSingleton<IShellDetector>(IShellDetector, UserEnvironmentShellDetector);
        ioc.serviceManager.addSingleton<IShellDetector>(IShellDetector, VSCEnvironmentShellDetector);
        ioc.serviceManager.addSingleton<IInsiderExtensionPrompt>(IInsiderExtensionPrompt, InsidersExtensionPrompt);
        ioc.serviceManager.addSingleton<IExtensionSingleActivationService>(
            IExtensionSingleActivationService,
            InsidersExtensionService,
        );
        ioc.serviceManager.addSingleton<IExtensionSingleActivationService>(
            IExtensionSingleActivationService,
            ReloadVSCodeCommandHandler,
        );
        ioc.serviceManager.addSingleton<IExtensionSingleActivationService>(
            IExtensionSingleActivationService,
            ReportIssueCommandHandler,
        );
        ioc.serviceManager.addSingleton<IExtensionChannelService>(IExtensionChannelService, ExtensionChannelService);
        ioc.serviceManager.addSingleton<IExtensionChannelRule>(
            IExtensionChannelRule,
            ExtensionInsidersOffChannelRule,
            ExtensionChannel.off,
        );
        ioc.serviceManager.addSingleton<IExtensionChannelRule>(
            IExtensionChannelRule,
            ExtensionInsidersDailyChannelRule,
            ExtensionChannel.daily,
        );
        ioc.serviceManager.addSingleton<IExtensionChannelRule>(
            IExtensionChannelRule,
            ExtensionInsidersWeeklyChannelRule,
            ExtensionChannel.weekly,
        );
        ioc.serviceManager.addSingleton<IExtensionSingleActivationService>(
            IExtensionSingleActivationService,
            DebugSessionTelemetry,
        );
    }
    async function resetSettings() {
        await updateSetting('linting.pylintEnabled', true, rootWorkspaceUri, ConfigurationTarget.Workspace);
    }

    async function testCheckingIfProductIsInstalled(product: Product) {
        const installer = ioc.serviceContainer.get<IInstaller>(IInstaller);
        const processService = (await ioc.serviceContainer
            .get<IProcessServiceFactory>(IProcessServiceFactory)
            .create()) as MockProcessService;
        const checkInstalledDef = createDeferred<boolean>();
        processService.onExec((_file, args, _options, callback) => {
            const moduleName = installer.translateProductToModuleName(product, ModuleNamePurpose.run);
            if (args.length > 1 && args[0] === '-c' && args[1] === `import ${moduleName}`) {
                checkInstalledDef.resolve(true);
            }
            callback({ stdout: '' });
        });
        await installer.isInstalled(product, resource);
        await checkInstalledDef.promise;
    }
    getNamesAndValues<Product>(Product).forEach((prod) => {
        test(`Ensure isInstalled for Product: '${prod.name}' executes the right command`, async function () {
            if (new ProductService().getProductType(prod.value) === ProductType.DataScience) {
                return this.skip();
            }
            ioc.serviceManager.addSingletonInstance<IModuleInstaller>(
                IModuleInstaller,
                new MockModuleInstaller('one', false),
            );
            ioc.serviceManager.addSingletonInstance<IModuleInstaller>(
                IModuleInstaller,
                new MockModuleInstaller('two', true),
            );
            ioc.serviceManager.addSingletonInstance<ITerminalHelper>(ITerminalHelper, instance(mock(TerminalHelper)));
            if (prod.value === Product.ctags || prod.value === Product.unittest || prod.value === Product.isort) {
                return undefined;
            }
            await testCheckingIfProductIsInstalled(prod.value);

            return undefined;
        });
    });

    async function testInstallingProduct(product: Product) {
        const installer = ioc.serviceContainer.get<IInstaller>(IInstaller);
        const checkInstalledDef = createDeferred<boolean>();
        const moduleInstallers = ioc.serviceContainer.getAll<MockModuleInstaller>(IModuleInstaller);
        const moduleInstallerOne = moduleInstallers.find((item) => item.displayName === 'two')!;

        moduleInstallerOne.on('installModule', (name: Product | string) => {
            if (product === name) {
                checkInstalledDef.resolve();
            }
        });
        await installer.install(product);
        await checkInstalledDef.promise;
    }
    getNamesAndValues<Product>(Product).forEach((prod) => {
        test(`Ensure install for Product: '${prod.name}' executes the right command in IModuleInstaller`, async function () {
            const productType = new ProductService().getProductType(prod.value);
            if (productType === ProductType.DataScience) {
                return this.skip();
            }
            ioc.serviceManager.addSingletonInstance<IModuleInstaller>(
                IModuleInstaller,
                new MockModuleInstaller('one', false),
            );
            ioc.serviceManager.addSingletonInstance<IModuleInstaller>(
                IModuleInstaller,
                new MockModuleInstaller('two', true),
            );
            ioc.serviceManager.addSingletonInstance<ITerminalHelper>(ITerminalHelper, instance(mock(TerminalHelper)));
            if (prod.value === Product.unittest || prod.value === Product.ctags || prod.value === Product.isort) {
                return undefined;
            }
            await testInstallingProduct(prod.value);

            return undefined;
        });
    });
});
