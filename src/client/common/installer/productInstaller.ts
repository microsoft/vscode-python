/* eslint-disable max-classes-per-file */

import { inject, injectable } from 'inversify';
import * as semver from 'semver';
import { CancellationToken, Uri } from 'vscode';
import '../extensions';
import { IInterpreterService } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { LinterId } from '../../linters/types';
import { EnvironmentType, ModuleInstallerType, PythonEnvironment } from '../../pythonEnvironments/info';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../application/types';
import { Commands } from '../constants';
import { IProcessServiceFactory, IPythonExecutionFactory } from '../process/types';
import {
    IConfigurationService,
    IInstaller,
    InstallerResponse,
    IPersistentStateFactory,
    ProductInstallStatus,
    Product,
    ProductType,
} from '../types';
import { Common, Installer, Linters, Products } from '../utils/localize';
import { isResource, noop } from '../utils/misc';
import { translateProductToModule } from './moduleInstaller';
import { ProductNames } from './productNames';
import {
    IInstallationChannelManager,
    IModuleInstaller,
    InterpreterUri,
    IProductPathService,
    IProductService,
    ModuleInstallFlags,
} from './types';
import { traceError, traceInfo } from '../../logging';

export { Product } from '../types';

// Products which may not be available to install from certain package registries, keyed by product name
// Installer implementations can check this to determine a suitable installation channel for a product
// This is temporary and can be removed when https://github.com/microsoft/vscode-jupyter/issues/5034 is unblocked
const UnsupportedChannelsForProduct = new Map<Product, Set<EnvironmentType>>([
    [Product.torchProfilerInstallName, new Set([EnvironmentType.Conda])],
]);

abstract class BaseInstaller {
    private static readonly PromptPromises = new Map<string, Promise<InstallerResponse>>();

    protected readonly appShell: IApplicationShell;

    protected readonly configService: IConfigurationService;

    protected readonly workspaceService: IWorkspaceService;

    private readonly productService: IProductService;

    protected readonly persistentStateFactory: IPersistentStateFactory;

    constructor(protected serviceContainer: IServiceContainer) {
        this.appShell = serviceContainer.get<IApplicationShell>(IApplicationShell);
        this.configService = serviceContainer.get<IConfigurationService>(IConfigurationService);
        this.workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        this.productService = serviceContainer.get<IProductService>(IProductService);
        this.persistentStateFactory = serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
    }

    public promptToInstall(
        product: Product,
        resource?: InterpreterUri,
        cancel?: CancellationToken,
        flags?: ModuleInstallFlags,
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
        const promise = this.promptToInstallImplementation(product, resource, cancel, flags);
        BaseInstaller.PromptPromises.set(key, promise);
        promise.then(() => BaseInstaller.PromptPromises.delete(key)).ignoreErrors();
        promise.catch(() => BaseInstaller.PromptPromises.delete(key)).ignoreErrors();

        return promise;
    }

    public async install(
        product: Product,
        resource?: InterpreterUri,
        cancel?: CancellationToken,
        flags?: ModuleInstallFlags,
    ): Promise<InstallerResponse> {
        if (product === Product.unittest) {
            return InstallerResponse.Installed;
        }

        const channels = this.serviceContainer.get<IInstallationChannelManager>(IInstallationChannelManager);
        const installer = await channels.getInstallationChannel(product, resource);
        if (!installer) {
            sendTelemetryEvent(EventName.PYTHON_INSTALL_PACKAGE, undefined, {
                installer: 'unavailable',
                productName: ProductNames.get(product),
            });
            return InstallerResponse.Ignore;
        }

        await installer
            .installModule(product, resource, cancel, flags)
            .catch((ex) => traceError(`Error in installing the product '${ProductNames.get(product)}', ${ex}`));

        return this.isInstalled(product, resource).then((isInstalled) => {
            sendTelemetryEvent(EventName.PYTHON_INSTALL_PACKAGE, undefined, {
                installer: installer.displayName,
                productName: ProductNames.get(product),
                isInstalled,
            });
            return isInstalled ? InstallerResponse.Installed : InstallerResponse.Ignore;
        });
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
        }
        return ProductInstallStatus.NeedsUpgrade;
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

