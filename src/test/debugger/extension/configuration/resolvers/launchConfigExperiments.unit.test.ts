// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
// tslint:disable-next-line: match-default-export-name
import rewiremock from 'rewiremock';
import { instance, mock, spy, when } from 'ts-mockito';
import { ApplicationEnvironment } from '../../../../../client/common/application/applicationEnvironment';
import { WorkspaceService } from '../../../../../client/common/application/workspace';
import { ConfigurationService } from '../../../../../client/common/configuration/service';
import { CryptoUtils } from '../../../../../client/common/crypto';
import { DebugAdapterNewPtvsd, WebAppReload } from '../../../../../client/common/experimentGroups';
import { ExperimentsManager } from '../../../../../client/common/experiments';
import { HttpClient } from '../../../../../client/common/net/httpClient';
import { PersistentStateFactory } from '../../../../../client/common/persistentState';
import { FileSystem } from '../../../../../client/common/platform/fileSystem';
import { IPythonSettings } from '../../../../../client/common/types';
import { DebuggerTypeName } from '../../../../../client/debugger/constants';
import { LaunchDebugConfigurationExperiment } from '../../../../../client/debugger/extension/configuration/resolvers/launchConfigExperiment';
import { ILaunchDebugConfigurationResolverExperiment } from '../../../../../client/debugger/extension/configuration/types';
import { LaunchRequestArguments } from '../../../../../client/debugger/types';
import { clearTelemetryReporter } from '../../../../../client/telemetry';
import { EventName } from '../../../../../client/telemetry/constants';
import { MockOutputChannel } from '../../../../mockClasses';

