// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import rewiremock from 'rewiremock';
import * as TypeMoq from 'typemoq';
import { IExperimentsManager } from '../../../../../client/common/types';
import { DebuggerTypeName } from '../../../../../client/debugger/constants';
import { LaunchDebugConfigurationExperiment } from '../../../../../client/debugger/extension/configuration/resolvers/launchConfigExperiment';
import { ILaunchDebugConfigurationResolverExperiment } from '../../../../../client/debugger/extension/configuration/types';
import { LaunchRequestArguments } from '../../../../../client/debugger/types';
import { clearTelemetryReporter } from '../../../../../client/telemetry';

// tslint:disable-next-line: max-func-body-length
suite('Debugging - Config Resolver Launch Experiments', () => {
    const oldValueOfVSC_PYTHON_UNIT_TEST = process.env.VSC_PYTHON_UNIT_TEST;
    const oldValueOfVSC_PYTHON_CI_TEST = process.env.VSC_PYTHON_CI_TEST;
    let experimentManager: TypeMoq.IMock<IExperimentsManager>;
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

    setup(() => {
        experimentManager = TypeMoq.Mock.ofType<IExperimentsManager>();

        process.env.VSC_PYTHON_UNIT_TEST = undefined;
        process.env.VSC_PYTHON_CI_TEST = undefined;
        rewiremock.enable();
        rewiremock('vscode-extension-telemetry').with({ default: Reporter });

        resolverExperiment = new LaunchDebugConfigurationExperiment(experimentManager.object);
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

    const descriptorExperiment = ['experiment', 'control'];
    const newDebuggerExperiment = ['experiment', 'control'];
    const reloadExperiment = ['experiment', 'control'];
    const noReloadSwitches = ['--no-reload', '--noreload'];
    const subProcessValues = [undefined, false, true];
    const webFramework = ['django', 'flask', 'jinja', 'pyramid', 'not-web-framework'];

    // tslint:disable-next-line: no-any
    function runTest(testConfig: any) {
        test(`Test modifying debug config for reload experiment`, () => {
            // run tests here
            const config: LaunchRequestArguments = {
                pythonPath: '',
                request: 'launch',
                args: testConfig.args,
                name: '',
                envFile: '',
                type: DebuggerTypeName
            };
            resolverExperiment.setExperimentConfiguration(config);
        });
    }
    descriptorExperiment.forEach(descExp => {
        newDebuggerExperiment.forEach(newDbgExp => {
            reloadExperiment.forEach(reloadExp => {
                subProcessValues.forEach(subProcessValue => {
                    noReloadSwitches.forEach(noReloadSwitch => {
                        webFramework.forEach(framework => {
                            [
                                {
                                    descriptorExperiment: descExp,
                                    newDebuggerExperiment: newDbgExp,
                                    reloadExperiment: reloadExp,
                                    subProcess: subProcessValue,
                                    args: ['run', noReloadSwitch, '--other-switch'],
                                    framework: framework,
                                    withoutReloadArgs: ['run', '--other-switch'],
                                    withReloadArgs: ['run', noReloadSwitch, '--other-switch']
                                },
                                {
                                    descriptorExperiment: descExp,
                                    newDebuggerExperiment: newDbgExp,
                                    reloadExperiment: reloadExp,
                                    subProcess: subProcessValue,
                                    args: ['run', '--other-switch'],
                                    framework: framework,
                                    withoutReloadArgs: ['run', '--other-switch'],
                                    withReloadArgs: ['run', noReloadSwitch, '--other-switch']
                                }
                            ].forEach(runTest);
                        });
                    });
                });
            });
        });
    });
});
