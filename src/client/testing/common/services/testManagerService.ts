import { Disposable, Uri } from 'vscode';
import { IConfigurationService, IDisposableRegistry, Product } from '../../../common/types';
import { IServiceContainer } from '../../../ioc/types';
import { ITestManager, ITestManagerFactory, ITestManagerService, ITestsHelper, UnitTestProduct } from './../types';

export class TestManagerService implements ITestManagerService {
    private cachedTestManagers = new Map<Product, ITestManager>();
    private readonly configurationService: IConfigurationService;
    constructor(private wkspace: Uri, private testsHelper: ITestsHelper, private serviceContainer: IServiceContainer) {
        const disposables = serviceContainer.get<Disposable[]>(IDisposableRegistry);
        this.configurationService = serviceContainer.get<IConfigurationService>(IConfigurationService);
        disposables.push(this);
    }
    public dispose() {
        this.cachedTestManagers.forEach((info) => {
            info.dispose();
        });
    }
    public getTestManager(): ITestManager | undefined {
        const preferredTestManager = this.getPreferredTestManager();
        if (typeof preferredTestManager !== 'number') {
            return;
        }

        if (!this.cachedTestManagers.has(preferredTestManager)) {
            const testDirectory = this.getTestWorkingDirectory();
            const testProvider = this.testsHelper.parseProviderName(preferredTestManager);
            const factory = this.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
            this.cachedTestManagers.set(preferredTestManager, factory(testProvider, this.wkspace, testDirectory));
        }
        const testManager = this.cachedTestManagers.get(preferredTestManager)!;
        return testManager.enabled ? testManager : undefined;
    }
    public getTestWorkingDirectory() {
        const settings = this.configurationService.getSettings(this.wkspace);
        return settings.testing.cwd && settings.testing.cwd.length > 0 ? settings.testing.cwd : this.wkspace.fsPath;
    }
    public getPreferredTestManager(): UnitTestProduct | undefined {
        const settings = this.configurationService.getSettings(this.wkspace);
        if (settings.testing.nosetestsEnabled) {
            return Product.nosetest;
        } else if (settings.testing.pytestEnabled) {
            return Product.pytest;
        } else if (settings.testing.unittestEnabled) {
            return Product.unittest;
        }
        return undefined;
    }
}
