import { inject, injectable, named } from 'inversify';
import * as os from 'os';
import * as semver from 'semver';
import { CancellationToken, OutputChannel, Uri } from 'vscode';
import '../../common/extensions';
import { IInterpreterService } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { ILinterManager, LinterId } from '../../linters/types';
import { PythonEnvironment } from '../../pythonEnvironments/info';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { TensorBoardPromptSelection } from '../../tensorBoard/constants';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../application/types';
import { Commands, STANDARD_OUTPUT_CHANNEL } from '../constants';
import { LinterInstallationPromptVariants } from '../experiments/groups';
import { traceError, traceInfo } from '../logger';
import { IPlatformService } from '../platform/types';
import { IProcessServiceFactory, IPythonExecutionFactory } from '../process/types';
import { ITerminalServiceFactory } from '../terminal/types';
import {
    IConfigurationService,
    IExperimentService,
    IInstaller,
    InstallerResponse,
    IOutputChannel,
    IPersistentStateFactory,
    ProductInstallStatus,
    ModuleNamePurpose,
    Product,
    ProductType,
} from '../types';
import { Common, Installer, Linters, TensorBoard } from '../utils/localize';
import { isResource, noop } from '../utils/misc';
import { ProductNames } from './productNames';
import {
    IInstallationChannelManager,
    IModuleInstaller,
    InterpreterUri,
    IProductPathService,
    IProductService,
} from './types';

export { Product } from '../types';

export const CTagsInstallationScript =
    os.platform() === 'darwin' ? 'brew install ctags' : 'sudo apt-get install exuberant-ctags';

export abstract class BaseInstaller {
    private static readonly PromptPromises = new Map<string, Promise<InstallerResponse>>();
    protected readonly appShell: IApplicationShell;
    protected readonly configService: IConfigurationService;
    protected readonly workspaceService: IWorkspaceService;
    private readonly productService: IProductService;

    constructor(protected serviceContainer: IServiceContainer, protected outputChannel: OutputChannel) {
        this.appShell = serviceContainer.get<IApplicationShell>(IApplicationShell);
        this.configService = serviceContainer.get<IConfigurationService>(IConfigurationService);
        this.workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        this.productService = serviceContainer.get<IProductService>(IProductService);
    }

    public promptToInstall(
        product: Product,
        resource?: InterpreterUri,
        cancel?: CancellationToken,
        isUpgrade?: boolean,
    ): Promise<InstallerResponse> {
        // If this method gets called twice, while previous promise has not been resolved, then return that same promise.
        // E.g. previous promise is not resolved as a message has been displayed to the user, so no point displaying
        // another message.
        const workspaceFolder =
            resource && isResource(resource) ? this.workspaceService.getWorkspaceFolder(resource) : undefined;
        const key = `${product}${workspaceFolder ? workspaceFolder.uri.fsPath : ''}`;
        if (BaseInstaller.PromptPromises.has(key)) {
            return BaseInstaller.PromptPromises.get(key)!;
        }
        const promise = this.promptToInstallImplementation(product, resource, cancel, isUpgrade);
        BaseInstaller.PromptPromises.set(key, promise);
        promise.then(() => BaseInstaller.PromptPromises.delete(key)).ignoreErrors();
        promise.catch(() => BaseInstaller.PromptPromises.delete(key)).ignoreErrors();

        return promise;
    }

    public async install(
        product: Product,
        resource?: InterpreterUri,
        cancel?: CancellationToken,
    ): Promise<InstallerResponse> {
        if (product === Product.unittest) {
            return InstallerResponse.Installed;
        }

        const channels = this.serviceContainer.get<IInstallationChannelManager>(IInstallationChannelManager);
        const installer = await channels.getInstallationChannel(product, resource);
        if (!installer) {
            return InstallerResponse.Ignore;
        }

        const moduleName = translateProductToModule(product, ModuleNamePurpose.install);
        await installer
            .installModule(moduleName, resource, cancel)
            .catch((ex) => traceError(`Error in installing the module '${moduleName}', ${ex}`));

        return this.isInstalled(product, resource).then((isInstalled) =>
            isInstalled ? InstallerResponse.Installed : InstallerResponse.Ignore,
        );
    }

