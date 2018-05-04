import { inject, injectable, named } from 'inversify';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { IFormatterHelper } from '../../formatters/types';
import { IServiceContainer } from '../../ioc/types';
import { ILinterManager } from '../../linters/types';
import { ITestsHelper } from '../../unittests/common/types';
import { IApplicationShell } from '../application/types';
import { STANDARD_OUTPUT_CHANNEL } from '../constants';
import { IPlatformService } from '../platform/types';
import { IProcessService, IPythonExecutionFactory } from '../process/types';
import { ITerminalServiceFactory } from '../terminal/types';
import { IConfigurationService, IInstaller, ILogger, InstallerResponse, IOutputChannel, ModuleNamePurpose, Product } from '../types';
import { ProductNames } from './productNames';
import { IInstallationChannelManager } from './types';

export { Product } from '../types';

const CTagsInsllationScript = os.platform() === 'darwin' ? 'brew install ctags' : 'sudo apt-get install exuberant-ctags';

enum ProductType {
    Linter,
    Formatter,
    TestFramework,
    RefactoringLibrary,
    WorkspaceSymbols
}

// tslint:disable-next-line:max-classes-per-file
abstract class BaseInstaller {
    protected appShell: IApplicationShell;
    protected configService: IConfigurationService;

    constructor(protected serviceContainer: IServiceContainer, protected outputChannel: vscode.OutputChannel) {
        this.appShell = serviceContainer.get<IApplicationShell>(IApplicationShell);
        this.configService = serviceContainer.get<IConfigurationService>(IConfigurationService);
    }

    public abstract promptToInstall(product: Product, resource?: vscode.Uri): Promise<InstallerResponse>;

    public async install(product: Product, resource?: vscode.Uri): Promise<InstallerResponse> {
        if (product === Product.unittest) {
            return InstallerResponse.Installed;
        }

        const channels = this.serviceContainer.get<IInstallationChannelManager>(IInstallationChannelManager);
        const installer = await channels.getInstallationChannel(product, resource);
        if (!installer) {
            return InstallerResponse.Ignore;
        }

        const moduleName = translateProductToModule(product, ModuleNamePurpose.install);
        const logger = this.serviceContainer.get<ILogger>(ILogger);
        await installer.installModule(moduleName, resource)
            .catch(logger.logError.bind(logger, `Error in installing the module '${moduleName}'`));

        return this.isInstalled(product)
            .then(isInstalled => isInstalled ? InstallerResponse.Installed : InstallerResponse.Ignore);
    }

    public async isInstalled(product: Product, resource?: vscode.Uri): Promise<boolean | undefined> {
        if (product === Product.unittest) {
            return true;
        }
        let moduleName: string | undefined;
        try {
            moduleName = translateProductToModule(product, ModuleNamePurpose.run);
            // tslint:disable-next-line:no-empty
        } catch { }

        // User may have customized the module name or provided the fully qualifieid path.
        const executableName = this.getExecutableNameFromSettings(product, resource);

        const isModule = typeof moduleName === 'string' && moduleName.length > 0 && path.basename(executableName) === executableName;
        if (isModule) {
            const pythonProcess = await this.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory).create(resource);
            return pythonProcess.isModuleInstalled(executableName);
        } else {
            const process = this.serviceContainer.get<IProcessService>(IProcessService);
            return process.exec(executableName, ['--version'], { mergeStdOutErr: true })
                .then(() => true)
                .catch(() => false);
        }
    }

    protected getExecutableNameFromSettings(product: Product, resource?: vscode.Uri): string {
        throw new Error('getExecutableNameFromSettings is not supported on this object');
    }
}

class CTagsInstaller extends BaseInstaller {
    constructor(serviceContainer: IServiceContainer, outputChannel: vscode.OutputChannel) {
        super(serviceContainer, outputChannel);
    }

    public async promptToInstall(product: Product, resource?: vscode.Uri): Promise<InstallerResponse> {
        const item = await this.appShell.showErrorMessage('Install CTags to enable Python workspace symbols?', 'Yes', 'No');
        return item === 'Yes' ? this.install(product, resource) : InstallerResponse.Ignore;
    }

