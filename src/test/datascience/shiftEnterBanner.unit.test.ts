// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-func-body-length
import * as typemoq from 'typemoq';
import { IApplicationShell } from '../../client/common/application/types';
import { IConfigurationService, IDataScienceSettings, IPersistentState, IPersistentStateFactory, IPythonSettings } from '../../client/common/types';
import { InteractiveShiftEnterBanner, InteractiveShiftEnterStateKeys } from '../../client/datascience/shiftEnterBanner';
import { IJupyterExecution } from '../../client/datascience/types';

suite('Interactive Shift Enter Banner', () => {
    let appShell: typemoq.IMock<IApplicationShell>;
    let jupyterExecution: typemoq.IMock<IJupyterExecution>;
    let config: typemoq.IMock<IConfigurationService>;

    setup(() => {
        appShell = typemoq.Mock.ofType<IApplicationShell>();
        jupyterExecution = typemoq.Mock.ofType<IJupyterExecution>();
        config = typemoq.Mock.ofType<IConfigurationService>();
    });

    test('Shift Enter Banner with Jupyter available', async() => {
        const shiftBanner = loadBanner(appShell, jupyterExecution, config, true, true, true, true, false);
        await shiftBanner.showBanner();

        appShell.verifyAll();
        jupyterExecution.verifyAll();
        config.verifyAll();
    });

    test('Shift Enter Banner without Jupyter available', async() => {
        const shiftBanner = loadBanner(appShell, jupyterExecution, config, true, false, false, true, false);
        await shiftBanner.showBanner();

        appShell.verifyAll();
        jupyterExecution.verifyAll();
        config.verifyAll();
    });

    test('Shift Enter Banner don\'t check Jupyter when disabled', async() => {
        const shiftBanner = loadBanner(appShell, jupyterExecution, config, false, false, false, false, false);
        await shiftBanner.showBanner();

        appShell.verifyAll();
        jupyterExecution.verifyAll();
        config.verifyAll();
    });

    test('Shift Enter Banner changes setting', async() => {
        const shiftBanner = loadBanner(appShell, jupyterExecution, config, false, false, false, false, true);
        await shiftBanner.enableInteractiveShiftEnter();

        appShell.verifyAll();
        jupyterExecution.verifyAll();
        config.verifyAll();
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
    configCalled: boolean
): InteractiveShiftEnterBanner {
    // Config persist state
    const persistService: typemoq.IMock<IPersistentStateFactory> = typemoq.Mock.ofType<IPersistentStateFactory>();
    const enabledState: typemoq.IMock<IPersistentState<boolean>> = typemoq.Mock.ofType<IPersistentState<boolean>>();
    enabledState.setup(a => a.value).returns(() => stateEnabled);
    persistService.setup(a => a.createGlobalPersistentState(typemoq.It.isValue(InteractiveShiftEnterStateKeys.ShowBanner),
        typemoq.It.isValue(true))).returns(() => {
            return enabledState.object;
        });
    persistService.setup(a => a.createGlobalPersistentState(typemoq.It.isValue(InteractiveShiftEnterStateKeys.ShowBanner),
        typemoq.It.isValue(false))).returns(() => {
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
    jupyterExecution.setup(j => j.isNotebookSupported()).returns(() => {
        return Promise.resolve(jupyterFound);
    }).verifiable(executionCalled ? typemoq.Times.once() : typemoq.Times.never());

    const yes = 'Yes';
    const no = 'No';

    // Config AppShell
    appShell.setup(a => a.showInformationMessage(typemoq.It.isAny(),
        typemoq.It.isValue(yes),
        typemoq.It.isValue(no)))
        .verifiable(bannerShown ? typemoq.Times.once() : typemoq.Times.never());

    // Config settings
    config.setup(c => c.updateSetting(typemoq.It.isValue('dataScience.sendSelectionToInteractiveWindow'), typemoq.It.isValue(true), typemoq.It.isAny(), typemoq.It.isAny()))
        .returns(() => Promise.resolve())
        .verifiable(configCalled ? typemoq.Times.once() : typemoq.Times.never());

    return new InteractiveShiftEnterBanner(appShell.object, persistService.object, jupyterExecution.object, config.object);
}
