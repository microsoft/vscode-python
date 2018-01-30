import { inject, injectable, named } from 'inversify';
import * as os from 'os';
import * as path from 'path';
import { ConfigurationTarget, QuickPickItem, Uri, window, workspace } from 'vscode';
import * as vscode from 'vscode';
import { IFormatterHelper } from '../../formatters/types';
import { IServiceContainer } from '../../ioc/types';
import { ILinterManager } from '../../linters/types';
import { ITestsHelper } from '../../unittests/common/types';
import { PythonSettings } from '../configSettings';
import { STANDARD_OUTPUT_CHANNEL } from '../constants';
import { IPlatformService } from '../platform/types';
import { IProcessService, IPythonExecutionFactory } from '../process/types';
import { ITerminalServiceFactory } from '../terminal/types';
import { IInstaller, ILogger, InstallerResponse, IOutputChannel, ModuleNamePurpose, Product } from '../types';
import { IModuleInstaller } from './types';

export { Product } from '../types';

const CTagsInsllationScript = os.platform() === 'darwin' ? 'brew install ctags' : 'sudo apt-get install exuberant-ctags';

// tslint:disable-next-line:variable-name
const ProductNames = new Map<Product, string>();
ProductNames.set(Product.autopep8, 'autopep8');
ProductNames.set(Product.flake8, 'flake8');
ProductNames.set(Product.mypy, 'mypy');
ProductNames.set(Product.nosetest, 'nosetest');
ProductNames.set(Product.pep8, 'pep8');
ProductNames.set(Product.pylama, 'pylama');
ProductNames.set(Product.prospector, 'prospector');
ProductNames.set(Product.pydocstyle, 'pydocstyle');
ProductNames.set(Product.pylint, 'pylint');
ProductNames.set(Product.pytest, 'pytest');
ProductNames.set(Product.yapf, 'yapf');
ProductNames.set(Product.rope, 'rope');

// tslint:disable-next-line:variable-name
const ProductInstallationPrompt = new Map<Product, string>();
ProductInstallationPrompt.set(Product.ctags, 'Install CTags to enable Python workspace symbols');

enum ProductType {
    Linter,
    Formatter,
    TestFramework,
    RefactoringLibrary,
    WorkspaceSymbols
}

const ProductTypeNames = new Map<ProductType, string>();
ProductTypeNames.set(ProductType.Formatter, 'Formatter');
ProductTypeNames.set(ProductType.Linter, 'Linter');
ProductTypeNames.set(ProductType.RefactoringLibrary, 'Refactoring library');
ProductTypeNames.set(ProductType.TestFramework, 'Test Framework');
ProductTypeNames.set(ProductType.WorkspaceSymbols, 'Workspace Symbols');

const ProductTypes = new Map<Product, ProductType>();
ProductTypes.set(Product.flake8, ProductType.Linter);
ProductTypes.set(Product.mypy, ProductType.Linter);
ProductTypes.set(Product.pep8, ProductType.Linter);
ProductTypes.set(Product.prospector, ProductType.Linter);
ProductTypes.set(Product.pydocstyle, ProductType.Linter);
ProductTypes.set(Product.pylama, ProductType.Linter);
ProductTypes.set(Product.pylint, ProductType.Linter);
ProductTypes.set(Product.ctags, ProductType.WorkspaceSymbols);
ProductTypes.set(Product.nosetest, ProductType.TestFramework);
ProductTypes.set(Product.pytest, ProductType.TestFramework);
ProductTypes.set(Product.unittest, ProductType.TestFramework);
ProductTypes.set(Product.autopep8, ProductType.Formatter);
ProductTypes.set(Product.yapf, ProductType.Formatter);
ProductTypes.set(Product.rope, ProductType.RefactoringLibrary);

