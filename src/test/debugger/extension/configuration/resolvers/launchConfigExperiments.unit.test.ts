// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
// tslint:disable-next-line: match-default-export-name
import rewiremock from 'rewiremock';
import * as TypeMoq from 'typemoq';
import { DebugAdapterDescriptorFactory, DebugAdapterNewPtvsd, WebAppReload } from '../../../../../client/common/experimentGroups';
import { IExperimentsManager } from '../../../../../client/common/types';
import { DebuggerTypeName } from '../../../../../client/debugger/constants';
import { LaunchDebugConfigurationExperiment } from '../../../../../client/debugger/extension/configuration/resolvers/launchConfigExperiment';
import { ILaunchDebugConfigurationResolverExperiment } from '../../../../../client/debugger/extension/configuration/types';
import { LaunchRequestArguments } from '../../../../../client/debugger/types';
import { clearTelemetryReporter } from '../../../../../client/telemetry';
import { EventName } from '../../../../../client/telemetry/constants';

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
            if (eventName === EventName.PYTHON_WEB_APP_RELOAD) {
                Reporter.eventNames.push(eventName);
                Reporter.properties.push(properties!);
                Reporter.measures.push(measures!);
            }
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
        let modify: boolean = false;
        if (
            ['django', 'flask', 'jinja', 'pyramid'].includes(testConfig.framework) &&
            testConfig.descriptorExperiment === 'experiment' &&
            testConfig.newDebuggerExperiment === 'experiment' &&
            testConfig.reloadExperiment === 'experiment'
        ) {
            modify = !testConfig.subProcessValue || testConfig.args.includes('--no-reload') || testConfig.args.includes('--noreload');
        }

        const argsModified = modify && (testConfig.args.includes('--no-reload') || testConfig.args.includes('--noreload'));
        const subProcModified = modify && !testConfig.subProcessValue;
        const inExperiment = testConfig.descriptorExperiment === 'experiment' && testConfig.newDebuggerExperiment === 'experiment' && testConfig.reloadExperiment === 'experiment';

        const textModify = modify ? 'modifying' : 'skip modifying';
        const textExperiment = inExperiment ? 'in' : 'NOT in';
        const textSubProc = subProcModified ? 'subProcess modified' : 'subProcess NOT modified';
        const textArgs = argsModified ? 'args modified' : 'args NOT modified';

        test(`Test ${textModify} debug config when ${textExperiment} reload experiment for ${testConfig.framework}, with ${textSubProc}, and with ${textArgs}`, () => {
            experimentManager
                .setup(e => e.inExperiment(TypeMoq.It.isValue(DebugAdapterDescriptorFactory.experiment)))
                .returns(() => 'experiment' === testConfig.descriptorExperiment);
            experimentManager.setup(e => e.inExperiment(TypeMoq.It.isValue(DebugAdapterNewPtvsd.experiment))).returns(() => 'experiment' === testConfig.newDebuggerExperiment);
            experimentManager.setup(e => e.inExperiment(TypeMoq.It.isValue(WebAppReload.experiment))).returns(() => 'experiment' === testConfig.reloadExperiment);

            const config: LaunchRequestArguments = {
                pythonPath: '',
                request: 'launch',
                args: testConfig.args,
                name: '',
                envFile: '',
                type: DebuggerTypeName,
                subProcess: testConfig.subProcessValue
            };
            const expectedConfig: LaunchRequestArguments = {
                pythonPath: '',
                request: 'launch',
                args: modify ? testConfig.withoutReloadArgs : testConfig.args,
                name: '',
                envFile: '',
                type: DebuggerTypeName,
                subProcess: modify ? true : testConfig.subProcessValue
            };

            if (testConfig.framework !== 'not-web-framework') {
                config[testConfig.framework] = true;
                expectedConfig[testConfig.framework] = true;
            }

            resolverExperiment.setExperimentConfiguration(config);

            assert.deepEqual(expectedConfig, config);
            if (modify) {
                assert.ok(Reporter.eventNames.includes(EventName.PYTHON_WEB_APP_RELOAD));
                assert.deepEqual(Reporter.properties, [
                    {
                        subProcessModified: `${subProcModified}`,
                        argsModified: `${argsModified}`
                    }
                ]);
            }
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
