import { OutputChannel, Uri } from 'vscode';
import { PythonSettings } from '../../common/configSettings';
import { Product } from '../../common/installer';
import { TestManager as NoseTestManager } from '../nosetest/main';
import { TestManager as PyTestTestManager } from '../pytest/main';
import { TestManager as UnitTestTestManager } from '../unittest/main';
import { BaseTestManager } from './baseTestManager';
import { ITestCollectionStorageService, ITestDebugLauncher, ITestManagerService, ITestResultsService, ITestsHelper, UnitTestProduct } from './types';

type TestManagerInstanceInfo = { instance?: BaseTestManager, create(rootDirectory: string): BaseTestManager };

export class TestManagerService implements ITestManagerService {
    private testManagers = new Map<Product, TestManagerInstanceInfo>();
    constructor(private wkspace: Uri, private outChannel: OutputChannel,
        testCollectionStorage: ITestCollectionStorageService, testResultsService: ITestResultsService,
        testsHelper: ITestsHelper, debugLauncher: ITestDebugLauncher) {
        this.testManagers.set(Product.nosetest, {
            create: (rootDirectory: string) => new NoseTestManager(rootDirectory, this.outChannel, testCollectionStorage, testResultsService, testsHelper, debugLauncher)
        });
        this.testManagers.set(Product.pytest, {
            create: (rootDirectory: string) => new PyTestTestManager(rootDirectory, this.outChannel, testCollectionStorage, testResultsService, testsHelper, debugLauncher)
        });
        this.testManagers.set(Product.unittest, {
            create: (rootDirectory: string) => new UnitTestTestManager(rootDirectory, this.outChannel, testCollectionStorage, testResultsService, testsHelper, debugLauncher)
        });
    }
    public dispose() {
        this.testManagers.forEach(info => {
            if (info.instance) {
                info.instance.dispose();
            }
        });
    }
    public getTestManager(): BaseTestManager | undefined {
        const preferredTestManager = this.getPreferredTestManager();
        if (typeof preferredTestManager !== 'number') {
            return;
        }

        // tslint:disable-next-line:no-non-null-assertion
        const info = this.testManagers.get(preferredTestManager)!;
        if (!info.instance) {
            const testDirectory = this.getTestWorkingDirectory();
            info.instance = info.create(testDirectory);
        }
        return info.instance;
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