    /**
     *
     * @param product A product which supports SemVer versioning.
     * @param semVerRequirement A SemVer version requirement.
     * @param resource A URI or a PythonEnvironment.
     */
    public async isProductVersionCompatible(
        product: Product,
        semVerRequirement: string,
        resource?: InterpreterUri,
    ): Promise<ProductInstallStatus> {
        const version = await this.getProductSemVer(product, resource);
        if (!version) {
            return ProductInstallStatus.NotInstalled;
        }
        if (semver.satisfies(version, semVerRequirement)) {
            return ProductInstallStatus.Installed;
        } else {
            return ProductInstallStatus.NeedsUpgrade;
        }
    }

    /**
     *
     * @param product A product which supports SemVer versioning.
     * @param resource A URI or a PythonEnvironment.
     */
    private async getProductSemVer(product: Product, resource: InterpreterUri): Promise<semver.SemVer | null> {
        const interpreter = isResource(resource) ? undefined : resource;
        const uri = isResource(resource) ? resource : undefined;
        const executableName = this.getExecutableNameFromSettings(product, uri);

        const isModule = this.isExecutableAModule(product, uri);

        let version;
        if (isModule) {
            const pythonProcess = await this.serviceContainer
                .get<IPythonExecutionFactory>(IPythonExecutionFactory)
                .createActivatedEnvironment({ resource: uri, interpreter, allowEnvironmentFetchExceptions: true });
            version = await pythonProcess.getModuleVersion(executableName);
        } else {
            const process = await this.serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory).create(uri);
            const result = await process.exec(executableName, ['--version'], { mergeStdOutErr: true });
            version = result.stdout.trim();
        }
        if (!version) {
            return null;
        }
        try {
            return semver.coerce(version);
        } catch (e) {
            traceError(`Unable to parse version ${version} for product ${product}: `, e);
            return null;
        }
    }
    public async isInstalled(product: Product, resource?: InterpreterUri): Promise<boolean | undefined> {
        if (product === Product.unittest) {
            return true;
        }
        // User may have customized the module name or provided the fully qualified path.
        const interpreter = isResource(resource) ? undefined : resource;
        const uri = isResource(resource) ? resource : undefined;
        const executableName = this.getExecutableNameFromSettings(product, uri);

        const isModule = this.isExecutableAModule(product, uri);
        if (isModule) {
            const pythonProcess = await this.serviceContainer
                .get<IPythonExecutionFactory>(IPythonExecutionFactory)
                .createActivatedEnvironment({ resource: uri, interpreter, allowEnvironmentFetchExceptions: true });
            return pythonProcess.isModuleInstalled(executableName);
        } else {
            const process = await this.serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory).create(uri);
            return process
                .exec(executableName, ['--version'], { mergeStdOutErr: true })
                .then(() => true)
                .catch(() => false);
        }
    }

    protected abstract promptToInstallImplementation(
        product: Product,
        resource?: InterpreterUri,
        cancel?: CancellationToken,
        isUpgrade?: boolean,
    ): Promise<InstallerResponse>;
    protected getExecutableNameFromSettings(product: Product, resource?: Uri): string {
        const productType = this.productService.getProductType(product);
        const productPathService = this.serviceContainer.get<IProductPathService>(IProductPathService, productType);
        return productPathService.getExecutableNameFromSettings(product, resource);
    }
    protected isExecutableAModule(product: Product, resource?: Uri): boolean {
        const productType = this.productService.getProductType(product);
        const productPathService = this.serviceContainer.get<IProductPathService>(IProductPathService, productType);
        return productPathService.isExecutableAModule(product, resource);
    }
}

export class CTagsInstaller extends BaseInstaller {
    constructor(serviceContainer: IServiceContainer, outputChannel: OutputChannel) {
        super(serviceContainer, outputChannel);
    }