// tslint:disable-next-line: max-func-body-length
suite('Debugging - Config Resolver Launch Experiments', () => {
    const oldValueOfVSC_PYTHON_UNIT_TEST = process.env.VSC_PYTHON_UNIT_TEST;
    const oldValueOfVSC_PYTHON_CI_TEST = process.env.VSC_PYTHON_CI_TEST;
    let experimentsManager: ExperimentsManager;
    let spiedExperimentsMgr: ExperimentsManager;
    let resolverExperiment: ILaunchDebugConfigurationResolverExperiment;

    class Reporter {
        public static eventNames: string[] = [];
        public static properties: Record<string, string>[] = [];
        public static measures: {}[] = [];
        public sendTelemetryEvent(eventName: string, properties?: {}, measures?: {}) {
            Reporter.eventNames.push(eventName);
            Reporter.properties.push(properties!);
            Reporter.measures.push(measures!);
        }
    }

    class TestConfiguration {
        public newDebuggerExperiment: string = '';
        public reloadExperiment: string = '';
        public subProcess?: boolean;
        public args: string[] = [];
        public framework: string = '';
        public withoutReloadArgs: string[] = [];
        public withReloadArgs: string[] = [];
    }

    setup(() => {
        process.env.VSC_PYTHON_UNIT_TEST = undefined;
        process.env.VSC_PYTHON_CI_TEST = undefined;
        rewiremock.enable();
        rewiremock('vscode-extension-telemetry').with({ default: Reporter });

        const workspaceService = mock(WorkspaceService);
        const httpClient = mock(HttpClient);
        const crypto = mock(CryptoUtils);
        const appEnvironment = mock(ApplicationEnvironment);
        const persistentStateFactory = mock(PersistentStateFactory);
        const output = mock(MockOutputChannel);
        const configurationService = mock(ConfigurationService);
        const fs = mock(FileSystem);

        when(configurationService.getSettings(undefined)).thenReturn(({
            experiments: { enabled: true },
            // tslint:disable-next-line: no-any
        } as any) as IPythonSettings);
        experimentsManager = new ExperimentsManager(
            instance(persistentStateFactory),
            instance(workspaceService),
            instance(httpClient),
            instance(crypto),
            instance(appEnvironment),
            instance(output),
            instance(fs),
            instance(configurationService)
        );
        spiedExperimentsMgr = spy(experimentsManager);

        resolverExperiment = new LaunchDebugConfigurationExperiment(experimentsManager);
    });

    teardown(() => {
        process.env.VSC_PYTHON_UNIT_TEST = oldValueOfVSC_PYTHON_UNIT_TEST;
        process.env.VSC_PYTHON_CI_TEST = oldValueOfVSC_PYTHON_CI_TEST;
        Reporter.properties = [];
        Reporter.eventNames = [];
        Reporter.measures = [];
        rewiremock.disable();
        clearTelemetryReporter();
    });

    const newDebuggerExperiment = ['experiment', 'control'];
    const reloadExperiment = ['experiment', 'control'];
    const noReloadSwitches = ['--no-reload', '--noreload'];
    const subProcessValues = [undefined, false, true];
    const webFramework = ['django', 'flask', 'jinja', 'pyramid', 'not-web-framework'];

    function getExperimentsData(testConfig: TestConfiguration) {
        return [
            {
                name:
                    testConfig.newDebuggerExperiment === 'experiment'
                        ? DebugAdapterNewPtvsd.experiment
                        : DebugAdapterNewPtvsd.control,
                salt: 'DebugAdapterDescriptorFactory',
                min: 0,
                max: 0,
            },
            {
                name: testConfig.reloadExperiment === 'experiment' ? WebAppReload.experiment : WebAppReload.control,
                salt: 'DebugAdapterDescriptorFactory',
                min: 0,
                max: 0,
            },
        ];
    }

    function createTestConfigurations() {
        const testConfigs: TestConfiguration[] = [];
        newDebuggerExperiment.forEach((newDbgExp) => {
            reloadExperiment.forEach((reloadExp) => {
                subProcessValues.forEach((subProcessValue) => {
                    noReloadSwitches.forEach((noReloadSwitch) => {
                        webFramework.forEach((framework) => {
                            const usingReloadSwitch = ['run', noReloadSwitch, '--other-switch'];
                            const withoutUsingReloadSwitch = ['run', '--other-switch'];
                            [usingReloadSwitch, withoutUsingReloadSwitch].forEach((args) => {
                                testConfigs.push({
                                    newDebuggerExperiment: newDbgExp,
                                    reloadExperiment: reloadExp,
                                    subProcess: subProcessValue,
                                    args: args,
                                    framework: framework,
                                    withoutReloadArgs: ['run', '--other-switch'],
                                    withReloadArgs: ['run', noReloadSwitch, '--other-switch'],
                                });
                            });
                        });
                    });
                });
            });
        });
        return testConfigs;
    }

    function runTest(testConfig: TestConfiguration) {
        // Figure out if we need to expect modification to the debug config. Debug config should be modified
        // only if the user is in debug adapter descriptor experiment, new ptvsd experiment, the reload experiment
        // and finally one of the following web app frameworks (django, flask, pyramid, jinja)
        const inExperiment =
            testConfig.newDebuggerExperiment === 'experiment' && testConfig.reloadExperiment === 'experiment';
        const knownWebFramework = ['django', 'flask', 'jinja', 'pyramid'].includes(testConfig.framework);

        // Args should only be modified if they meet the 'modification' conditions above AND they have a reload argument
        const argsModified =
            inExperiment &&
            knownWebFramework &&
            (testConfig.args.includes('--no-reload') || testConfig.args.includes('--noreload'));
        // SubProcess field should only be modified if they meet the 'modification' conditions above AND subProcess is not set.
        const subProcModified = inExperiment && knownWebFramework && !testConfig.subProcess;

        // Text used for the generated test title.
        const textModify = argsModified || subProcModified ? 'modifying' : 'skip modifying';
        const textExperiment = inExperiment ? 'in' : 'NOT in';
        const textSubProc = subProcModified ? 'subProcess modified' : 'subProcess NOT modified';
        const textArgs = argsModified ? 'args modified' : 'args NOT modified';
        const testTitle = `Test ${textModify} debug config when ${textExperiment} reload experiment for ${testConfig.framework}, with ${textSubProc}, and with ${textArgs}`;

        test(testTitle, () => {
            when(spiedExperimentsMgr.userExperiments).thenReturn(getExperimentsData(testConfig));

            const config: LaunchRequestArguments = {
                pythonPath: '',
                request: 'launch',
                args: testConfig.args,
                name: '',
                envFile: '',
                type: DebuggerTypeName,
                subProcess: testConfig.subProcess,
            };
            const expectedConfig: LaunchRequestArguments = {
                pythonPath: '',
                request: 'launch',
                args: argsModified ? testConfig.withoutReloadArgs : testConfig.args,
                name: '',
                envFile: '',
                type: DebuggerTypeName,
                subProcess: subProcModified ? true : testConfig.subProcess,
            };

            // Add web framework flag to configuration
            // e.g., config.django = true
            if (testConfig.framework !== 'not-web-framework') {
                config[testConfig.framework] = true;
                expectedConfig[testConfig.framework] = true;
            }

            const expectedEvents: string[] = [];
            const expectedProperties: object[] = [];
            if (testConfig.newDebuggerExperiment === 'experiment') {
                expectedEvents.push(EventName.PYTHON_EXPERIMENTS);
                expectedProperties.push({ expName: DebugAdapterNewPtvsd.experiment });

                if (testConfig.reloadExperiment === 'experiment') {
                    expectedEvents.push(EventName.PYTHON_EXPERIMENTS);
                    expectedProperties.push({ expName: WebAppReload.experiment });

                    if (['django', 'flask', 'jinja', 'pyramid'].includes(testConfig.framework)) {
                        expectedEvents.push(EventName.PYTHON_WEB_APP_RELOAD);
                        expectedProperties.push({
                            subProcessModified: `${subProcModified}`,
                            argsModified: `${argsModified}`,
                        });
                    } else {
                        // Don't add any event
                    }
                } else {
                    expectedEvents.push(EventName.PYTHON_EXPERIMENTS);
                    expectedProperties.push({ expName: WebAppReload.control });
                }
            }

            resolverExperiment.modifyConfigurationBasedOnExperiment(config);

            assert.deepEqual(config, expectedConfig);
            assert.deepEqual(Reporter.eventNames, expectedEvents);
            assert.deepEqual(Reporter.properties, expectedProperties);
        });
    }

    createTestConfigurations().forEach(runTest);
});
