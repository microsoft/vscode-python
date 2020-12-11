// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as sinon from 'sinon';
import { ImportMock } from 'ts-mock-imports';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { JoinMailingListPrompt } from '../../../client/application/misc/joinMailingListPrompt';
import { ApplicationShell } from '../../../client/common/application/applicationShell';
import { IApplicationEnvironment, IApplicationShell } from '../../../client/common/application/types';
import { JoinMailingListPromptVariants } from '../../../client/common/experiments/groups';
import { ExperimentService } from '../../../client/common/experiments/service';
import { BrowserService } from '../../../client/common/net/browser';
import { PersistentState, PersistentStateFactory } from '../../../client/common/persistentState';
import { IBrowserService, IExperimentService, IPersistentState } from '../../../client/common/types';
import { Common } from '../../../client/common/utils/localize';
import * as telemetry from '../../../client/telemetry';
import { EventName } from '../../../client/telemetry/constants';

suite('Join Mailing list Prompt Tests', () => {
    let joinMailingList: JoinMailingListPrompt;
    let appShell: IApplicationShell;
    let storage: IPersistentState<boolean>;
    let experimentService: IExperimentService;
    let browserService: IBrowserService;
    let applicationEnvironment: IApplicationEnvironment;
    let sendTelemetryStub: sinon.SinonStub;
    setup(() => {
        const factory = mock(PersistentStateFactory);
        storage = mock(PersistentState);
        appShell = mock(ApplicationShell);
        experimentService = mock(ExperimentService);
        browserService = mock(BrowserService);
        applicationEnvironment = mock(IApplicationEnvironment);

        when(factory.createGlobalPersistentState('JoinMailingListPrompt', false)).thenReturn(instance(storage));
        when(applicationEnvironment.sessionId).thenReturn('test.sessionId');

        joinMailingList = new JoinMailingListPrompt(
            instance(appShell),
            instance(factory),
            instance(experimentService),
            instance(browserService),
            instance(applicationEnvironment)
        );

        sendTelemetryStub = ImportMock.mockFunction(telemetry, 'sendTelemetryEvent');
    });
    teardown(() => {
        sendTelemetryStub.restore();
    });
    test('Do not show notification if already shown', async () => {
        when(storage.value).thenReturn(true);

        await joinMailingList.activate();

        verify(appShell.showInformationMessage(anything(), anything())).never();
    });
    test('Do not show notification if in neither experiments', async () => {
        when(storage.value).thenReturn(false);
        when(experimentService.inExperiment(anything())).thenResolve(false);

        await joinMailingList.activate();

        verify(appShell.showInformationMessage(anything(), anything())).never();
        verify(storage.updateValue(true)).once();
    });
    test('Show prompt if in variant 1 experiment', async () => {
        when(storage.value).thenReturn(false);
        when(experimentService.inExperiment(JoinMailingListPromptVariants.variant1)).thenResolve(true);
        when(experimentService.inExperiment(JoinMailingListPromptVariants.variant2)).thenResolve(false);
        when(experimentService.inExperiment(JoinMailingListPromptVariants.variant3)).thenResolve(false);
        when(experimentService.getExperimentValue(JoinMailingListPromptVariants.variant1)).thenResolve('Sample value');

        await joinMailingList.activate();

        assert.ok(sendTelemetryStub.calledWithExactly(EventName.JOIN_MAILING_LIST_PROMPT_DISPLAYED));
        verify(appShell.showInformationMessage(anything(), Common.bannerLabelYes(), Common.bannerLabelNo())).once();
        verify(storage.updateValue(true)).once();
    });
    test('Show prompt if in variant 2 experiment', async () => {
        when(storage.value).thenReturn(false);
        when(experimentService.inExperiment(JoinMailingListPromptVariants.variant1)).thenResolve(false);
        when(experimentService.inExperiment(JoinMailingListPromptVariants.variant2)).thenResolve(true);
        when(experimentService.inExperiment(JoinMailingListPromptVariants.variant3)).thenResolve(false);
        when(experimentService.getExperimentValue(JoinMailingListPromptVariants.variant2)).thenResolve('Sample value');

        await joinMailingList.activate();

        assert.ok(sendTelemetryStub.calledWithExactly(EventName.JOIN_MAILING_LIST_PROMPT_DISPLAYED));
        verify(appShell.showInformationMessage(anything(), Common.bannerLabelYes(), Common.bannerLabelNo())).once();
        verify(storage.updateValue(true)).once();
    });
    test('Show prompt if in variant 3 experiment', async () => {
        when(storage.value).thenReturn(false);
        when(experimentService.inExperiment(JoinMailingListPromptVariants.variant1)).thenResolve(false);
        when(experimentService.inExperiment(JoinMailingListPromptVariants.variant2)).thenResolve(false);
        when(experimentService.inExperiment(JoinMailingListPromptVariants.variant3)).thenResolve(true);
        when(experimentService.getExperimentValue(JoinMailingListPromptVariants.variant3)).thenResolve('Sample value');

        await joinMailingList.activate();

        assert.ok(sendTelemetryStub.calledWithExactly(EventName.JOIN_MAILING_LIST_PROMPT_DISPLAYED));
        verify(appShell.showInformationMessage(anything(), Common.bannerLabelYes(), Common.bannerLabelNo())).once();
        verify(storage.updateValue(true)).once();
    });
    test('Show any variant, but user clicks "Yes"', async () => {
        when(storage.value).thenReturn(false);
        when(experimentService.inExperiment(JoinMailingListPromptVariants.variant1)).thenResolve(true);
        when(experimentService.getExperimentValue(JoinMailingListPromptVariants.variant1)).thenResolve('Sample value');

        when(appShell.showInformationMessage(anything(), Common.bannerLabelYes(), Common.bannerLabelNo())).thenResolve(
            // tslint:disable-next-line: no-any
            Common.bannerLabelYes() as any
        );

        await joinMailingList.activate();

        assert.ok(sendTelemetryStub.calledWithExactly(EventName.JOIN_MAILING_LIST_PROMPT_DISPLAYED));
        verify(
            browserService.launch('https://aka.ms/python-vscode-mailinglist?m=test.sessionId&utm_source=vscode')
        ).once();
        verify(storage.updateValue(true)).once();
        assert.ok(
            sendTelemetryStub.calledWithExactly(EventName.JOIN_MAILING_LIST_PROMPT, undefined, { selection: 'Yes' })
        );
    });
    test('Show any variant, but user clicks "No"', async () => {
        when(storage.value).thenReturn(false);
        when(experimentService.inExperiment(JoinMailingListPromptVariants.variant1)).thenResolve(true);
        when(experimentService.getExperimentValue(JoinMailingListPromptVariants.variant1)).thenResolve('Sample value');

        when(appShell.showInformationMessage(anything(), Common.bannerLabelYes(), Common.bannerLabelNo())).thenResolve(
            // tslint:disable-next-line: no-any
            Common.bannerLabelNo() as any
        );

        await joinMailingList.activate();

        assert.ok(sendTelemetryStub.calledWithExactly(EventName.JOIN_MAILING_LIST_PROMPT_DISPLAYED));
        verify(storage.updateValue(true)).once();
        assert.ok(
            sendTelemetryStub.calledWithExactly(EventName.JOIN_MAILING_LIST_PROMPT, undefined, { selection: 'No' })
        );
    });
    test('Show any variant, but user clicks close', async () => {
        when(storage.value).thenReturn(false);
        when(experimentService.inExperiment(JoinMailingListPromptVariants.variant1)).thenResolve(true);
        when(experimentService.getExperimentValue(JoinMailingListPromptVariants.variant1)).thenResolve('Sample value');

        when(appShell.showInformationMessage(anything(), Common.bannerLabelYes(), Common.bannerLabelNo())).thenResolve(
            undefined
        );

        await joinMailingList.activate();

        assert.ok(sendTelemetryStub.calledWithExactly(EventName.JOIN_MAILING_LIST_PROMPT_DISPLAYED));
        verify(storage.updateValue(true)).once();
        assert.ok(
            sendTelemetryStub.calledWithExactly(EventName.JOIN_MAILING_LIST_PROMPT, undefined, { selection: undefined })
        );
    });
});