    public async install(_product: Product, resource?: Uri): Promise<InstallerResponse> {
        if (this.serviceContainer.get<IPlatformService>(IPlatformService).isWindows) {
            this.outputChannel.appendLine('Install Universal Ctags Win32 to enable support for Workspace Symbols');
            this.outputChannel.appendLine('Download the CTags binary from the Universal CTags site.');
            this.outputChannel.appendLine(
                'Option 1: Extract ctags.exe from the downloaded zip to any folder within your PATH so that Visual Studio Code can run it.',
            );
            this.outputChannel.appendLine(
                'Option 2: Extract to any folder and add the path to this folder to the command setting.',
            );
            this.outputChannel.appendLine(
                'Option 3: Extract to any folder and define that path in the python.workspaceSymbols.ctagsPath setting of your user settings file (settings.json).',
            );
            this.outputChannel.show();
        } else {
            const terminalService = this.serviceContainer
                .get<ITerminalServiceFactory>(ITerminalServiceFactory)
                .getTerminalService({ resource });
            terminalService
                .sendCommand(CTagsInstallationScript, [])
                .catch((ex) => traceError(`Failed to install ctags. Script sent '${CTagsInstallationScript}', ${ex}`));
        }
        return InstallerResponse.Ignore;
    }
    protected async promptToInstallImplementation(
        product: Product,
        resource?: Uri,
        _cancel?: CancellationToken,
    ): Promise<InstallerResponse> {
        const item = await this.appShell.showErrorMessage(
            'Install CTags to enable Python workspace symbols?',
            'Yes',
            'No',
        );
        return item === 'Yes' ? this.install(product, resource) : InstallerResponse.Ignore;
    }
}

export class FormatterInstaller extends BaseInstaller {
    protected async promptToInstallImplementation(
        product: Product,
        resource?: Uri,
        cancel?: CancellationToken,
    ): Promise<InstallerResponse> {
        // Hard-coded on purpose because the UI won't necessarily work having
        // another formatter.
        const formatters = [Product.autopep8, Product.black, Product.yapf];
        const formatterNames = formatters.map((formatter) => ProductNames.get(formatter)!);
        const productName = ProductNames.get(product)!;
        formatterNames.splice(formatterNames.indexOf(productName), 1);
        const useOptions = formatterNames.map((name) => `Use ${name}`);
        const yesChoice = 'Yes';

        const options = [...useOptions];
        let message = `Formatter ${productName} is not installed. Install?`;
        if (this.isExecutableAModule(product, resource)) {
            options.splice(0, 0, yesChoice);
        } else {
            const executable = this.getExecutableNameFromSettings(product, resource);
            message = `Path to the ${productName} formatter is invalid (${executable})`;
        }

        const item = await this.appShell.showErrorMessage(message, ...options);
        if (item === yesChoice) {
            return this.install(product, resource, cancel);
        } else if (typeof item === 'string') {
            for (const formatter of formatters) {
                const formatterName = ProductNames.get(formatter)!;

                if (item.endsWith(formatterName)) {
                    await this.configService.updateSetting('formatting.provider', formatterName, resource);
                    return this.install(formatter, resource, cancel);
                }
            }
        }

        return InstallerResponse.Ignore;
    }
}

export class LinterInstaller extends BaseInstaller {
    // This is a hack, really we should be handling this in a service that
    // controls the prompts we show. The issue here was that if we show
    // a prompt to install pylint and flake8, and user selects flake8
    // we immediately show this prompt again saying install flake8, while the
    // installation is on going.
    private static promptSeen: boolean = false;
    private readonly experimentsManager: IExperimentService;
    private readonly linterManager: ILinterManager;

    constructor(protected serviceContainer: IServiceContainer, protected outputChannel: OutputChannel) {
        super(serviceContainer, outputChannel);
        this.experimentsManager = serviceContainer.get<IExperimentService>(IExperimentService);
        this.linterManager = serviceContainer.get<ILinterManager>(ILinterManager);
    }

    public static reset() {
        // Read notes where this is defined.
        LinterInstaller.promptSeen = false;
    }

