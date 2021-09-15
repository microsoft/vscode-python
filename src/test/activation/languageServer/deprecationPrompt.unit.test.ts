// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import * as sinon from 'sinon';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { ConfigurationTarget, WorkspaceConfiguration } from 'vscode';
import {
    MPLSDeprecationPrompt,
    mplsDeprecationPromptFrequency,
    mplsDeprecationPromptStateKey,
} from '../../../client/activation/languageServer/deprecationPrompt';
import { LanguageServerType } from '../../../client/activation/types';
import { IApplicationShell, IWorkspaceService } from '../../../client/common/application/types';
import { PersistentState } from '../../../client/common/persistentState';
import {
    DefaultLSType,
    IConfigurationService,
    IDefaultLanguageServer,
    IPersistentStateFactory,
} from '../../../client/common/types';
import { MPLSDeprecation } from '../../../client/common/utils/localize';
import * as Telemetry from '../../../client/telemetry';
import { EventName } from '../../../client/telemetry/constants';

suite('MPLS deprecation prompt', () => {
    let applicationShell: IApplicationShell;
    let persistentStateFactory: IPersistentStateFactory;
    let globalState: PersistentState<boolean>;
    let workspaceState: PersistentState<boolean>;
    let workspaceService: IWorkspaceService;
    let workspaceConfiguration: WorkspaceConfiguration;
    let configService: IConfigurationService;
    let defaultLanguageServer: IDefaultLanguageServer;
    let sendTelemetryEventStub: sinon.SinonStub;
    let telemetryEvents: { eventName: string; properties: Record<string, unknown> }[] = [];

    setup(() => {
        applicationShell = mock();

        persistentStateFactory = mock();
        globalState = mock<PersistentState<boolean>>(PersistentState);
        workspaceState = mock<PersistentState<boolean>>(PersistentState);
        when(
            persistentStateFactory.createGlobalPersistentState(
                mplsDeprecationPromptStateKey,
                false,
                mplsDeprecationPromptFrequency,
            ),
        ).thenReturn(instance(globalState));
        when(
            persistentStateFactory.createWorkspacePersistentState(
                mplsDeprecationPromptStateKey,
                false,
                mplsDeprecationPromptFrequency,
            ),
        ).thenReturn(instance(workspaceState));

        workspaceService = mock();
        workspaceConfiguration = mock();
        when(workspaceService.getConfiguration('python')).thenReturn(instance(workspaceConfiguration));

        configService = mock();
        defaultLanguageServer = mock();

        sendTelemetryEventStub = sinon
            .stub(Telemetry, 'sendTelemetryEvent')
            .callsFake((eventName: string, _, properties: Record<string, unknown>) => {
                const telemetry = { eventName, properties };
                telemetryEvents.push(telemetry);
            });
    });

    teardown(() => {
        sinon.restore();
        Telemetry._resetSharedProperties();
        telemetryEvents = [];
    });

    type TestCaseType = {
        shownInPreviousSession: boolean;

        defaultLSType?: DefaultLSType;
        selection?: string;
        switchTo?: LanguageServerType;
        telemSwitchTo?: LanguageServerType;
    };

    const testCases: TestCaseType[] = [
        {
            shownInPreviousSession: true,
        },
        {
            shownInPreviousSession: false,
            defaultLSType: LanguageServerType.Node,
            selection: MPLSDeprecation.switchToPylance(),
            switchTo: undefined,
            telemSwitchTo: LanguageServerType.Node,
        },
        {
            shownInPreviousSession: false,
            defaultLSType: LanguageServerType.Node,
            selection: MPLSDeprecation.switchToJedi(),
            switchTo: LanguageServerType.Node,
            telemSwitchTo: LanguageServerType.Jedi,
        },
        {
            shownInPreviousSession: false,
            defaultLSType: LanguageServerType.Jedi,
            selection: MPLSDeprecation.switchToJedi(),
            switchTo: undefined,
            telemSwitchTo: LanguageServerType.Jedi,
        },
        {
            shownInPreviousSession: false,
            defaultLSType: LanguageServerType.Jedi,
            selection: MPLSDeprecation.switchToPylance(),
            switchTo: LanguageServerType.Node,
            telemSwitchTo: LanguageServerType.Node,
        },
    ];

    [ConfigurationTarget.Workspace, ConfigurationTarget.Global].forEach((configLocation) => {
        suite(`Config is ${ConfigurationTarget[configLocation]}`, () => {
            testCases.forEach(({ shownInPreviousSession, defaultLSType, selection, switchTo, telemSwitchTo }) => {
                const configIsWorkspace = configLocation === ConfigurationTarget.Workspace;

                const testName = shownInPreviousSession
                    ? 'Should not show prompt when shown in previous session'
                    : `Should show when not previously shown and setting should change to "${switchTo}" when the default is "${defaultLSType}" and the prompt selection is "${selection}"`;

                test(testName, async () => {
                    const prompt = new MPLSDeprecationPrompt(
                        instance(applicationShell),
                        instance(persistentStateFactory),
                        instance(workspaceService),
                        instance(configService),
                        instance(defaultLanguageServer),
                    );

                    const state = configIsWorkspace ? workspaceState : globalState;
                    const wrongState = configIsWorkspace ? globalState : workspaceState;
                    when(state.value).thenReturn(shownInPreviousSession);

                    when(workspaceConfiguration.inspect('languageServer')).thenReturn({
                        key: 'languageServer',
                        workspaceValue: configIsWorkspace ? LanguageServerType.Microsoft : undefined,
                        globalValue: configIsWorkspace ? undefined : LanguageServerType.Microsoft,
                    });

                    assert.strictEqual(prompt.shouldShowPrompt, !shownInPreviousSession);

                    verify(wrongState.value).never();

                    if (shownInPreviousSession) {
                        await prompt.showPrompt();

                        verify(state.updateValue(anything())).never();
                        verify(wrongState.updateValue(anything())).never();
                        verify(
                            applicationShell.showWarningMessage(anything(), anything(), anything(), anything()),
                        ).never();
                        verify(configService.updateSetting(anything(), anything(), anything(), anything())).never();
                        sinon.assert.notCalled(sendTelemetryEventStub);
                        return;
                    }

                    when(
                        applicationShell.showWarningMessage(
                            MPLSDeprecation.bannerMessage(),
                            MPLSDeprecation.switchToPylance(),
                            MPLSDeprecation.switchToJedi(),
                        ),
                    ).thenReturn(Promise.resolve(selection));

                    assert(defaultLSType);
                    when(defaultLanguageServer.defaultLSType).thenReturn(defaultLSType);

                    await prompt.showPrompt();

                    verify(configService.updateSetting('languageServer', switchTo, undefined, configLocation));

                    verify(state.updateValue(true)).once();
                    verify(wrongState.updateValue(anything())).never();

                    sinon.assert.calledOnce(sendTelemetryEventStub);
                    assert.deepStrictEqual(telemetryEvents, [
                        { eventName: EventName.MPLS_DEPRECATION_PROMPT, properties: { switchTo: telemSwitchTo } },
                    ]);

                    assert.strictEqual(prompt.shouldShowPrompt, false);
                });
            });
        });
    });
});
