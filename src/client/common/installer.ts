import { inject, injectable, named } from 'inversify';
import * as os from 'os';
import 'reflect-metadata';
import 'reflect-metadata';
import { ConfigurationTarget, Uri, window, workspace } from 'vscode';
import * as vscode from 'vscode';
import * as settings from './configSettings';
import { STANDARD_OUTPUT_CHANNEL } from './constants';
import { isNotInstalledError } from './helpers';
import { IInstaller, InstallerResponse, IOutputChannel, Product } from './types';
import { execPythonFile, getFullyQualifiedPythonInterpreterPath, IS_WINDOWS } from './utils';

export { Product } from './types';

// tslint:disable-next-line:variable-name
const ProductInstallScripts = new Map<Product, string[]>();
ProductInstallScripts.set(Product.autopep8, ['-m', 'pip', 'install', 'autopep8']);
ProductInstallScripts.set(Product.flake8, ['-m', 'pip', 'install', 'flake8']);
ProductInstallScripts.set(Product.mypy, ['-m', 'pip', 'install', 'mypy']);
ProductInstallScripts.set(Product.nosetest, ['-m', 'pip', 'install', 'nose']);
ProductInstallScripts.set(Product.pep8, ['-m', 'pip', 'install', 'pep8']);
ProductInstallScripts.set(Product.pylama, ['-m', 'pip', 'install', 'pylama']);
ProductInstallScripts.set(Product.prospector, ['-m', 'pip', 'install', 'prospector']);
ProductInstallScripts.set(Product.pydocstyle, ['-m', 'pip', 'install', 'pydocstyle']);
ProductInstallScripts.set(Product.pylint, ['-m', 'pip', 'install', 'pylint']);
ProductInstallScripts.set(Product.pytest, ['-m', 'pip', 'install', '-U', 'pytest']);
ProductInstallScripts.set(Product.yapf, ['-m', 'pip', 'install', 'yapf']);
ProductInstallScripts.set(Product.rope, ['-m', 'pip', 'install', 'rope']);

// tslint:disable-next-line:variable-name
const ProductUninstallScripts = new Map<Product, string[]>();
ProductUninstallScripts.set(Product.autopep8, ['-m', 'pip', 'uninstall', 'autopep8', '--yes']);
ProductUninstallScripts.set(Product.flake8, ['-m', 'pip', 'uninstall', 'flake8', '--yes']);
ProductUninstallScripts.set(Product.mypy, ['-m', 'pip', 'uninstall', 'mypy', '--yes']);
ProductUninstallScripts.set(Product.nosetest, ['-m', 'pip', 'uninstall', 'nose', '--yes']);
ProductUninstallScripts.set(Product.pep8, ['-m', 'pip', 'uninstall', 'pep8', '--yes']);
ProductUninstallScripts.set(Product.pylama, ['-m', 'pip', 'uninstall', 'pylama', '--yes']);
ProductUninstallScripts.set(Product.prospector, ['-m', 'pip', 'uninstall', 'prospector', '--yes']);
ProductUninstallScripts.set(Product.pydocstyle, ['-m', 'pip', 'uninstall', 'pydocstyle', '--yes']);
ProductUninstallScripts.set(Product.pylint, ['-m', 'pip', 'uninstall', 'pylint', '--yes']);
ProductUninstallScripts.set(Product.pytest, ['-m', 'pip', 'uninstall', 'pytest', '--yes']);
ProductUninstallScripts.set(Product.yapf, ['-m', 'pip', 'uninstall', 'yapf', '--yes']);
ProductUninstallScripts.set(Product.rope, ['-m', 'pip', 'uninstall', 'rope', '--yes']);

// tslint:disable-next-line:variable-name
export const ProductExecutableAndArgs = new Map<Product, { executable: string, args: string[] }>();
ProductExecutableAndArgs.set(Product.mypy, { executable: 'python', args: ['-m', 'mypy'] });
ProductExecutableAndArgs.set(Product.nosetest, { executable: 'python', args: ['-m', 'nose'] });
ProductExecutableAndArgs.set(Product.pylama, { executable: 'python', args: ['-m', 'pylama'] });
ProductExecutableAndArgs.set(Product.prospector, { executable: 'python', args: ['-m', 'prospector'] });
ProductExecutableAndArgs.set(Product.pylint, { executable: 'python', args: ['-m', 'pylint'] });
ProductExecutableAndArgs.set(Product.pytest, { executable: 'python', args: ['-m', 'pytest'] });
ProductExecutableAndArgs.set(Product.autopep8, { executable: 'python', args: ['-m', 'autopep8'] });
ProductExecutableAndArgs.set(Product.pep8, { executable: 'python', args: ['-m', 'pep8'] });
ProductExecutableAndArgs.set(Product.pydocstyle, { executable: 'python', args: ['-m', 'pydocstyle'] });
ProductExecutableAndArgs.set(Product.yapf, { executable: 'python', args: ['-m', 'yapf'] });
ProductExecutableAndArgs.set(Product.flake8, { executable: 'python', args: ['-m', 'flake8'] });

