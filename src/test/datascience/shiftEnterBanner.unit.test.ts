// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
//tslint:disable:max-func-body-length match-default-export-name no-any no-multiline-string no-trailing-whitespace
import { expect } from 'chai';
import rewiremock from 'rewiremock';
import * as typemoq from 'typemoq';

import { IApplicationShell } from '../../client/common/application/types';
import {
    IConfigurationService,
    IDataScienceSettings,
    IPersistentState,
    IPersistentStateFactory,
    IPythonSettings
} from '../../client/common/types';
import { Telemetry } from '../../client/datascience/constants';
import { InteractiveShiftEnterBanner, InteractiveShiftEnterStateKeys } from '../../client/datascience/shiftEnterBanner';
import { IJupyterExecution } from '../../client/datascience/types';
import { clearTelemetryReporter } from '../../client/telemetry';

suite('Interactive Shift Enter Banner', () => {
    const oldValueOfVSC_PYTHON_UNIT_TEST = process.env.VSC_PYTHON_UNIT_TEST;
    const oldValueOfVSC_PYTHON_CI_TEST = process.env.VSC_PYTHON_CI_TEST;
    let appShell: typemoq.IMock<IApplicationShell>;
    let jupyterExecution: typemoq.IMock<IJupyterExecution>;
    let config: typemoq.IMock<IConfigurationService>;

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
        clearTelemetryReporter();
        process.env.VSC_PYTHON_UNIT_TEST = undefined;
        process.env.VSC_PYTHON_CI_TEST = undefined;
        appShell = typemoq.Mock.ofType<IApplicationShell>();
        jupyterExecution = typemoq.Mock.ofType<IJupyterExecution>();
        config = typemoq.Mock.ofType<IConfigurationService>();
        rewiremock.enable();
        rewiremock('vscode-extension-telemetry').with({ default: Reporter });
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

    test('Shift Enter Banner with Jupyter available', async () => {
        const shiftBanner = loadBanner(appShell, jupyterExecution, config, true, true, true, true, true, 'Yes');
        await shiftBanner.showBanner();

        appShell.verifyAll();
        jupyterExecution.verifyAll();
        config.verifyAll();

        expect(Reporter.eventNames).to.deep.equal([
            Telemetry.ShiftEnterBannerShown,
            Telemetry.EnableInteractiveShiftEnter
        ]);
    });

    test('Shift Enter Banner without Jupyter available', async () => {
        const shiftBanner = loadBanner(appShell, jupyterExecution, config, true, false, false, true, false, 'Yes');
        await shiftBanner.showBanner();

        appShell.verifyAll();
        jupyterExecution.verifyAll();
        config.verifyAll();

        expect(Reporter.eventNames).to.deep.equal([]);
    });

    test("Shift Enter Banner don't check Jupyter when disabled", async () => {
        const shiftBanner = loadBanner(appShell, jupyterExecution, config, false, false, false, false, false, 'Yes');
        await shiftBanner.showBanner();

        appShell.verifyAll();
        jupyterExecution.verifyAll();
        config.verifyAll();

        expect(Reporter.eventNames).to.deep.equal([]);
    });

    test('Shift Enter Banner changes setting', async () => {
        const shiftBanner = loadBanner(appShell, jupyterExecution, config, false, false, false, false, true, 'Yes');
        await shiftBanner.enableInteractiveShiftEnter();

        appShell.verifyAll();
        jupyterExecution.verifyAll();
        config.verifyAll();
    });

    test('Shift Enter Banner say no', async () => {
        const shiftBanner = loadBanner(appShell, jupyterExecution, config, true, true, true, true, true, 'No');
        await shiftBanner.showBanner();

        appShell.verifyAll();
        jupyterExecution.verifyAll();
        config.verifyAll();

        expect(Reporter.eventNames).to.deep.equal([
            Telemetry.ShiftEnterBannerShown,
            Telemetry.DisableInteractiveShiftEnter
        ]);
    });
});

// Create a test banner with the given settings
function loadBanner(
    appShell: typemoq.IMock<IApplicationShell>,
    jupyterExecution: typemoq.IMock<IJupyterExecution>,
    config: typemoq.IMock<IConfigurationService>,
    stateEnabled: boolean,
    jupyterFound: boolean,
    bannerShown: boolean,
    executionCalled: boolean,
    configCalled: boolean,
    questionResponse: string
): InteractiveShiftEnterBanner {
    // Config persist state
    const persistService: typemoq.IMock<IPersistentStateFactory> = typemoq.Mock.ofType<IPersistentStateFactory>();
    const enabledState: typemoq.IMock<IPersistentState<boolean>> = typemoq.Mock.ofType<IPersistentState<boolean>>();
    enabledState.setup(a => a.value).returns(() => stateEnabled);
    persistService
        .setup(a =>
            a.createGlobalPersistentState(
                typemoq.It.isValue(InteractiveShiftEnterStateKeys.ShowBanner),
                typemoq.It.isValue(true)
            )
        )
        .returns(() => {
            return enabledState.object;
        });
    persistService
        .setup(a =>
            a.createGlobalPersistentState(
                typemoq.It.isValue(InteractiveShiftEnterStateKeys.ShowBanner),
                typemoq.It.isValue(false)
            )
        )
        .returns(() => {
            return enabledState.object;
        });

    // Config settings
    const pythonSettings = typemoq.Mock.ofType<IPythonSettings>();
    const dataScienceSettings = typemoq.Mock.ofType<IDataScienceSettings>();
    dataScienceSettings.setup(d => d.enabled).returns(() => true);
    dataScienceSettings.setup(d => d.sendSelectionToInteractiveWindow).returns(() => false);
    pythonSettings.setup(p => p.datascience).returns(() => dataScienceSettings.object);
    config.setup(c => c.getSettings(typemoq.It.isAny())).returns(() => pythonSettings.object);

    // Config Jupyter
    jupyterExecution
        .setup(j => j.isNotebookSupported())
        .returns(() => {
            return Promise.resolve(jupyterFound);
        })
        .verifiable(executionCalled ? typemoq.Times.once() : typemoq.Times.never());

    const yes = 'Yes';
    const no = 'No';

    // Config AppShell
    appShell
        .setup(a => a.showInformationMessage(typemoq.It.isAny(), typemoq.It.isValue(yes), typemoq.It.isValue(no)))
        .returns(() => Promise.resolve(questionResponse))
        .verifiable(bannerShown ? typemoq.Times.once() : typemoq.Times.never());

    // Config settings
    config
        .setup(c =>
            c.updateSetting(
                typemoq.It.isValue('dataScience.sendSelectionToInteractiveWindow'),
                typemoq.It.isAny(),
                typemoq.It.isAny(),
                typemoq.It.isAny()
            )
        )
        .returns(() => Promise.resolve())
        .verifiable(configCalled ? typemoq.Times.once() : typemoq.Times.never());

    return new InteractiveShiftEnterBanner(
        appShell.object,
        persistService.object,
        jupyterExecution.object,
        config.object
    );
}