    protected async promptToInstallImplementation(
        product: Product,
        resource?: Uri,
        cancel?: CancellationToken,
    ): Promise<InstallerResponse> {
        // This is a hack, really we should be handling this in a service that
        // controls the prompts we show. The issue here was that if we show
        // a prompt to install pylint and flake8, and user selects flake8
        // we immediately show this prompt again saying install flake8, while the
        // installation is on going.
        if (LinterInstaller.promptSeen) {
            return InstallerResponse.Ignore;
        }

        LinterInstaller.promptSeen = true;

        // Conditions to use experiment prompt:
        // 1. There should be no linter set in any scope
        // 2. The default linter should be pylint

        if (!this.isLinterSetInAnyScope() && product === Product.pylint) {
            if (await this.experimentsManager.inExperiment(LinterInstallationPromptVariants.noPrompt)) {
                // We won't show a prompt, so tell the extension to treat as though user
                // ignored the prompt.
                sendTelemetryEvent(EventName.LINTER_INSTALL_PROMPT, undefined, {
                    prompt: 'noPrompt',
                });

                const productName = ProductNames.get(product)!;
                traceInfo(`Linter ${productName} is not installed.`);

                return InstallerResponse.Ignore;
            } else if (await this.experimentsManager.inExperiment(LinterInstallationPromptVariants.pylintFirst)) {
                return this.newPromptForInstallation(true, resource, cancel);
            } else if (await this.experimentsManager.inExperiment(LinterInstallationPromptVariants.flake8First)) {
                return this.newPromptForInstallation(false, resource, cancel);
            }
        }

        sendTelemetryEvent(EventName.LINTER_INSTALL_PROMPT, undefined, {
            prompt: 'old',
        });
        return this.oldPromptForInstallation(product, resource, cancel);
    }

    /**
     * For installers that want to avoid prompting the user over and over, they can make use of a
     * persisted true/false value representing user responses to 'stop showing this prompt'. This method
     * gets the persisted value given the installer-defined key.
     *
     * @param key Key to use to get a persisted response value, each installer must define this for themselves.
     * @returns Boolean: The current state of the stored response key given.
     */
    protected getStoredResponse(key: string): boolean {
        const factory = this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
        const state = factory.createGlobalPersistentState<boolean | undefined>(key, undefined);
        return state.value === true;
    }

    private async newPromptForInstallation(pylintFirst: boolean, resource?: Uri, cancel?: CancellationToken) {
        const productName = ProductNames.get(Product.pylint)!;

        // User has already set to ignore this prompt
        const disableLinterInstallPromptKey = `${productName}_DisableLinterInstallPrompt`;
        if (this.getStoredResponse(disableLinterInstallPromptKey) === true) {
            return InstallerResponse.Ignore;
        }

        // Check if the linter settings has Pylint or flake8 pointing to executables.
        // If the settings point to executables then we can't install. Defer to old Prompt.
        if (
            !this.isExecutableAModule(Product.pylint, resource) ||
            !this.isExecutableAModule(Product.flake8, resource)
        ) {
            return this.oldPromptForInstallation(Product.pylint, resource, cancel);
        }

        const installPylint = Linters.installPylint();
        const installFlake8 = Linters.installFlake8();
        const doNotShowAgain = Common.doNotShowAgain();

        const options = pylintFirst
            ? [installPylint, installFlake8, doNotShowAgain]
            : [installFlake8, installPylint, doNotShowAgain];
        const message = Linters.installMessage();
        const prompt = pylintFirst ? 'pylintFirst' : 'flake8first';

        sendTelemetryEvent(EventName.LINTER_INSTALL_PROMPT, undefined, {
            prompt,
        });

        const response = await this.appShell.showInformationMessage(message, ...options);

        if (response === installPylint) {
            sendTelemetryEvent(EventName.LINTER_INSTALL_PROMPT_ACTION, undefined, {
                prompt,
                action: 'installPylint',
            });
            return this.install(Product.pylint, resource, cancel);
        } else if (response === installFlake8) {
            sendTelemetryEvent(EventName.LINTER_INSTALL_PROMPT_ACTION, undefined, {
                prompt,
                action: 'installFlake8',
            });
            await this.linterManager.setActiveLintersAsync([Product.flake8], resource);
            return this.install(Product.flake8, resource, cancel);
        } else if (response === doNotShowAgain) {
            sendTelemetryEvent(EventName.LINTER_INSTALL_PROMPT_ACTION, undefined, {
                prompt,
                action: 'disablePrompt',
            });
            await this.setStoredResponse(disableLinterInstallPromptKey, true);
            return InstallerResponse.Ignore;
        }

        sendTelemetryEvent(EventName.LINTER_INSTALL_PROMPT_ACTION, undefined, {
            prompt,
            action: 'close',
        });
        return InstallerResponse.Ignore;
    }