switch (os.platform()) {
    case 'win32': {
        // Nothing
        break;
    }
    case 'darwin': {
        ProductInstallScripts.set(Product.ctags, ['brew install ctags']);
    }
    default: {
        ProductInstallScripts.set(Product.ctags, ['sudo apt-get install exuberant-ctags']);
    }
}

// tslint:disable-next-line:variable-name
export const Linters: Product[] = [
    Product.flake8,
    Product.pep8,
    Product.pylama,
    Product.prospector,
    Product.pylint,
    Product.mypy,
    Product.pydocstyle
];

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
ProductNames.set(Product.pytest, 'py.test');
ProductNames.set(Product.yapf, 'yapf');
ProductNames.set(Product.rope, 'rope');

// tslint:disable-next-line:variable-name
export const SettingToDisableProduct = new Map<Product, string>();
SettingToDisableProduct.set(Product.flake8, 'linting.flake8Enabled');
SettingToDisableProduct.set(Product.mypy, 'linting.mypyEnabled');
SettingToDisableProduct.set(Product.nosetest, 'unitTest.nosetestsEnabled');
SettingToDisableProduct.set(Product.pep8, 'linting.pep8Enabled');
SettingToDisableProduct.set(Product.pylama, 'linting.pylamaEnabled');
SettingToDisableProduct.set(Product.prospector, 'linting.prospectorEnabled');
SettingToDisableProduct.set(Product.pydocstyle, 'linting.pydocstyleEnabled');
SettingToDisableProduct.set(Product.pylint, 'linting.pylintEnabled');
SettingToDisableProduct.set(Product.pytest, 'unitTest.pyTestEnabled');

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

// tslint:disable-next-line:variable-name
const ProductTypeNames = new Map<ProductType, string>();
ProductTypeNames.set(ProductType.Formatter, 'Formatter');
ProductTypeNames.set(ProductType.Linter, 'Linter');
ProductTypeNames.set(ProductType.RefactoringLibrary, 'Refactoring library');
ProductTypeNames.set(ProductType.TestFramework, 'Test Framework');
ProductTypeNames.set(ProductType.WorkspaceSymbols, 'Workspace Symbols');

// tslint:disable-next-line:variable-name
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

const IS_POWERSHELL = /powershell.exe$/i;

@injectable()
export class Installer implements IInstaller {
    private static terminal: vscode.Terminal | undefined | null;
    private disposables: vscode.Disposable[] = [];
    constructor( @inject(IOutputChannel) @named(STANDARD_OUTPUT_CHANNEL) private outputChannel?: vscode.OutputChannel) {
        this.disposables.push(vscode.window.onDidCloseTerminal(term => {
            if (term === Installer.terminal) {
                Installer.terminal = null;
            }
        }));
    }
    public dispose() {
        this.disposables.forEach(d => d.dispose());
    }
    private shouldDisplayPrompt(product: Product) {
        // tslint:disable-next-line:no-non-null-assertion
        const productName = ProductNames.get(product)!;
        const pythonConfig = workspace.getConfiguration('python');
        // tslint:disable-next-line:prefer-type-cast
        const disablePromptForFeatures = pythonConfig.get('disablePromptForFeatures', [] as string[]);
        return disablePromptForFeatures.indexOf(productName) === -1;
    }