    public async install(product: Product, resource?: vscode.Uri): Promise<InstallerResponse> {
        if (this.serviceContainer.get<IPlatformService>(IPlatformService).isWindows) {
            this.outputChannel.appendLine('Install Universal Ctags Win32 to enable support for Workspace Symbols');
            this.outputChannel.appendLine('Download the CTags binary from the Universal CTags site.');
            this.outputChannel.appendLine('Option 1: Extract ctags.exe from the downloaded zip to any folder within your PATH so that Visual Studio Code can run it.');
            this.outputChannel.appendLine('Option 2: Extract to any folder and add the path to this folder to the command setting.');
            this.outputChannel.appendLine('Option 3: Extract to any folder and define that path in the python.workspaceSymbols.ctagsPath setting of your user settings file (settings.json).');
            this.outputChannel.show();
        } else {
            const terminalService = this.serviceContainer.get<ITerminalServiceFactory>(ITerminalServiceFactory).getTerminalService();
            const logger = this.serviceContainer.get<ILogger>(ILogger);
            terminalService.sendCommand(CTagsInsllationScript, [])
                .catch(logger.logError.bind(logger, `Failed to install ctags. Script sent '${CTagsInsllationScript}'.`));
        }
        return InstallerResponse.Ignore;
    }

    protected getExecutableNameFromSettings(product: Product, resource?: vscode.Uri): string {
        const settings = this.configService.getSettings(resource);
        return settings.workspaceSymbols.ctagsPath;
    }
}

class FormatterInstaller extends BaseInstaller {
    public async promptToInstall(product: Product, resource?: vscode.Uri): Promise<InstallerResponse> {
        // Hard-coded on purpose because the UI won't necessarily work having
        // another formatter.
        const formatters = [Product.autopep8, Product.black, Product.yapf];
        const formatterNames = formatters.map((formatter) => ProductNames.get(formatter)!);
        const productName = ProductNames.get(product)!;
        formatterNames.splice(formatterNames.indexOf(productName), 1);
        const useOptions = formatterNames.map((name) => `Use ${name}`);
        const yesChoice = 'Yes';

        const item = await this.appShell.showErrorMessage(`Formatter ${productName} is not installed. Install?`, yesChoice, ...useOptions);
        if (item === yesChoice) {
            return this.install(product, resource);
        } else if (typeof item === 'string') {
            for (const formatter of formatters) {
                const formatterName = ProductNames.get(formatter)!;

                if (item.endsWith(formatterName)) {
                    await this.configService.updateSettingAsync('formatting.provider', formatterName, resource);
                    return this.install(formatter, resource);
                }
            }
        }

        return InstallerResponse.Ignore;
    }

    protected getExecutableNameFromSettings(product: Product, resource?: vscode.Uri): string {
        const settings = this.configService.getSettings(resource);
        const formatHelper = this.serviceContainer.get<IFormatterHelper>(IFormatterHelper);
        const settingsPropNames = formatHelper.getSettingsPropertyNames(product);
        return settings.formatting[settingsPropNames.pathName] as string;
    }
}

// tslint:disable-next-line:max-classes-per-file
class LinterInstaller extends BaseInstaller {
    public async promptToInstall(product: Product, resource?: vscode.Uri): Promise<InstallerResponse> {
        const productName = ProductNames.get(product)!;
        const install = 'Install';
        const disableAllLinting = 'Disable linting';
        const disableThisLinter = `Disable ${productName}`;

        const response = await this.appShell
            .showErrorMessage(`Linter ${productName} is not installed.`, install, disableThisLinter, disableAllLinting);
        if (response === install) {
            return this.install(product, resource);
        }
        const lm = this.serviceContainer.get<ILinterManager>(ILinterManager);
        if (response === disableAllLinting) {
            await lm.enableLintingAsync(false);
            return InstallerResponse.Disabled;
        } else if (response === disableThisLinter) {
            await lm.getLinterInfo(product).enableAsync(false);
            return InstallerResponse.Disabled;
        }
        return InstallerResponse.Ignore;
    }
    protected getExecutableNameFromSettings(product: Product, resource?: vscode.Uri): string {
        const linterManager = this.serviceContainer.get<ILinterManager>(ILinterManager);
        return linterManager.getLinterInfo(product).pathName(resource);
    }
}

// tslint:disable-next-line:max-classes-per-file
class TestFrameworkInstaller extends BaseInstaller {
    public async promptToInstall(product: Product, resource?: vscode.Uri): Promise<InstallerResponse> {
        const productName = ProductNames.get(product)!;
        const item = await this.appShell.showErrorMessage(`Test framework ${productName} is not installed. Install?`, 'Yes', 'No');
        return item === 'Yes' ? this.install(product, resource) : InstallerResponse.Ignore;
    }

