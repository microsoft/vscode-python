import { Disposable, Uri } from 'vscode';
import { PythonSettings } from '../../../common/configSettings';
import { Product } from '../../../common/installer';
import { IDiposableRegistry } from '../../../common/types';
import { IServiceContainer } from '../../../ioc/types';
import { ITestManager, ITestManagerFactory, ITestManagerService, ITestsHelper, UnitTestProduct } from './../types';

export class TestManagerService implements ITestManagerService {
    private cachedTestManagers = new Map<Product, ITestManager>();
    constructor(private wkspace: Uri, private testsHelper: ITestsHelper, private serviceContainer: IServiceContainer) {
        const disposables = serviceContainer.get<Disposable[]>(IDiposableRegistry);
        disposables.push(this);
    }
    public dispose() {
        this.cachedTestManagers.forEach(info => {
            info.dispose();
        });
    }
    public getTestManager(): ITestManager | undefined {
        const preferredTestManager = this.getPreferredTestManager();
        if (typeof preferredTestManager !== 'number') {
            return;
        }

        // tslint:disable-next-line:no-non-null-assertion
        const instance = this.cachedTestManagers.get(preferredTestManager);
        if (!instance) {
            const testDirectory = this.getTestWorkingDirectory();
            const testProvider = this.testsHelper.parseProviderName(preferredTestManager);
            const factory = this.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory);
            this.cachedTestManagers.set(preferredTestManager, factory(testProvider, this.wkspace, testDirectory));
        }
        return this.cachedTestManagers.get(preferredTestManager)!;
    }
    public getTestWorkingDirectory() {
        const settings = PythonSettings.getInstance(this.wkspace);
        return settings.unitTest.cwd && settings.unitTest.cwd.length > 0 ? settings.unitTest.cwd : this.wkspace.fsPath;
    }
    public getPreferredTestManager(): UnitTestProduct | undefined {
        const settings = PythonSettings.getInstance(this.wkspace);
        if (settings.unitTest.nosetestsEnabled) {
            return Product.nosetest;
        } else if (settings.unitTest.pyTestEnabled) {
            return Product.pytest;
        } else if (settings.unitTest.unittestEnabled) {
            return Product.unittest;
        }
        return undefined;
    }
}