    private async oldPromptForInstallation(product: Product, resource?: Uri, cancel?: CancellationToken) {
        const isPylint = product === Product.pylint;

        const productName = ProductNames.get(product)!;
        const install = Common.install();
        const doNotShowAgain = Common.doNotShowAgain();
        const disableLinterInstallPromptKey = `${productName}_DisableLinterInstallPrompt`;
        const selectLinter = Linters.selectLinter();

        if (isPylint && this.getStoredResponse(disableLinterInstallPromptKey) === true) {
            return InstallerResponse.Ignore;
        }

        const options = isPylint ? [selectLinter, doNotShowAgain] : [selectLinter];

        let message = `Linter ${productName} is not installed.`;
        if (this.isExecutableAModule(product, resource)) {
            options.splice(0, 0, install);
        } else {
            const executable = this.getExecutableNameFromSettings(product, resource);
            message = `Path to the ${productName} linter is invalid (${executable})`;
        }
        const response = await this.appShell.showErrorMessage(message, ...options);
        if (response === install) {
            sendTelemetryEvent(EventName.LINTER_NOT_INSTALLED_PROMPT, undefined, {
                tool: productName as LinterId,
                action: 'install',
            });
            return this.install(product, resource, cancel);
        } else if (response === doNotShowAgain) {
            await this.setStoredResponse(disableLinterInstallPromptKey, true);
            sendTelemetryEvent(EventName.LINTER_NOT_INSTALLED_PROMPT, undefined, {
                tool: productName as LinterId,
                action: 'disablePrompt',
            });
            return InstallerResponse.Ignore;
        }

        if (response === selectLinter) {
            sendTelemetryEvent(EventName.LINTER_NOT_INSTALLED_PROMPT, undefined, { action: 'select' });
            const commandManager = this.serviceContainer.get<ICommandManager>(ICommandManager);
            await commandManager.executeCommand(Commands.Set_Linter);
        }
        return InstallerResponse.Ignore;
    }

    private isLinterSetInAnyScope() {
        const config = this.workspaceService.getConfiguration('python');
        if (config) {
            const keys = [
                'linting.pylintEnabled',
                'linting.flake8Enabled',
                'linting.banditEnabled',
                'linting.mypyEnabled',
                'linting.pycodestyleEnabled',
                'linting.prospectorEnabled',
                'linting.pydocstyleEnabled',
                'linting.pylamaEnabled',
            ];

            const values = keys.map((key) => {
                const value = config.inspect<boolean>(key);
                if (value) {
                    if (value.globalValue || value.workspaceValue || value.workspaceFolderValue) {
                        return 'linter set';
                    }
                }
                return 'no info';
            });

            return values.includes('linter set');
        }

        return false;
    }

    /**
     * For installers that want to avoid prompting the user over and over, they can make use of a
     * persisted true/false value representing user responses to 'stop showing this prompt'. This
     * method will set that persisted value given the installer-defined key.
     *
     * @param key Key to use to get a persisted response value, each installer must define this for themselves.
     * @param value Boolean value to store for the user - if they choose to not be prompted again for instance.
     * @returns Boolean: The current state of the stored response key given.
     */
    private async setStoredResponse(key: string, value: boolean): Promise<void> {
        const factory = this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
        const state = factory.createGlobalPersistentState<boolean | undefined>(key, undefined);
        if (state && state.value !== value) {
            await state.updateValue(value);
        }
    }
}

export class TestFrameworkInstaller extends BaseInstaller {
    protected async promptToInstallImplementation(
        product: Product,
        resource?: Uri,
        cancel?: CancellationToken,
    ): Promise<InstallerResponse> {
        const productName = ProductNames.get(product)!;

        const options: string[] = [];
        let message = `Test framework ${productName} is not installed. Install?`;
        if (this.isExecutableAModule(product, resource)) {
            options.push(...['Yes', 'No']);
        } else {
            const executable = this.getExecutableNameFromSettings(product, resource);
            message = `Path to the ${productName} test framework is invalid (${executable})`;
        }

        const item = await this.appShell.showErrorMessage(message, ...options);
        return item === 'Yes' ? this.install(product, resource, cancel) : InstallerResponse.Ignore;
    }
}

