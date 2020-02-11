'use strict';

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IApplicationShell, IWorkspaceService } from '../common/application/types';
import { traceError } from '../common/logger';
import { IConfigurationService, Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { TestConfiguringTelemetry, TestTool } from '../telemetry/types';
import { BufferedTestConfigSettingsService } from './common/services/configSettingService';
import { ITestsHelper, UnitTestProduct } from './common/types';
import {
    ITestConfigSettingsService,
    ITestConfigurationManager,
    ITestConfigurationManagerFactory,
    ITestConfigurationService
} from './types';

@injectable()
export class UnitTestConfigurationService implements ITestConfigurationService {
    private readonly configurationService: IConfigurationService;
    private readonly appShell: IApplicationShell;
    private readonly workspaceService: IWorkspaceService;
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.configurationService = serviceContainer.get<IConfigurationService>(IConfigurationService);
        this.appShell = serviceContainer.get<IApplicationShell>(IApplicationShell);
        this.workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
    }
    public async displayTestFrameworkError(wkspace: Uri): Promise<void> {
        const settings = this.configurationService.getSettings(wkspace);
        let enabledCount = settings.testing.pytestEnabled ? 1 : 0;
        enabledCount += settings.testing.nosetestsEnabled ? 1 : 0;
        enabledCount += settings.testing.unittestEnabled ? 1 : 0;
        if (enabledCount > 1) {
            return this._promptToEnableAndConfigureTestFramework(
                wkspace,
                'Enable only one of the test frameworks (unittest, pytest or nosetest).',
                true
            );
        } else {
            const option = 'Enable and configure a Test Framework';
            const item = await this.appShell.showInformationMessage(
                'No test framework configured (unittest, pytest or nosetest)',
                option
            );
            if (item === option) {
                return this._promptToEnableAndConfigureTestFramework(wkspace);
            }
            return Promise.reject(null);
        }
    }
    public async selectTestRunner(placeHolderMessage: string): Promise<UnitTestProduct | undefined> {
        const items = [
            {
                label: 'unittest',
                product: Product.unittest,
                description: 'Standard Python test framework',
                detail: 'https://docs.python.org/3/library/unittest.html'
            },
            {
                label: 'pytest',
                product: Product.pytest,
                description: 'pytest framework',
                // tslint:disable-next-line:no-http-string
                detail: 'http://docs.pytest.org/'
            },
            {
                label: 'nose',
                product: Product.nosetest,
                description: 'nose framework',
                detail: 'https://nose.readthedocs.io/'
            }
        ];
        const options = {
            ignoreFocusOut: true,
            matchOnDescription: true,
            matchOnDetail: true,
            placeHolder: placeHolderMessage
        };
        const selectedTestRunner = await this.appShell.showQuickPick(items, options);
        // tslint:disable-next-line:prefer-type-cast
        return selectedTestRunner ? (selectedTestRunner.product as UnitTestProduct) : undefined;
    }
    public async enableTest(wkspace: Uri, product: UnitTestProduct): Promise<void> {
        const factory = this.serviceContainer.get<ITestConfigurationManagerFactory>(ITestConfigurationManagerFactory);
        const configMgr = factory.create(wkspace, product);
        return this._enableTest(wkspace, configMgr);
    }

    public async promptToEnableAndConfigureTestFramework(wkspace: Uri) {
        await this._promptToEnableAndConfigureTestFramework(wkspace, undefined, false, 'commandpalette');
    }

    private _enableTest(wkspace: Uri, configMgr: ITestConfigurationManager) {
        const pythonConfig = this.workspaceService.getConfiguration('python', wkspace);
        if (pythonConfig.get<boolean>('testing.promptToConfigure')) {
            return configMgr.enable();
        }
        return pythonConfig.update('testing.promptToConfigure', undefined).then(
            () => {
                return configMgr.enable();
            },
            reason => {
                return configMgr.enable().then(() => Promise.reject(reason));
            }
        );
    }

    private async _promptToEnableAndConfigureTestFramework(
        wkspace: Uri,
        messageToDisplay: string = 'Select a test framework/tool to enable',
        enableOnly: boolean = false,
        trigger: 'ui' | 'commandpalette' = 'ui'
    ) {
        const telemetryProps: TestConfiguringTelemetry = {
            trigger: trigger,
            failed: false
        };
        try {
            const selectedTestRunner = await this.selectTestRunner(messageToDisplay);
            if (typeof selectedTestRunner !== 'number') {
                return Promise.reject(null);
            }
            const helper = this.serviceContainer.get<ITestsHelper>(ITestsHelper);
            telemetryProps.tool = helper.parseProviderName(selectedTestRunner) as TestTool;
            const delayed = new BufferedTestConfigSettingsService();
            const factory = this.serviceContainer.get<ITestConfigurationManagerFactory>(
                ITestConfigurationManagerFactory
            );
            const configMgr = factory.create(wkspace, selectedTestRunner, delayed);
            if (enableOnly) {
                await configMgr.enable();
            } else {
                // Configure everything before enabling.
                // Cuz we don't want the test engine (in main.ts file - tests get discovered when config changes are detected)
                // to start discovering tests when tests haven't been configured properly.
                await configMgr
                    .configure(wkspace)
                    .then(() => this._enableTest(wkspace, configMgr))
                    .catch(reason => {
                        return this._enableTest(wkspace, configMgr).then(() => Promise.reject(reason));
                    });
            }
            const cfg = this.serviceContainer.get<ITestConfigSettingsService>(ITestConfigSettingsService);
            try {
                await delayed.apply(cfg);
            } catch (exc) {
                traceError('Python Extension: applying unit test config updates', exc);
                telemetryProps.failed = true;
            }
        } finally {
            sendTelemetryEvent(EventName.UNITTEST_CONFIGURING, undefined, telemetryProps);
        }
    }
}
