// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { expect } from 'chai';
import { instance, mock, verify, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { ApplicationShell } from '../../../client/common/application/applicationShell';
import { CommandManager } from '../../../client/common/application/commandManager';
import { IApplicationShell, ICommandManager } from '../../../client/common/application/types';
import { ExtensionChannelService } from '../../../client/common/insidersBuild/downloadChannelService';
import { InsidersExtensionPrompt, insidersPromptStateKey } from '../../../client/common/insidersBuild/insidersExtensionPrompt';
import { ExtensionChannel, IExtensionChannelService } from '../../../client/common/insidersBuild/types';
import { PersistentStateFactory } from '../../../client/common/persistentState';
import { IPersistentState, IPersistentStateFactory } from '../../../client/common/types';
import { Common, ExtensionChannels } from '../../../client/common/utils/localize';

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
        when(persistentState.createGlobalPersistentState(insidersPromptStateKey, false)).thenReturn(hasUserBeenNotifiedState.object);
        insidersPrompt = new InsidersExtensionPrompt(instance(appShell), instance(extensionChannelService), instance(cmdManager), instance(persistentState));
    });

    test('Channel is set to stable and reload prompt is disabled if \'Use Stable\' option is selected', async () => {
        const prompts = [ExtensionChannels.useStable(), Common.reload()];
        when(
            appShell.showInformationMessage(ExtensionChannels.promptMessage(), ...prompts)
        ).thenResolve(ExtensionChannels.useStable() as any);
        when(
            extensionChannelService.updateChannel(ExtensionChannel.stable)
        ).thenResolve();
        hasUserBeenNotifiedState
            .setup(u => u.updateValue(true))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.once());
        await insidersPrompt.notifyToInstallInsiders();
        verify(appShell.showInformationMessage(ExtensionChannels.promptMessage(), ...prompts)).once();
        verify(extensionChannelService.updateChannel(ExtensionChannel.stable)).once();
        hasUserBeenNotifiedState.verifyAll();
        expect(insidersPrompt.reloadPromptDisabled).to.equal(true, 'Reload prompt should be disabled');
    });

    test('Channel is set to \'InsidersWeekly\', reload prompt is disabled and reload command is invoked if \'Reload\' option is selected', async () => {
        const prompts = [ExtensionChannels.useStable(), Common.reload()];
        when(
            appShell.showInformationMessage(ExtensionChannels.promptMessage(), ...prompts)
        ).thenResolve(Common.reload() as any);
        when(
            extensionChannelService.updateChannel(ExtensionChannel.insidersDefaultForTheFirstSession)
        ).thenResolve();
        when(
            cmdManager.executeCommand('workbench.action.reloadWindow')
        ).thenResolve();
        hasUserBeenNotifiedState
            .setup(u => u.updateValue(true))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.once());
        await insidersPrompt.notifyToInstallInsiders();
        verify(appShell.showInformationMessage(ExtensionChannels.promptMessage(), ...prompts)).once();
        verify(extensionChannelService.updateChannel(ExtensionChannel.insidersDefaultForTheFirstSession)).once();
        verify(cmdManager.executeCommand('workbench.action.reloadWindow')).once();
        hasUserBeenNotifiedState.verifyAll();
        expect(insidersPrompt.reloadPromptDisabled).to.equal(true, 'Reload prompt should be disabled');
    });
});