    // tslint:disable-next-line:member-ordering
    public async promptToInstall(product: Product, resource?: Uri): Promise<InstallerResponse> {
        // tslint:disable-next-line:no-non-null-assertion
        const productType = ProductTypes.get(product)!;
        // tslint:disable-next-line:no-non-null-assertion
        const productTypeName = ProductTypeNames.get(productType)!;
        // tslint:disable-next-line:no-non-null-assertion
        const productName = ProductNames.get(product)!;

        if (!this.shouldDisplayPrompt(product)) {
            const message = `${productTypeName} '${productName}' not installed.`;
            if (this.outputChannel) {
                this.outputChannel.appendLine(message);
            } else {
                console.warn(message);
            }
            return InstallerResponse.Ignore;
        }

        // tslint:disable-next-line:no-non-null-assertion
        const installOption = ProductInstallationPrompt.has(product) ? ProductInstallationPrompt.get(product)! : `Install ${productName}`;
        const disableOption = `Disable ${productTypeName}`;
        const dontShowAgain = 'Don\'t show this prompt again';
        const alternateFormatter = product === Product.autopep8 ? 'yapf' : 'autopep8';
        const useOtherFormatter = `Use '${alternateFormatter}' formatter`;
        const options: string[] = [];
        options.push(installOption);
        if (productType === ProductType.Formatter) {
            options.push(...[useOtherFormatter]);
        }
        if (SettingToDisableProduct.has(product)) {
            options.push(...[disableOption, dontShowAgain]);
        }
        const item = await window.showErrorMessage(`${productTypeName} ${productName} is not installed`, ...options);
        if (!item) {
            return InstallerResponse.Ignore;
        }
        switch (item) {
            case installOption: {
                return this.install(product, resource);
            }
            case disableOption: {
                if (Linters.indexOf(product) >= 0) {
                    return this.disableLinter(product, resource).then(() => InstallerResponse.Disabled);
                } else {
                    // tslint:disable-next-line:no-non-null-assertion
                    const settingToDisable = SettingToDisableProduct.get(product)!;
                    return this.updateSetting(settingToDisable, false, resource).then(() => InstallerResponse.Disabled);
                }
            }
            case useOtherFormatter: {
                return this.updateSetting('formatting.provider', alternateFormatter, resource)
                    .then(() => InstallerResponse.Installed);
            }
            case dontShowAgain: {
                const pythonConfig = workspace.getConfiguration('python');
                // tslint:disable-next-line:prefer-type-cast
                const features = pythonConfig.get('disablePromptForFeatures', [] as string[]);
                features.push(productName);
                return pythonConfig.update('disablePromptForFeatures', features, true).then(() => InstallerResponse.Ignore);
            }
            default: {
                throw new Error('Invalid selection');
            }
        }
    }
    // tslint:disable-next-line:member-ordering
    public async install(product: Product, resource?: Uri): Promise<InstallerResponse> {
        if (!this.outputChannel && !Installer.terminal) {
            Installer.terminal = window.createTerminal('Python Installer');
        }

        if (product === Product.ctags && settings.IS_WINDOWS) {
            if (this.outputChannel) {
                this.outputChannel.appendLine('Install Universal Ctags Win32 to enable support for Workspace Symbols');
                this.outputChannel.appendLine('Download the CTags binary from the Universal CTags site.');
                this.outputChannel.appendLine('Option 1: Extract ctags.exe from the downloaded zip to any folder within your PATH so that Visual Studio Code can run it.');
                this.outputChannel.appendLine('Option 2: Extract to any folder and add the path to this folder to the command setting.');
                this.outputChannel.appendLine('Option 3: Extract to any folder and define that path in the python.workspaceSymbols.ctagsPath setting of your user settings file (settings.json).');
                this.outputChannel.show();
            } else {
                window.showInformationMessage('Install Universal Ctags and set it in your path or define the path in your python.workspaceSymbols.ctagsPath settings');
            }
            return InstallerResponse.Ignore;
        }

        // tslint:disable-next-line:no-non-null-assertion
        let installArgs = ProductInstallScripts.get(product)!;
        const pipIndex = installArgs.indexOf('pip');
        if (pipIndex > 0) {
            installArgs = installArgs.slice();
            const proxy = vscode.workspace.getConfiguration('http').get('proxy', '');
            if (proxy.length > 0) {
                installArgs.splice(2, 0, proxy);
                installArgs.splice(2, 0, '--proxy');
            }
        }
        // tslint:disable-next-line:no-any
        let installationPromise: Promise<any>;
        if (this.outputChannel && installArgs[0] === '-m') {
            // Errors are just displayed to the user
            this.outputChannel.show();
            installationPromise = execPythonFile(resource, settings.PythonSettings.getInstance(resource).pythonPath,
                // tslint:disable-next-line:no-non-null-assertion
                installArgs, getCwdForInstallScript(resource), true, (data) => { this.outputChannel!.append(data); });
        } else {
            // When using terminal get the fully qualitified path
            // Cuz people may launch vs code from terminal when they have activated the appropriate virtual env
            // Problem is terminal doesn't use the currently activated virtual env
            // Must have something to do with the process being launched in the terminal
            installationPromise = getFullyQualifiedPythonInterpreterPath(resource)
                .then(pythonPath => {
                    let installScript = installArgs.join(' ');

                    if (installArgs[0] === '-m') {
                        if (pythonPath.indexOf(' ') >= 0) {
                            installScript = `"${pythonPath}" ${installScript}`;
                        } else {
                            installScript = `${pythonPath} ${installScript}`;
                        }
                    }
                    if (this.terminalIsPowershell(resource)) {
                        installScript = `& ${installScript}`;
                    }

                    // tslint:disable-next-line:no-non-null-assertion
                    Installer.terminal!.sendText(installScript);
                    // tslint:disable-next-line:no-non-null-assertion
                    Installer.terminal!.show(false);
                });
        }

        return installationPromise
            .then(async () => this.isInstalled(product))
            .then(isInstalled => isInstalled ? InstallerResponse.Installed : InstallerResponse.Ignore);
    }

