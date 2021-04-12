/* eslint-disable max-classes-per-file */

import { inject, injectable, named } from 'inversify';
import * as os from 'os';
import * as semver from 'semver';
import { CancellationToken, OutputChannel, Uri } from 'vscode';
import '../extensions';
import { IInterpreterService } from '../../interpreter/contracts';
import { IServiceContainer } from '../../ioc/types';
import { EnvironmentType, PythonEnvironment } from '../../pythonEnvironments/info';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { IApplicationShell, IWorkspaceService } from '../application/types';
import { STANDARD_OUTPUT_CHANNEL } from '../constants';
import { traceError, traceInfo } from '../logger';
import { IPlatformService } from '../platform/types';
import { IProcessServiceFactory, IPythonExecutionFactory } from '../process/types';
import { ITerminalServiceFactory } from '../terminal/types';
import {
    IConfigurationService,
    IInstaller,
    InstallerResponse,
    IOutputChannel,
    ProductInstallStatus,
    ModuleNamePurpose,
    Product,
    ProductType,
} from '../types';
import { Installer } from '../utils/localize';
import { isResource, noop } from '../utils/misc';
import { translateProductToModule } from './moduleInstaller';
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
        isUpgrade?: boolean,
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
            .installModule(product, resource, cancel, isUpgrade)
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
class TestFrameworkInstaller extends BaseInstaller {
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

class RefactoringLibraryInstaller extends BaseInstaller {
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

class DataScienceInstaller extends BaseInstaller {
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
        const moduleName = translateProductToModule(product, ModuleNamePurpose.install);
        let installerModule: IModuleInstaller | undefined;
        const isAvailableThroughConda = !UnsupportedChannelsForProduct.get(product)?.has(EnvironmentType.Conda);
        if (interpreter.envType === EnvironmentType.Conda && isAvailableThroughConda) {
            installerModule = channels.find((v) => v.name === EnvironmentType.Conda);
        } else if (interpreter.envType === EnvironmentType.Conda && !isAvailableThroughConda) {
            // This case is temporary and can be removed when https://github.com/microsoft/vscode-jupyter/issues/5034 is unblocked
            traceInfo(
                `Interpreter type is conda but package ${moduleName} is not available through conda, using pip instead.`,
            );
            installerModule = channels.find((v) => v.name === 'Pip');
        } else {
            installerModule = channels.find((v) => v.name === 'Pip');
        }

        if (!installerModule) {
            this.appShell.showErrorMessage(Installer.couldNotInstallLibrary().format(moduleName)).then(noop, noop);
            sendTelemetryEvent(EventName.PYTHON_INSTALL_PACKAGE, undefined, {
                installer: 'unavailable',
                productName: ProductNames.get(product),
            });
            return InstallerResponse.Ignore;
        }

        await installerModule
            .installModule(product, interpreter, cancel, isUpgrade)
            .catch((ex) => traceError(`Error in installing the module '${moduleName}', ${ex}`));

        return this.isInstalled(product, interpreter).then((isInstalled) => {
            sendTelemetryEvent(EventName.PYTHON_INSTALL_PACKAGE, undefined, {
                installer: installerModule?.displayName || '',
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

    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IOutputChannel) @named(STANDARD_OUTPUT_CHANNEL) private outputChannel: OutputChannel,
    ) {
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
        isUpgrade?: boolean,
    ): Promise<InstallerResponse> {
        return this.createInstaller(product).install(product, resource, cancel, isUpgrade);
    }

    public async isInstalled(product: Product, resource?: InterpreterUri): Promise<boolean> {
        return this.createInstaller(product).isInstalled(product, resource);
    }

    // eslint-disable-next-line class-methods-use-this
    public translateProductToModuleName(product: Product, purpose: ModuleNamePurpose): string {
        return translateProductToModule(product, purpose);
    }

    private createInstaller(product: Product): BaseInstaller {
        const productType = this.productService.getProductType(product);
        switch (productType) {
            case ProductType.Formatter:
                return new FormatterInstaller(this.serviceContainer, this.outputChannel);
            case ProductType.WorkspaceSymbols:
                return new CTagsInstaller(this.serviceContainer, this.outputChannel);
            case ProductType.TestFramework:
                return new TestFrameworkInstaller(this.serviceContainer, this.outputChannel);
            case ProductType.RefactoringLibrary:
                return new RefactoringLibraryInstaller(this.serviceContainer, this.outputChannel);
            case ProductType.DataScience:
                return new DataScienceInstaller(this.serviceContainer, this.outputChannel);
            default:
                break;
        }
        throw new Error(`Unknown product ${product}`);
    }
}