@injectable()
export class Installer implements IInstaller {
    constructor( @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IOutputChannel) @named(STANDARD_OUTPUT_CHANNEL) private outputChannel: vscode.OutputChannel) {
    }
    // tslint:disable-next-line:no-empty
    public dispose() { }
    public async promptToInstall(product: Product, resource?: Uri): Promise<InstallerResponse> {
        const productType = ProductTypes.get(product)!;
        const productTypeName = ProductTypeNames.get(productType)!;
        const productName = ProductNames.get(product)!;

        const installOption = ProductInstallationPrompt.has(product) ? ProductInstallationPrompt.get(product)! : `Install ${productName}`;
        const alternateFormatter = product === Product.autopep8 ? 'yapf' : 'autopep8';
        const useOtherFormatter = `Use '${alternateFormatter}' formatter`;
        const options: string[] = [];
        options.push(installOption);
        if (productType === ProductType.Formatter) {
            options.push(...[useOtherFormatter]);
        }
        const item = await window.showErrorMessage(`${productTypeName} ${productName} is not installed`, ...options);
        if (!item) {
            return InstallerResponse.Ignore;
        }
        switch (item) {
            case installOption: {
                return this.install(product, resource);
            }
            case useOtherFormatter: {
                return this.updateSetting('formatting.provider', alternateFormatter, resource)
                    .then(() => InstallerResponse.Installed);
            }
            default: {
                throw new Error('Invalid selection');
            }
        }
    }
    public translateProductToModuleName(product: Product, purpose: ModuleNamePurpose): string {
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
    public async install(product: Product, resource?: Uri): Promise<InstallerResponse> {
        if (product === Product.unittest) {
            return InstallerResponse.Installed;
        }
        if (product === Product.ctags) {
            return this.installCTags();
        }
        const installer = await this.getInstallationChannel(product, resource);
        if (!installer) {
            return InstallerResponse.Ignore;
        }

        const moduleName = this.translateProductToModuleName(product, ModuleNamePurpose.install);
        const logger = this.serviceContainer.get<ILogger>(ILogger);
        await installer.installModule(moduleName)
            .catch(logger.logError.bind(logger, `Error in installing the module '${moduleName}'`));

        return this.isInstalled(product)
            .then(isInstalled => isInstalled ? InstallerResponse.Installed : InstallerResponse.Ignore);
    }
    public async isInstalled(product: Product, resource?: Uri): Promise<boolean | undefined> {
        if (product === Product.unittest) {
            return true;
        }
        let moduleName: string | undefined;
        try {
            moduleName = this.translateProductToModuleName(product, ModuleNamePurpose.run);
            // tslint:disable-next-line:no-empty
        } catch { }

        // User may have customized the module name or provided the fully qualifieid path.
        const executableName = this.getExecutableNameFromSettings(product, resource);

        const isModule = typeof moduleName === 'string' && moduleName.length > 0 && path.basename(executableName) === executableName;
        // Prospector is an exception, it can be installed as a module, but not run as one.
        if (product !== Product.prospector && isModule) {
            const pythonProcess = await this.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory).create(resource);
            return pythonProcess.isModuleInstalled(executableName);
        } else {
            const process = this.serviceContainer.get<IProcessService>(IProcessService);
            const prospectorPath = PythonSettings.getInstance(resource).linting.prospectorPath;
            return process.exec(prospectorPath, ['--version'], { mergeStdOutErr: true })
                .then(() => true)
                .catch(() => false);
        }
    }
    private installCTags() {
        if (this.serviceContainer.get<IPlatformService>(IPlatformService).isWindows) {
            this.outputChannel.appendLine('Install Universal Ctags Win32 to enable support for Workspace Symbols');
            this.outputChannel.appendLine('Download the CTags binary from the Universal CTags site.');
            this.outputChannel.appendLine('Option 1: Extract ctags.exe from the downloaded zip to any folder within your PATH so that Visual Studio Code can run it.');
            this.outputChannel.appendLine('Option 2: Extract to any folder and add the path to this folder to the command setting.');
            this.outputChannel.appendLine('Option 3: Extract to any folder and define that path in the python.workspaceSymbols.ctagsPath setting of your user settings file (settings.json).');
            this.outputChannel.show();
        } else {
            const terminalServiceFactory = this.serviceContainer.get<ITerminalServiceFactory>(ITerminalServiceFactory);
            const terminalService = terminalServiceFactory.getTerminalService();
            const logger = this.serviceContainer.get<ILogger>(ILogger);
            terminalService.sendCommand(CTagsInsllationScript, [])
                .catch(logger.logError.bind(logger, `Failed to install ctags. Script sent '${CTagsInsllationScript}'.`));
        }
        return InstallerResponse.Ignore;
    }
    private async getInstallationChannel(product: Product, resource?: Uri): Promise<IModuleInstaller | undefined> {
        const productName = ProductNames.get(product)!;
        const channels = await this.getInstallationChannels(resource);
        if (channels.length === 0) {
            window.showInformationMessage(`No installers available to install ${productName}.`);
            return;
        }
        if (channels.length === 1) {
            return channels[0];
        }
        const placeHolder = `Select an option to install ${productName}`;
        const options = channels.map(installer => {
            return {
                label: `Install using ${installer.displayName}`,
                description: '',
                installer
            } as QuickPickItem & { installer: IModuleInstaller };
        });
        const selection = await window.showQuickPick(options, { matchOnDescription: true, matchOnDetail: true, placeHolder });
        return selection ? selection.installer : undefined;
    }
    private async getInstallationChannels(resource?: Uri): Promise<IModuleInstaller[]> {
        const installers = this.serviceContainer.getAll<IModuleInstaller>(IModuleInstaller);
        const supportedInstallers = await Promise.all(installers.map(async installer => installer.isSupported(resource).then(supported => supported ? installer : undefined)));
        return supportedInstallers.filter(installer => installer !== undefined).map(installer => installer!);
    }
    // tslint:disable-next-line:no-any
    private updateSetting(setting: string, value: any, resource?: Uri) {
        if (resource && workspace.getWorkspaceFolder(resource)) {
            const pythonConfig = workspace.getConfiguration('python', resource);
            return pythonConfig.update(setting, value, ConfigurationTarget.Workspace);
        } else {
            const pythonConfig = workspace.getConfiguration('python');
            return pythonConfig.update(setting, value, true);
        }
    }
    private getExecutableNameFromSettings(product: Product, resource?: Uri): string {
        const settings = PythonSettings.getInstance(resource);
        const productType = ProductTypes.get(product)!;
        switch (productType) {
            case ProductType.WorkspaceSymbols: return settings.workspaceSymbols.ctagsPath;
            case ProductType.TestFramework: {
                const testHelper = this.serviceContainer.get<ITestsHelper>(ITestsHelper);
                const settingsPropNames = testHelper.getSettingsPropertyNames(product);
                if (!settingsPropNames.pathName) {
                    // E.g. in the case of UnitTests we don't allow customizing the paths.
                    return this.translateProductToModuleName(product, ModuleNamePurpose.run);
                }
                return settings.unitTest[settingsPropNames.pathName] as string;
            }
            case ProductType.Formatter: {
                const formatHelper = this.serviceContainer.get<IFormatterHelper>(IFormatterHelper);
                const settingsPropNames = formatHelper.getSettingsPropertyNames(product);
                return settings.formatting[settingsPropNames.pathName] as string;
            }
            case ProductType.RefactoringLibrary: return this.translateProductToModuleName(product, ModuleNamePurpose.run);
            case ProductType.Linter: {
                const linterManager = this.serviceContainer.get<ILinterManager>(ILinterManager);
                return linterManager.getLinterInfo(product).pathName(resource);
            }
            default: {
                throw new Error(`Unrecognized Product '${product}'`);
            }
        }
    }
}
