// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { anything, instance, mock, verify, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { ApplicationShell } from '../../../client/common/application/applicationShell';
import { CommandManager } from '../../../client/common/application/commandManager';
import { IApplicationShell, ICommandManager } from '../../../client/common/application/types';
import { ExtensionChannelService } from '../../../client/common/insidersBuild/downloadChannelService';
import {
    InsidersExtensionPrompt,
    insidersPromptStateKey,
} from '../../../client/common/insidersBuild/insidersExtensionPrompt';
import { ExtensionChannel, IExtensionChannelService } from '../../../client/common/insidersBuild/types';
import { PersistentStateFactory } from '../../../client/common/persistentState';
import { IPersistentState, IPersistentStateFactory } from '../../../client/common/types';
import { Common, ExtensionChannels, ExtensionSurveyBanner } from '../../../client/common/utils/localize';

suite('Insiders Extension prompt', () => {
    let appShell: IApplicationShell;
    let extensionChannelService: IExtensionChannelService;
    let cmdManager: ICommandManager;
    let persistentState: IPersistentStateFactory;
    let hasUserBeenNotifiedState: TypeMoq.IMock<IPersistentState<boolean>>;
    let insidersPrompt: InsidersExtensionPrompt;
    setup(() => {
        extensionChannelService = mock(ExtensionChannelService);
        appShell = mock(ApplicationShell);
        persistentState = mock(PersistentStateFactory);
        cmdManager = mock(CommandManager);
        hasUserBeenNotifiedState = TypeMoq.Mock.ofType<IPersistentState<boolean>>();
        when(persistentState.createGlobalPersistentState(insidersPromptStateKey, false)).thenReturn(
            hasUserBeenNotifiedState.object,
        );
        insidersPrompt = new InsidersExtensionPrompt(
            instance(appShell),
            instance(extensionChannelService),
            instance(cmdManager),
            instance(persistentState),
        );
    });

    test("Channel is set to 'daily' if 'Yes, daily' option is selected", async () => {
        const prompts = [
            ExtensionChannels.yesWeekly(),
            ExtensionChannels.yesDaily(),
            ExtensionSurveyBanner.bannerLabelNo(),
        ];
        when(appShell.showInformationMessage(ExtensionChannels.promptMessage(), ...prompts)).thenResolve(
            ExtensionChannels.yesDaily() as any,
        );
        when(cmdManager.executeCommand('workbench.action.reloadWindow')).thenResolve();
        when(extensionChannelService.updateChannel(ExtensionChannel.daily)).thenResolve();
        hasUserBeenNotifiedState
            .setup((u) => u.updateValue(true))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.once());
        await insidersPrompt.promptToInstallInsiders();
        verify(appShell.showInformationMessage(ExtensionChannels.promptMessage(), ...prompts)).once();
        verify(extensionChannelService.updateChannel(ExtensionChannel.daily)).once();
        hasUserBeenNotifiedState.verifyAll();
        verify(cmdManager.executeCommand('workbench.action.reloadWindow')).never();
    });

    test("Channel is set to 'weekly' if 'Yes, weekly' option is selected", async () => {
        const prompts = [
            ExtensionChannels.yesWeekly(),
            ExtensionChannels.yesDaily(),
            ExtensionSurveyBanner.bannerLabelNo(),
        ];
        when(appShell.showInformationMessage(ExtensionChannels.promptMessage(), ...prompts)).thenResolve(
            ExtensionChannels.yesWeekly() as any,
        );
        when(cmdManager.executeCommand('workbench.action.reloadWindow')).thenResolve();
        when(extensionChannelService.updateChannel(ExtensionChannel.weekly)).thenResolve();
        hasUserBeenNotifiedState
            .setup((u) => u.updateValue(true))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.once());
        await insidersPrompt.promptToInstallInsiders();
        verify(appShell.showInformationMessage(ExtensionChannels.promptMessage(), ...prompts)).once();
        verify(extensionChannelService.updateChannel(ExtensionChannel.weekly)).once();
        hasUserBeenNotifiedState.verifyAll();
        verify(cmdManager.executeCommand('workbench.action.reloadWindow')).never();
    });

    test("No channel is set if 'No, thanks' option is selected", async () => {
        const prompts = [
            ExtensionChannels.yesWeekly(),
            ExtensionChannels.yesDaily(),
            ExtensionSurveyBanner.bannerLabelNo(),
        ];
        when(appShell.showInformationMessage(ExtensionChannels.promptMessage(), ...prompts)).thenResolve(
            ExtensionSurveyBanner.bannerLabelNo() as any,
        );
        when(cmdManager.executeCommand('workbench.action.reloadWindow')).thenResolve();
        when(extensionChannelService.updateChannel(anything())).thenResolve();
        hasUserBeenNotifiedState
            .setup((u) => u.updateValue(true))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.once());
        await insidersPrompt.promptToInstallInsiders();
        verify(appShell.showInformationMessage(ExtensionChannels.promptMessage(), ...prompts)).once();
        verify(extensionChannelService.updateChannel(anything())).never();
        hasUserBeenNotifiedState.verifyAll();
        verify(cmdManager.executeCommand('workbench.action.reloadWindow')).never();
    });

    test('No channel is set if no option is selected', async () => {
        const prompts = [
            ExtensionChannels.yesWeekly(),
            ExtensionChannels.yesDaily(),
            ExtensionSurveyBanner.bannerLabelNo(),
        ];
        when(appShell.showInformationMessage(ExtensionChannels.promptMessage(), ...prompts)).thenResolve(
            undefined as any,
        );
        when(cmdManager.executeCommand('workbench.action.reloadWindow')).thenResolve();
        when(extensionChannelService.updateChannel(anything())).thenResolve();
        hasUserBeenNotifiedState
            .setup((u) => u.updateValue(true))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.once());
        await insidersPrompt.promptToInstallInsiders();
        verify(appShell.showInformationMessage(ExtensionChannels.promptMessage(), ...prompts)).once();
        verify(extensionChannelService.updateChannel(anything())).never();
        hasUserBeenNotifiedState.verifyAll();
        verify(cmdManager.executeCommand('workbench.action.reloadWindow')).never();
    });

    test('Do not do anything if no option is selected in the reload prompt', async () => {
        when(
            appShell.showInformationMessage(ExtensionChannels.reloadToUseInsidersMessage(), Common.reload()),
        ).thenResolve(undefined);
        when(cmdManager.executeCommand('workbench.action.reloadWindow')).thenResolve();
        await insidersPrompt.promptToReload();
        verify(appShell.showInformationMessage(ExtensionChannels.reloadToUseInsidersMessage(), Common.reload())).once();
        verify(cmdManager.executeCommand('workbench.action.reloadWindow')).never();
    });

    test("Reload windows if 'Reload' option is selected in the reload prompt", async () => {
        when(
            appShell.showInformationMessage(ExtensionChannels.reloadToUseInsidersMessage(), Common.reload()),
        ).thenResolve(Common.reload() as any);
        when(cmdManager.executeCommand('workbench.action.reloadWindow')).thenResolve();
        await insidersPrompt.promptToReload();
        verify(appShell.showInformationMessage(ExtensionChannels.reloadToUseInsidersMessage(), Common.reload())).once();
        verify(cmdManager.executeCommand('workbench.action.reloadWindow')).once();
    });
});