    protected getExecutableNameFromSettings(product: Product, resource?: vscode.Uri): string {
        const testHelper = this.serviceContainer.get<ITestsHelper>(ITestsHelper);
        const settingsPropNames = testHelper.getSettingsPropertyNames(product);
        if (!settingsPropNames.pathName) {
            // E.g. in the case of UnitTests we don't allow customizing the paths.
            return translateProductToModule(product, ModuleNamePurpose.run);
        }
        const settings = this.configService.getSettings(resource);
        return settings.unitTest[settingsPropNames.pathName] as string;
    }
}

// tslint:disable-next-line:max-classes-per-file
class RefactoringLibraryInstaller extends BaseInstaller {
    public async promptToInstall(product: Product, resource?: vscode.Uri): Promise<InstallerResponse> {
        const productName = ProductNames.get(product)!;
        const item = await this.appShell.showErrorMessage(`Refactoring library ${productName} is not installed. Install?`, 'Yes', 'No');
        return item === 'Yes' ? this.install(product, resource) : InstallerResponse.Ignore;
    }
    protected getExecutableNameFromSettings(product: Product, resource?: vscode.Uri): string {
        return translateProductToModule(product, ModuleNamePurpose.run);
    }
}

// tslint:disable-next-line:max-classes-per-file
@injectable()
export class ProductInstaller implements IInstaller {
    private ProductTypes = new Map<Product, ProductType>();

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IOutputChannel) @named(STANDARD_OUTPUT_CHANNEL) private outputChannel: vscode.OutputChannel) {
        this.ProductTypes.set(Product.flake8, ProductType.Linter);
        this.ProductTypes.set(Product.mypy, ProductType.Linter);
        this.ProductTypes.set(Product.pep8, ProductType.Linter);
        this.ProductTypes.set(Product.prospector, ProductType.Linter);
        this.ProductTypes.set(Product.pydocstyle, ProductType.Linter);
        this.ProductTypes.set(Product.pylama, ProductType.Linter);
        this.ProductTypes.set(Product.pylint, ProductType.Linter);
        this.ProductTypes.set(Product.ctags, ProductType.WorkspaceSymbols);
        this.ProductTypes.set(Product.nosetest, ProductType.TestFramework);
        this.ProductTypes.set(Product.pytest, ProductType.TestFramework);
        this.ProductTypes.set(Product.unittest, ProductType.TestFramework);
        this.ProductTypes.set(Product.autopep8, ProductType.Formatter);
        this.ProductTypes.set(Product.black, ProductType.Formatter);
        this.ProductTypes.set(Product.yapf, ProductType.Formatter);
        this.ProductTypes.set(Product.rope, ProductType.RefactoringLibrary);
    }

    // tslint:disable-next-line:no-empty
    public dispose() { }
    public async promptToInstall(product: Product, resource?: vscode.Uri): Promise<InstallerResponse> {
        return this.createInstaller(product).promptToInstall(product, resource);
    }
    public async install(product: Product, resource?: vscode.Uri): Promise<InstallerResponse> {
        return this.createInstaller(product).install(product, resource);
    }
    public async isInstalled(product: Product, resource?: vscode.Uri): Promise<boolean | undefined> {
        return this.createInstaller(product).isInstalled(product, resource);
    }
    public translateProductToModuleName(product: Product, purpose: ModuleNamePurpose): string {
        return translateProductToModule(product, purpose);
    }

    private createInstaller(product: Product): BaseInstaller {
        const productType = this.ProductTypes.get(product)!;
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
            default:
                break;
        }
        throw new Error(`Unknown product ${product}`);
    }
}

function translateProductToModule(product: Product, purpose: ModuleNamePurpose): string {
    switch (product) {
        case Product.mypy: return 'mypy';
        case Product.nosetest: {
            return purpose === ModuleNamePurpose.install ? 'nose' : 'nosetests';
        }
        case Product.pylama: return 'pylama';
        case Product.prospector: return 'prospector';
        case Product.pylint: return 'pylint';
        case Product.pytest: return 'pytest';
        case Product.autopep8: return 'autopep8';
        case Product.black: return 'black';
        case Product.pep8: return 'pep8';
        case Product.pydocstyle: return 'pydocstyle';
        case Product.yapf: return 'yapf';
        case Product.flake8: return 'flake8';
        case Product.unittest: return 'unittest';
        case Product.rope: return 'rope';
        default: {
            throw new Error(`Product ${product} cannot be installed as a Python Module.`);
        }
    }
}
