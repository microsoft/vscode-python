// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { mock, when, anything, instance, verify, reset } from 'ts-mockito';
import { EventEmitter, Terminal, Uri } from 'vscode';
import { IActiveResourceService, IApplicationShell, ITerminalManager } from '../../../client/common/application/types';
import {
    IConfigurationService,
    IExperimentService,
    IPersistentState,
    IPersistentStateFactory,
    IPythonSettings,
} from '../../../client/common/types';
import { TerminalEnvVarCollectionPrompt } from '../../../client/interpreter/activation/terminalEnvVarCollectionPrompt';
import { ITerminalEnvVarCollectionService } from '../../../client/interpreter/activation/types';
import { Common, Interpreters } from '../../../client/common/utils/localize';
import { TerminalEnvVarActivation } from '../../../client/common/experiments/groups';
import { sleep } from '../../core';

suite('Terminal Environment Variable Collection Prompt', () => {
    let shell: IApplicationShell;
    let terminalManager: ITerminalManager;
    let experimentService: IExperimentService;
    let activeResourceService: IActiveResourceService;
    let terminalEnvVarCollectionService: ITerminalEnvVarCollectionService;
    let persistentStateFactory: IPersistentStateFactory;
    let terminalEnvVarCollectionPrompt: TerminalEnvVarCollectionPrompt;
    let terminalEventEmitter: EventEmitter<Terminal>;
    let notificationEnabled: IPersistentState<boolean>;
    let configurationService: IConfigurationService;
    const prompts = [Common.doNotShowAgain];
    const message = Interpreters.terminalEnvVarCollectionPrompt;

    setup(async () => {
        shell = mock<IApplicationShell>();
        terminalManager = mock<ITerminalManager>();
        experimentService = mock<IExperimentService>();
        activeResourceService = mock<IActiveResourceService>();
        persistentStateFactory = mock<IPersistentStateFactory>();
        terminalEnvVarCollectionService = mock<ITerminalEnvVarCollectionService>();
        configurationService = mock<IConfigurationService>();
        when(configurationService.getSettings(anything())).thenReturn(({
            terminal: {
                activateEnvironment: true,
            },
        } as unknown) as IPythonSettings);
        notificationEnabled = mock<IPersistentState<boolean>>();
        terminalEventEmitter = new EventEmitter<Terminal>();
        when(persistentStateFactory.createGlobalPersistentState(anything(), true)).thenReturn(
            instance(notificationEnabled),
        );
        when(experimentService.inExperimentSync(TerminalEnvVarActivation.experiment)).thenReturn(true);
        when(terminalManager.onDidOpenTerminal).thenReturn(terminalEventEmitter.event);
        terminalEnvVarCollectionPrompt = new TerminalEnvVarCollectionPrompt(
            instance(shell),
            instance(persistentStateFactory),
            instance(terminalManager),
            [],
            instance(activeResourceService),
            instance(terminalEnvVarCollectionService),
            instance(configurationService),
            instance(experimentService),
        );
    });

    test('Show notification when a new terminal is opened for which there is no prompt set', async () => {
        const resource = Uri.file('a');
        const terminal = ({
            creationOptions: {
                cwd: resource,
            },
        } as unknown) as Terminal;
        when(terminalEnvVarCollectionService.isTerminalPromptSetCorrectly(resource)).thenReturn(false);
        when(notificationEnabled.value).thenReturn(true);
        when(shell.showInformationMessage(message, ...prompts)).thenResolve(undefined);

        await terminalEnvVarCollectionPrompt.activate();
        terminalEventEmitter.fire(terminal);
        await sleep(1);

        verify(shell.showInformationMessage(message, ...prompts)).once();
    });

    test('When not in experiment, do not show notification for the same', async () => {
        const resource = Uri.file('a');
        const terminal = ({
            creationOptions: {
                cwd: resource,
            },
        } as unknown) as Terminal;
        when(terminalEnvVarCollectionService.isTerminalPromptSetCorrectly(resource)).thenReturn(false);
        when(notificationEnabled.value).thenReturn(true);
        when(shell.showInformationMessage(message, ...prompts)).thenResolve(undefined);

        reset(experimentService);
        when(experimentService.inExperimentSync(TerminalEnvVarActivation.experiment)).thenReturn(false);
        await terminalEnvVarCollectionPrompt.activate();
        terminalEventEmitter.fire(terminal);
        await sleep(1);

        verify(shell.showInformationMessage(message, ...prompts)).never();
    });

    test('Do not show notification if notification is disabled', async () => {
        const resource = Uri.file('a');
        const terminal = ({
            creationOptions: {
                cwd: resource,
            },
        } as unknown) as Terminal;
        when(terminalEnvVarCollectionService.isTerminalPromptSetCorrectly(resource)).thenReturn(false);
        when(notificationEnabled.value).thenReturn(false);
        when(shell.showInformationMessage(message, ...prompts)).thenResolve(undefined);

        await terminalEnvVarCollectionPrompt.activate();
        terminalEventEmitter.fire(terminal);
        await sleep(1);

        verify(shell.showInformationMessage(message, ...prompts)).never();
    });

    test('Do not show notification when a new terminal is opened for which there is prompt set', async () => {
        const resource = Uri.file('a');
        const terminal = ({
            creationOptions: {
                cwd: resource,
            },
        } as unknown) as Terminal;
        when(terminalEnvVarCollectionService.isTerminalPromptSetCorrectly(resource)).thenReturn(true);
        when(notificationEnabled.value).thenReturn(true);
        when(shell.showInformationMessage(message, ...prompts)).thenResolve(undefined);

        await terminalEnvVarCollectionPrompt.activate();
        terminalEventEmitter.fire(terminal);
        await sleep(1);

        verify(shell.showInformationMessage(message, ...prompts)).never();
    });

    test("Disable notification if `Don't show again` is clicked", async () => {
        const resource = Uri.file('a');
        const terminal = ({
            creationOptions: {
                cwd: resource,
            },
        } as unknown) as Terminal;
        when(terminalEnvVarCollectionService.isTerminalPromptSetCorrectly(resource)).thenReturn(false);
        when(notificationEnabled.value).thenReturn(true);
        when(notificationEnabled.updateValue(false)).thenResolve();
        when(shell.showInformationMessage(message, ...prompts)).thenReturn(Promise.resolve(Common.doNotShowAgain));

        await terminalEnvVarCollectionPrompt.activate();
        terminalEventEmitter.fire(terminal);
        await sleep(1);

        verify(notificationEnabled.updateValue(false)).once();
    });

    test('Do not disable notification if prompt is closed', async () => {
        const resource = Uri.file('a');
        const terminal = ({
            creationOptions: {
                cwd: resource,
            },
        } as unknown) as Terminal;
        when(terminalEnvVarCollectionService.isTerminalPromptSetCorrectly(resource)).thenReturn(false);
        when(notificationEnabled.value).thenReturn(true);
        when(notificationEnabled.updateValue(false)).thenResolve();
        when(shell.showInformationMessage(message, ...prompts)).thenReturn(Promise.resolve(undefined));

        await terminalEnvVarCollectionPrompt.activate();
        terminalEventEmitter.fire(terminal);
        await sleep(1);

        verify(notificationEnabled.updateValue(false)).never();
    });
});