    // tslint:disable-next-line:member-ordering
    public async isInstalled(product: Product, resource?: Uri): Promise<boolean | undefined> {
        return isProductInstalled(product, resource);
    }

    // tslint:disable-next-line:member-ordering no-any
    public async uninstall(product: Product, resource?: Uri): Promise<any> {
        return uninstallproduct(product, resource);
    }
    // tslint:disable-next-line:member-ordering
    public async disableLinter(product: Product, resource?: Uri) {
        if (resource && workspace.getWorkspaceFolder(resource)) {
            // tslint:disable-next-line:no-non-null-assertion
            const settingToDisable = SettingToDisableProduct.get(product)!;
            const pythonConfig = workspace.getConfiguration('python', resource);
            const isMultiroot = Array.isArray(workspace.workspaceFolders) && workspace.workspaceFolders.length > 1;
            const configTarget = isMultiroot ? ConfigurationTarget.WorkspaceFolder : ConfigurationTarget.Workspace;
            return pythonConfig.update(settingToDisable, false, configTarget);
        } else {
            const pythonConfig = workspace.getConfiguration('python');
            return pythonConfig.update('linting.enabledWithoutWorkspace', false, true);
        }
    }
    private terminalIsPowershell(resource?: Uri) {
        if (!IS_WINDOWS) {
            return false;
        }
        // tslint:disable-next-line:no-backbone-get-set-outside-model
        const terminal = workspace.getConfiguration('terminal.integrated.shell', resource).get<string>('windows');
        return typeof terminal === 'string' && IS_POWERSHELL.test(terminal);
    }
    // tslint:disable-next-line:no-any
    private updateSetting(setting: string, value: any, resource?: Uri) {
        if (resource && !workspace.getWorkspaceFolder(resource)) {
            const pythonConfig = workspace.getConfiguration('python', resource);
            return pythonConfig.update(setting, value, ConfigurationTarget.Workspace);
        } else {
            const pythonConfig = workspace.getConfiguration('python');
            return pythonConfig.update(setting, value, true);
        }
    }
}

function getCwdForInstallScript(resource?: Uri) {
    const workspaceFolder = resource ? workspace.getWorkspaceFolder(resource) : undefined;
    if (workspaceFolder) {
        return workspaceFolder.uri.fsPath;
    }
    if (Array.isArray(workspace.workspaceFolders) && workspace.workspaceFolders.length > 0) {
        return workspace.workspaceFolders[0].uri.fsPath;
    }
    return __dirname;
}

async function isProductInstalled(product: Product, resource?: Uri): Promise<boolean | undefined> {
    if (!ProductExecutableAndArgs.has(product)) {
        return;
    }
    // tslint:disable-next-line:no-non-null-assertion
    const prodExec = ProductExecutableAndArgs.get(product)!;
    const cwd = getCwdForInstallScript(resource);
    return execPythonFile(resource, prodExec.executable, prodExec.args.concat(['--version']), cwd, false)
        .then(() => true)
        .catch(reason => !isNotInstalledError(reason));
}

// tslint:disable-next-line:no-any
async function uninstallproduct(product: Product, resource?: Uri): Promise<any> {
    if (!ProductUninstallScripts.has(product)) {
        return Promise.resolve();
    }
    // tslint:disable-next-line:no-non-null-assertion
    const uninstallArgs = ProductUninstallScripts.get(product)!;
    return execPythonFile(resource, 'python', uninstallArgs, getCwdForInstallScript(resource), false);
}