    public async isInstalled(product: Product, resource?: InterpreterUri): Promise<boolean> {
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
        }
        const process = await this.serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory).create(uri);
        return process
            .exec(executableName, ['--version'], { mergeStdOutErr: true })
            .then(() => true)
            .catch(() => false);
    }

    protected abstract promptToInstallImplementation(
        product: Product,
        resource?: InterpreterUri,
        cancel?: CancellationToken,
        flags?: ModuleInstallFlags,
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

const doNotDisplayFormatterPromptStateKey = 'FORMATTER_NOT_INSTALLED_KEY';

export class FormatterInstaller extends BaseInstaller {
    protected async promptToInstallImplementation(
        product: Product,
        resource?: Uri,
        cancel?: CancellationToken,
        _flags?: ModuleInstallFlags,
    ): Promise<InstallerResponse> {
        const neverShowAgain = this.persistentStateFactory.createGlobalPersistentState(
            doNotDisplayFormatterPromptStateKey,
            false,
        );

        if (neverShowAgain.value) {
            return InstallerResponse.Ignore;
        }

        // Hard-coded on purpose because the UI won't necessarily work having
        // another formatter.
        const formatters = [Product.autopep8, Product.black, Product.yapf];
        const formatterNames = formatters.map((formatter) => ProductNames.get(formatter)!);
        const productName = ProductNames.get(product)!;
        formatterNames.splice(formatterNames.indexOf(productName), 1);
        const useOptions = formatterNames.map((name) => Products.useFormatter().format(name));
        const yesChoice = Common.bannerLabelYes();

        const options = [...useOptions, Common.doNotShowAgain()];
        let message = Products.formatterNotInstalled().format(productName);
        if (this.isExecutableAModule(product, resource)) {
            options.splice(0, 0, yesChoice);
        } else {
            const executable = this.getExecutableNameFromSettings(product, resource);
            message = Products.invalidFormatterPath().format(productName, executable);
        }

        const item = await this.appShell.showErrorMessage(message, ...options);
        if (item === yesChoice) {
            return this.install(product, resource, cancel);
        }

        if (item === Common.doNotShowAgain()) {
            neverShowAgain.updateValue(true);
            return InstallerResponse.Ignore;
        }

        if (typeof item === 'string') {
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
    constructor(protected serviceContainer: IServiceContainer) {
        super(serviceContainer);
    }

    protected async promptToInstallImplementation(
        product: Product,
        resource?: Uri,
        cancel?: CancellationToken,
        _flags?: ModuleInstallFlags,
    ): Promise<InstallerResponse> {
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

    private async oldPromptForInstallation(product: Product, resource?: Uri, cancel?: CancellationToken) {
        const productName = ProductNames.get(product)!;
        const install = Common.install();
        const doNotShowAgain = Common.doNotShowAgain();
        const disableLinterInstallPromptKey = `${productName}_DisableLinterInstallPrompt`;
        const selectLinter = Linters.selectLinter();

        if (this.getStoredResponse(disableLinterInstallPromptKey) === true) {
            return InstallerResponse.Ignore;
        }

        const options = [selectLinter, doNotShowAgain];

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
        }
        if (response === doNotShowAgain) {
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
        _flags?: ModuleInstallFlags,
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

export class DataScienceInstaller extends BaseInstaller {
    // Override base installer to support a more DS-friendly streamlined installation.
    public async install(
        product: Product,
        interpreterUri?: InterpreterUri,
        cancel?: CancellationToken,
        flags?: ModuleInstallFlags,
    ): Promise<InstallerResponse> {
        // Precondition
        if (isResource(interpreterUri)) {
            throw new Error('All data science packages require an interpreter be passed in');
        }

        // At this point we know that `interpreterUri` is of type PythonInterpreter
        const interpreter = interpreterUri as PythonEnvironment;

        // Get a list of known installation channels, pip, conda, etc.
        let channels: IModuleInstaller[] = await this.serviceContainer
            .get<IInstallationChannelManager>(IInstallationChannelManager)
            .getInstallationChannels(interpreter);

        // Pick an installerModule based on whether the interpreter is conda or not. Default is pip.
        const moduleName = translateProductToModule(product);
        const version = `${interpreter.version?.major || ''}.${interpreter.version?.minor || ''}.${
            interpreter.version?.patch || ''
        }`;

        // If this is a non-conda environment & pip isn't installed, we need to install pip.
        // The prompt would have been disabled prior to this point, so we can assume that.
        if (
            flags &&
            flags & ModuleInstallFlags.installPipIfRequired &&
            interpreter.envType !== EnvironmentType.Conda &&
            !channels.some((channel) => channel.type === ModuleInstallerType.Pip)
        ) {
            const installers = this.serviceContainer.getAll<IModuleInstaller>(IModuleInstaller);
            const pipInstaller = installers.find((installer) => installer.type === ModuleInstallerType.Pip);
            if (pipInstaller) {
                traceInfo(`Installing pip as its not available to install ${moduleName}.`);
                await pipInstaller
                    .installModule(Product.pip, interpreter, cancel)
                    .catch((ex) =>
                        traceError(
                            `Error in installing the module '${moduleName} as Pip could not be installed', ${ex}`,
                        ),
                    );

                await this.isInstalled(Product.pip, interpreter)
                    .then((isInstalled) => {
                        sendTelemetryEvent(EventName.PYTHON_INSTALL_PACKAGE, undefined, {
                            installer: pipInstaller.displayName,
                            requiredInstaller: ModuleInstallerType.Pip,
                            version,
                            envType: interpreter.envType,
                            isInstalled,
                            productName: ProductNames.get(Product.pip),
                        });
                    })
                    .catch(noop);

                // Refresh the list of channels (pip may be avaialble now).
                channels = await this.serviceContainer
                    .get<IInstallationChannelManager>(IInstallationChannelManager)
                    .getInstallationChannels(interpreter);
            } else {
                sendTelemetryEvent(EventName.PYTHON_INSTALL_PACKAGE, undefined, {
                    installer: 'unavailable',
                    requiredInstaller: ModuleInstallerType.Pip,
                    productName: ProductNames.get(Product.pip),
                    version,
                    envType: interpreter.envType,
                });
                traceError(`Unable to install pip when its required.`);
            }
        }

        const isAvailableThroughConda = !UnsupportedChannelsForProduct.get(product)?.has(EnvironmentType.Conda);
        let requiredInstaller = ModuleInstallerType.Unknown;
        if (interpreter.envType === EnvironmentType.Conda && isAvailableThroughConda) {
            requiredInstaller = ModuleInstallerType.Conda;
        } else if (interpreter.envType === EnvironmentType.Conda && !isAvailableThroughConda) {
            // This case is temporary and can be removed when https://github.com/microsoft/vscode-jupyter/issues/5034 is unblocked
            traceInfo(
                `Interpreter type is conda but package ${moduleName} is not available through conda, using pip instead.`,
            );
            requiredInstaller = ModuleInstallerType.Pip;
        } else {
            switch (interpreter.envType) {
                case EnvironmentType.Pipenv:
                    requiredInstaller = ModuleInstallerType.Pipenv;
                    break;
                case EnvironmentType.Poetry:
                    requiredInstaller = ModuleInstallerType.Poetry;
                    break;
                default:
                    requiredInstaller = ModuleInstallerType.Pip;
            }
        }
        const installerModule: IModuleInstaller | undefined = channels.find((v) => v.type === requiredInstaller);

        if (!installerModule) {
            this.appShell.showErrorMessage(Installer.couldNotInstallLibrary().format(moduleName)).then(noop, noop);
            sendTelemetryEvent(EventName.PYTHON_INSTALL_PACKAGE, undefined, {
                installer: 'unavailable',
                requiredInstaller,
                productName: ProductNames.get(product),
                version,
                envType: interpreter.envType,
            });
            return InstallerResponse.Ignore;
        }

        await installerModule
            .installModule(product, interpreter, cancel, flags)
            .catch((ex) => traceError(`Error in installing the module '${moduleName}', ${ex}`));

        return this.isInstalled(product, interpreter).then((isInstalled) => {
            sendTelemetryEvent(EventName.PYTHON_INSTALL_PACKAGE, undefined, {
                installer: installerModule.displayName || '',
                requiredInstaller,
                version,
                envType: interpreter.envType,
                isInstalled,
                productName: ProductNames.get(product),
            });
            return isInstalled ? InstallerResponse.Installed : InstallerResponse.Ignore;
        });
    }

    /**
     * This method will not get invoked for Jupyter extension.
     * Implemented as a backup.
     */
    protected async promptToInstallImplementation(
        product: Product,
        resource?: InterpreterUri,
        cancel?: CancellationToken,
        _flags?: ModuleInstallFlags,
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

@injectable()
export class ProductInstaller implements IInstaller {
    private readonly productService: IProductService;

    private interpreterService: IInterpreterService;

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.productService = serviceContainer.get<IProductService>(IProductService);
        this.interpreterService = this.serviceContainer.get<IInterpreterService>(IInterpreterService);
    }

    public dispose(): void {
        /** Do nothing. */
    }

    public async promptToInstall(
        product: Product,
        resource?: InterpreterUri,
        cancel?: CancellationToken,
        flags?: ModuleInstallFlags,
    ): Promise<InstallerResponse> {
        const currentInterpreter = isResource(resource)
            ? await this.interpreterService.getActiveInterpreter(resource)
            : resource;
        if (!currentInterpreter) {
            return InstallerResponse.Ignore;
        }
        return this.createInstaller(product).promptToInstall(product, resource, cancel, flags);
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
        flags?: ModuleInstallFlags,
    ): Promise<InstallerResponse> {
        return this.createInstaller(product).install(product, resource, cancel, flags);
    }

    public async isInstalled(product: Product, resource?: InterpreterUri): Promise<boolean> {
        return this.createInstaller(product).isInstalled(product, resource);
    }

    // eslint-disable-next-line class-methods-use-this
    public translateProductToModuleName(product: Product): string {
        return translateProductToModule(product);
    }

    private createInstaller(product: Product): BaseInstaller {
        const productType = this.productService.getProductType(product);
        switch (productType) {
            case ProductType.Formatter:
                return new FormatterInstaller(this.serviceContainer);
            case ProductType.Linter:
                return new LinterInstaller(this.serviceContainer);
            case ProductType.TestFramework:
                return new TestFrameworkInstaller(this.serviceContainer);
            case ProductType.DataScience:
                return new DataScienceInstaller(this.serviceContainer);
            default:
                break;
        }
        throw new Error(`Unknown product ${product}`);
    }
}