export class RefactoringLibraryInstaller extends BaseInstaller {
    protected async promptToInstallImplementation(
        product: Product,
        resource?: Uri,
        cancel?: CancellationToken,
    ): Promise<InstallerResponse> {
        const productName = ProductNames.get(product)!;
        const item = await this.appShell.showErrorMessage(
            `Refactoring library ${productName} is not installed. Install?`,
            'Yes',
            'No',
        );
        return item === 'Yes' ? this.install(product, resource, cancel) : InstallerResponse.Ignore;
    }
}

export class DataScienceInstaller extends BaseInstaller {
    // Override base installer to support a more DS-friendly streamlined installation.
    public async install(
        product: Product,
        interpreterUri?: InterpreterUri,
        cancel?: CancellationToken,
        isUpgrade?: boolean,
    ): Promise<InstallerResponse> {
        // Precondition
        if (isResource(interpreterUri)) {
            throw new Error('All data science packages require an interpreter be passed in');
        }

        // At this point we know that `interpreterUri` is of type PythonInterpreter
        const interpreter = interpreterUri as PythonEnvironment;

        // Get a list of known installation channels, pip, conda, etc.
        const channels: IModuleInstaller[] = await this.serviceContainer
            .get<IInstallationChannelManager>(IInstallationChannelManager)
            .getInstallationChannels(interpreter);

        // Pick an installerModule based on whether the interpreter is conda or not. Default is pip.
        let installerModule;
        if (interpreter.envType === 'Conda') {
            installerModule = channels.find((v) => v.name === 'Conda');
        } else {
            installerModule = channels.find((v) => v.name === 'Pip');
        }

        const moduleName = translateProductToModule(product, ModuleNamePurpose.install);
        if (!installerModule) {
            this.appShell.showErrorMessage(Installer.couldNotInstallLibrary().format(moduleName)).then(noop, noop);
            return InstallerResponse.Ignore;
        }

        await installerModule
            .installModule(moduleName, interpreter, cancel, isUpgrade)
            .catch((ex) => traceError(`Error in installing the module '${moduleName}', ${ex}`));

        return this.isInstalled(product, interpreter).then((isInstalled) =>
            isInstalled ? InstallerResponse.Installed : InstallerResponse.Ignore,
        );
    }
    /**
     * This method will not get invoked for Jupyter extension.
     * Implemented as a backup.
     */
    protected async promptToInstallImplementation(
        product: Product,
        resource?: InterpreterUri,
        cancel?: CancellationToken,
    ): Promise<InstallerResponse> {
        const productName = ProductNames.get(product)!;
        const item = await this.appShell.showErrorMessage(
            Installer.dataScienceInstallPrompt().format(productName),
            'Yes',
            'No',
        );
        if (item === 'Yes') {
            return this.install(product, resource, cancel);
        }
        return InstallerResponse.Ignore;
    }
}

export class TensorBoardInstaller extends DataScienceInstaller {
    protected async promptToInstallImplementation(
        product: Product,
        resource: Uri,
        cancel: CancellationToken,
        isUpgrade?: boolean,
    ): Promise<InstallerResponse> {
        sendTelemetryEvent(EventName.TENSORBOARD_INSTALL_PROMPT_SHOWN);
        // Show a prompt message specific to TensorBoard
        const yes = Common.bannerLabelYes();
        const no = Common.bannerLabelNo();
        const message = isUpgrade ? TensorBoard.upgradePrompt() : TensorBoard.installPrompt();
        const selection = await this.appShell.showErrorMessage(message, ...[yes, no]);
        let telemetrySelection = TensorBoardPromptSelection.None;
        if (selection === yes) {
            telemetrySelection = TensorBoardPromptSelection.Yes;
        } else if (selection === no) {
            telemetrySelection = TensorBoardPromptSelection.No;
        }
        sendTelemetryEvent(EventName.TENSORBOARD_INSTALL_PROMPT_SELECTION, undefined, {
            selection: telemetrySelection,
            operationType: isUpgrade ? 'upgrade' : 'install',
        });
        return selection === yes ? this.install(product, resource, cancel, isUpgrade) : InstallerResponse.Ignore;
    }
}

