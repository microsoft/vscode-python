'use strict';

import { inject, injectable } from 'inversify';
import { OutputChannel, Uri } from 'vscode';
import { IApplicationShell, IWorkspaceService } from '../common/application/types';
import { IConfigurationService, IInstaller, IOutputChannel, Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { TEST_OUTPUT_CHANNEL } from './common/constants';
import { UnitTestProduct } from './common/types';
import { ITestConfigurationManagerFactory, IUnitTestConfigurationService } from './types';

@injectable()
export class UnitTestConfigurationService implements IUnitTestConfigurationService {
    private readonly configurationService: IConfigurationService;
    private readonly appShell: IApplicationShell;
    private readonly installer: IInstaller;
    private readonly outputChannel: OutputChannel;
    private readonly workspaceService: IWorkspaceService;
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.configurationService = serviceContainer.get<IConfigurationService>(IConfigurationService);
        this.appShell = serviceContainer.get<IApplicationShell>(IApplicationShell);
        this.installer = serviceContainer.get<IInstaller>(IInstaller);
        this.outputChannel = serviceContainer.get<OutputChannel>(IOutputChannel, TEST_OUTPUT_CHANNEL);
        this.workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
    }
    public async displayTestFrameworkError(wkspace: Uri): Promise<void> {
        const settings = this.configurationService.getSettings(wkspace);
        let enabledCount = settings.unitTest.pyTestEnabled ? 1 : 0;
        enabledCount += settings.unitTest.nosetestsEnabled ? 1 : 0;
        enabledCount += settings.unitTest.unittestEnabled ? 1 : 0;
        if (enabledCount > 1) {
            return this.promptToEnableAndConfigureTestFramework(wkspace, this.installer, this.outputChannel, 'Enable only one of the test frameworks (unittest, pytest or nosetest).', true);
        } else {
            const option = 'Enable and configure a Test Framework';
            const item = await this.appShell.showInformationMessage('No test framework configured (unittest, pytest or nosetest)', option);
            if (item === option) {
                return this.promptToEnableAndConfigureTestFramework(wkspace, this.installer, this.outputChannel);
            }
            return Promise.reject(null);
        }
    }
    public async selectTestRunner(placeHolderMessage: string): Promise<UnitTestProduct | undefined> {
        const items = [{
            label: 'unittest',
            product: Product.unittest,
            description: 'Standard Python test framework',
            detail: 'https://docs.python.org/3/library/unittest.html'
        },
        {
            label: 'pytest',
            product: Product.pytest,
            description: 'Can run unittest (including trial) and nose test suites out of the box',
            // tslint:disable-next-line:no-http-string
            detail: 'http://docs.pytest.org/'
        },
        {
            label: 'nose',
            product: Product.nosetest,
            description: 'nose framework',
            detail: 'https://nose.readthedocs.io/'
        }];
        const options = {
            matchOnDescription: true,
            matchOnDetail: true,
            placeHolder: placeHolderMessage
        };
        const selectedTestRunner = await this.appShell.showQuickPick(items, options);
        // tslint:disable-next-line:prefer-type-cast
        return selectedTestRunner ? selectedTestRunner.product as UnitTestProduct : undefined;
    }
    public enableTest(wkspace: Uri, product: UnitTestProduct) {
        const factory = this.serviceContainer.get<ITestConfigurationManagerFactory>(ITestConfigurationManagerFactory);
        const configMgr = factory.create(wkspace, product);
        const pythonConfig = this.workspaceService.getConfiguration('python', wkspace);
        if (pythonConfig.get<boolean>('unitTest.promptToConfigure')) {
            return configMgr.enable();
        }
        return pythonConfig.update('unitTest.promptToConfigure', undefined).then(() => {
            return configMgr.enable();
        }, reason => {
            return configMgr.enable().then(() => Promise.reject(reason));
        });
    }

    private async  promptToEnableAndConfigureTestFramework(wkspace: Uri, installer: IInstaller, outputChannel: OutputChannel, messageToDisplay: string = 'Select a test framework/tool to enable', enableOnly: boolean = false) {
        const selectedTestRunner = await this.selectTestRunner(messageToDisplay);
        if (typeof selectedTestRunner !== 'number') {
            return Promise.reject(null);
        }
        const factory = this.serviceContainer.get<ITestConfigurationManagerFactory>(ITestConfigurationManagerFactory);
        const configMgr = factory.create(wkspace, selectedTestRunner);
        if (enableOnly) {
            // Ensure others are disabled
            [Product.unittest, Product.pytest, Product.nosetest]
                .filter(prod => selectedTestRunner !== prod)
                .forEach(prod => {
                    factory.create(wkspace, prod).disable()
                        .catch(ex => console.error('Python Extension: createTestConfigurationManager.disable', ex));
                });
            return configMgr.enable();
        }

        // Configure everything before enabling.
        // Cuz we don't want the test engine (in main.ts file - tests get discovered when config changes are detected)
        // to start discovering tests when tests haven't been configured properly.
        return configMgr.configure(wkspace)
            .then(() => this.enableTest(wkspace, selectedTestRunner))
            .catch(reason => { return this.enableTest(wkspace, selectedTestRunner).then(() => Promise.reject(reason)); });
    }
}
