// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ConfigurationChangeEvent } from 'vscode';
import { IExtensionSingleActivationService } from '../../activation/types';
import { IWorkspaceService } from '../../common/application/types';
import { IDisposableRegistry, Resource } from '../../common/types';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { TestProvider } from '../types';
import { ITestConfigSettingsService, ITestsHelper } from './types';

@injectable()
export class EnablementTracker implements IExtensionSingleActivationService {
    constructor(
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
        @inject(ITestConfigSettingsService) private readonly testConfig: ITestConfigSettingsService,
        @inject(ITestsHelper) private readonly testsHelper: ITestsHelper,
    ) {}
    public async activate(): Promise<void> {
        this.disposables.push(this.workspaceService.onDidChangeConfiguration(this.onDidChangeConfiguration, this));
    }
    public onDidChangeConfiguration(args: ConfigurationChangeEvent) {
        const resourcesToCheck: Resource[] = [undefined];
        if (Array.isArray(this.workspaceService.workspaceFolders)) {
            this.workspaceService.workspaceFolders.forEach((item) => resourcesToCheck.push(item.uri));
        }

        const testProviders: TestProvider[] = ['nosetest', 'pytest', 'unittest'];
        resourcesToCheck.forEach((resource) => {
            const telemetry: Partial<Record<TestProvider, undefined | boolean>> = {};
            testProviders.forEach((item) => {
                const product = this.testsHelper.parseProduct(item);
                const testingSetting = this.testConfig.getTestEnablingSetting(product);
                const settingToCheck = `python.${testingSetting}`;
                // If the setting was modified and if its value is true, then track this.
                if (
                    args.affectsConfiguration(settingToCheck) &&
                    this.workspaceService.getConfiguration('python', resource).get<boolean>(testingSetting, false)
                ) {
                    telemetry[item] = true;
                }
            });
            // If anyone of the items have been enabled, then send telemetry.
            if (telemetry.nosetest || telemetry.pytest || telemetry.unittest) {
                this.sendTelemetry(telemetry);
            }
        });
    }
    public sendTelemetry(telemetry: Partial<Record<TestProvider, undefined | boolean>>) {
        sendTelemetryEvent(EventName.UNITTEST_ENABLED, undefined, telemetry);
    }
}