@injectable()
export class ProductInstaller implements IInstaller {
    private readonly productService: IProductService;
    private interpreterService: IInterpreterService;

    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IOutputChannel) @named(STANDARD_OUTPUT_CHANNEL) private outputChannel: OutputChannel,
    ) {
        this.productService = serviceContainer.get<IProductService>(IProductService);
        this.interpreterService = this.serviceContainer.get<IInterpreterService>(IInterpreterService);
    }

    public dispose() {}
    public async promptToInstall(
        product: Product,
        resource?: InterpreterUri,
        cancel?: CancellationToken,
        isUpgrade?: boolean,
    ): Promise<InstallerResponse> {
        const currentInterpreter = isResource(resource)
            ? await this.interpreterService.getActiveInterpreter(resource)
            : resource;
        if (!currentInterpreter) {
            return InstallerResponse.Ignore;
        }
        return this.createInstaller(product).promptToInstall(product, resource, cancel, isUpgrade);
    }
    public async isProductVersionCompatible(
        product: Product,
        semVerRequirement: string,
        resource?: InterpreterUri,
    ): Promise<ProductInstallStatus> {
        return this.createInstaller(product).isProductVersionCompatible(product, semVerRequirement, resource);
    }
    public async install(
        product: Product,
        resource?: InterpreterUri,
        cancel?: CancellationToken,
    ): Promise<InstallerResponse> {
        return this.createInstaller(product).install(product, resource, cancel);
    }
    public async isInstalled(product: Product, resource?: InterpreterUri): Promise<boolean | undefined> {
        return this.createInstaller(product).isInstalled(product, resource);
    }
    public translateProductToModuleName(product: Product, purpose: ModuleNamePurpose): string {
        return translateProductToModule(product, purpose);
    }
    private createInstaller(product: Product): BaseInstaller {
        const productType = this.productService.getProductType(product);
        switch (productType) {
            case ProductType.Formatter:
                return new FormatterInstaller(this.serviceContainer, this.outputChannel);
            case ProductType.Linter:
                return new LinterInstaller(this.serviceContainer, this.outputChannel);
            case ProductType.WorkspaceSymbols:
                return new CTagsInstaller(this.serviceContainer, this.outputChannel);
            case ProductType.TestFramework:
                return new TestFrameworkInstaller(this.serviceContainer, this.outputChannel);
            case ProductType.RefactoringLibrary:
                return new RefactoringLibraryInstaller(this.serviceContainer, this.outputChannel);
            case ProductType.DataScience:
                return new DataScienceInstaller(this.serviceContainer, this.outputChannel);
            case ProductType.TensorBoard:
                return new TensorBoardInstaller(this.serviceContainer, this.outputChannel);
            default:
                break;
        }
        throw new Error(`Unknown product ${product}`);
    }
}

function translateProductToModule(product: Product, purpose: ModuleNamePurpose): string {
    switch (product) {
        case Product.mypy:
            return 'mypy';
        case Product.nosetest: {
            return purpose === ModuleNamePurpose.install ? 'nose' : 'nosetests';
        }
        case Product.pylama:
            return 'pylama';
        case Product.prospector:
            return 'prospector';
        case Product.pylint:
            return 'pylint';
        case Product.pytest:
            return 'pytest';
        case Product.autopep8:
            return 'autopep8';
        case Product.black:
            return 'black';
        case Product.pycodestyle:
            return 'pycodestyle';
        case Product.pydocstyle:
            return 'pydocstyle';
        case Product.yapf:
            return 'yapf';
        case Product.flake8:
            return 'flake8';
        case Product.unittest:
            return 'unittest';
        case Product.rope:
            return 'rope';
        case Product.bandit:
            return 'bandit';
        case Product.jupyter:
            return 'jupyter';
        case Product.notebook:
            return 'notebook';
        case Product.pandas:
            return 'pandas';
        case Product.ipykernel:
            return 'ipykernel';
        case Product.nbconvert:
            return 'nbconvert';
        case Product.kernelspec:
            return 'kernelspec';
        case Product.tensorboard:
            return 'tensorboard';
        default: {
            throw new Error(`Product ${product} cannot be installed as a Python Module.`);
        }
    }
}
