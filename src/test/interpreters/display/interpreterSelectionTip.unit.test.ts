// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { anything, instance, mock, verify, when } from 'ts-mockito';
import { ApplicationShell } from '../../../client/common/application/applicationShell';
import { IApplicationShell } from '../../../client/common/application/types';
import { SurveyAndInterpreterTipNotification } from '../../../client/common/experiments/groups';
import { ExperimentService } from '../../../client/common/experiments/service';
import { BrowserService } from '../../../client/common/net/browser';
import { PersistentState, PersistentStateFactory } from '../../../client/common/persistentState';
import { IBrowserService, IExperimentService, IPersistentState } from '../../../client/common/types';
import { Common } from '../../../client/common/utils/localize';
import { InterpreterSelectionTip } from '../../../client/interpreter/display/interpreterSelectionTip';

suite('Interpreters - Interpreter Selection Tip', () => {
    let selectionTip: InterpreterSelectionTip;
    let appShell: IApplicationShell;
    let storage: IPersistentState<boolean>;
    let experimentService: IExperimentService;
    let browserService: IBrowserService;
    setup(() => {
        const factory = mock(PersistentStateFactory);
        storage = mock(PersistentState);
        appShell = mock(ApplicationShell);
        experimentService = mock(ExperimentService);
        browserService = mock(BrowserService);

        when(factory.createGlobalPersistentState('InterpreterSelectionTip', false)).thenReturn(instance(storage));

        selectionTip = new InterpreterSelectionTip(
            instance(appShell),
            instance(factory),
            instance(experimentService),
            instance(browserService),
        );
    });
    test('Do not show notification if already shown', async () => {
        when(storage.value).thenReturn(true);

        await selectionTip.activate();

        verify(appShell.showInformationMessage(anything(), anything())).never();
    });
    test('Do not show notification if in neither experiments', async () => {
        when(storage.value).thenReturn(false);
        when(experimentService.inExperiment(anything())).thenResolve(false);

        await selectionTip.activate();

        verify(appShell.showInformationMessage(anything(), anything())).never();
        verify(storage.updateValue(true)).once();
    });
    test('Show tip if in tip experiment', async () => {
        when(storage.value).thenReturn(false);
        when(experimentService.inExperiment(SurveyAndInterpreterTipNotification.tipExperiment)).thenResolve(true);
        when(experimentService.inExperiment(SurveyAndInterpreterTipNotification.surveyExperiment)).thenResolve(false);

        await selectionTip.activate();

        verify(appShell.showInformationMessage(anything(), Common.gotIt())).once();
        verify(storage.updateValue(true)).once();
    });
    test('Show survey link if in survey experiment', async () => {
        when(experimentService.inExperiment(SurveyAndInterpreterTipNotification.tipExperiment)).thenResolve(false);
        when(experimentService.inExperiment(SurveyAndInterpreterTipNotification.surveyExperiment)).thenResolve(true);

        await selectionTip.activate();

        verify(appShell.showInformationMessage(anything(), Common.bannerLabelYes(), Common.bannerLabelNo())).once();
        verify(storage.updateValue(true)).once();
    });
    test('Open survey link if in survey experiment and "Yes" is selected', async () => {
        when(experimentService.inExperiment(SurveyAndInterpreterTipNotification.tipExperiment)).thenResolve(false);
        when(experimentService.inExperiment(SurveyAndInterpreterTipNotification.surveyExperiment)).thenResolve(true);
        when(appShell.showInformationMessage(anything(), Common.bannerLabelYes(), Common.bannerLabelNo())).thenResolve(
            // tslint:disable-next-line: no-any
            Common.bannerLabelYes() as any,
        );

        await selectionTip.activate();

        verify(browserService.launch(anything())).once();
    });
});
