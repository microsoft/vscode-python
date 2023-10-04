// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { mock, when, anything, instance, verify, reset } from 'ts-mockito';
import { EventEmitter, Terminal, TerminalDataWriteEvent, Uri } from 'vscode';
import { IApplicationEnvironment, IApplicationShell } from '../../../client/common/application/types';
import {
    IBrowserService,
    IExperimentService,
    IPersistentState,
    IPersistentStateFactory,
} from '../../../client/common/types';
import { Common, Interpreters } from '../../../client/common/utils/localize';
import { TerminalEnvVarActivation } from '../../../client/common/experiments/groups';
import { sleep } from '../../core';
import { IInterpreterService } from '../../../client/interpreter/contracts';
import { PythonEnvironment } from '../../../client/pythonEnvironments/info';
import { TerminalDeactivateLimitationPrompt } from '../../../client/terminals/envCollectionActivation/deactivatePrompt';
import { PythonEnvType } from '../../../client/pythonEnvironments/base/info';
import { TerminalShellType } from '../../../client/common/terminal/types';

suite('Terminal Deactivation Limitation Prompt', () => {
    let shell: IApplicationShell;
    let experimentService: IExperimentService;
    let persistentStateFactory: IPersistentStateFactory;
    let appEnvironment: IApplicationEnvironment;
    let deactivatePrompt: TerminalDeactivateLimitationPrompt;
    let terminalWriteEvent: EventEmitter<TerminalDataWriteEvent>;
    let notificationEnabled: IPersistentState<boolean>;
    let browserService: IBrowserService;
    let interpreterService: IInterpreterService;
    const prompts = [Common.seeInstructions, Interpreters.deactivateDoneButton, Common.doNotShowAgain];
    const expectedMessage = Interpreters.terminalDeactivatePrompt;

    setup(async () => {
        shell = mock<IApplicationShell>();
        interpreterService = mock<IInterpreterService>();
        experimentService = mock<IExperimentService>();
        persistentStateFactory = mock<IPersistentStateFactory>();
        appEnvironment = mock<IApplicationEnvironment>();
        when(appEnvironment.shell).thenReturn('bash');
        browserService = mock<IBrowserService>();
        notificationEnabled = mock<IPersistentState<boolean>>();
        terminalWriteEvent = new EventEmitter<TerminalDataWriteEvent>();
        when(persistentStateFactory.createGlobalPersistentState(anything(), true)).thenReturn(
            instance(notificationEnabled),
        );
        when(shell.onDidWriteTerminalData).thenReturn(terminalWriteEvent.event);
        when(experimentService.inExperimentSync(TerminalEnvVarActivation.experiment)).thenReturn(true);
        deactivatePrompt = new TerminalDeactivateLimitationPrompt(
            instance(shell),
            instance(persistentStateFactory),
            [],
            instance(interpreterService),
            instance(browserService),
            instance(appEnvironment),
            instance(experimentService),
        );
    });

    test('Show notification when "deactivate" command is run when a virtual env is selected', async () => {
        const resource = Uri.file('a');
        const terminal = ({
            creationOptions: {
                cwd: resource,
            },
        } as unknown) as Terminal;
        when(notificationEnabled.value).thenReturn(true);
        when(interpreterService.getActiveInterpreter(anything())).thenResolve(({
            type: PythonEnvType.Virtual,
        } as unknown) as PythonEnvironment);
        when(shell.showWarningMessage(expectedMessage, ...prompts)).thenResolve(undefined);

        await deactivatePrompt.activate();
        terminalWriteEvent.fire({ data: 'Please deactivate me', terminal });
        await sleep(1);

        verify(shell.showWarningMessage(expectedMessage, ...prompts)).once();
    });

    test('When using cmd, do not show notification for the same', async () => {
        const resource = Uri.file('a');
        const terminal = ({
            creationOptions: {
                cwd: resource,
            },
        } as unknown) as Terminal;
        reset(appEnvironment);
        when(appEnvironment.shell).thenReturn(TerminalShellType.commandPrompt);
        when(notificationEnabled.value).thenReturn(true);
        when(interpreterService.getActiveInterpreter(anything())).thenResolve(({
            type: PythonEnvType.Virtual,
        } as unknown) as PythonEnvironment);
        when(shell.showWarningMessage(expectedMessage, ...prompts)).thenResolve(undefined);

        await deactivatePrompt.activate();
        terminalWriteEvent.fire({ data: 'Please deactivate me', terminal });
        await sleep(1);

        verify(shell.showWarningMessage(expectedMessage, ...prompts)).once();
    });

    test('When not in experiment, do not show notification for the same', async () => {
        reset(experimentService);
        when(experimentService.inExperimentSync(TerminalEnvVarActivation.experiment)).thenReturn(false);
        const resource = Uri.file('a');
        const terminal = ({
            creationOptions: {
                cwd: resource,
            },
        } as unknown) as Terminal;
        when(notificationEnabled.value).thenReturn(true);
        when(interpreterService.getActiveInterpreter(anything())).thenResolve(({
            type: PythonEnvType.Virtual,
        } as unknown) as PythonEnvironment);
        when(shell.showWarningMessage(expectedMessage, ...prompts)).thenResolve(undefined);

        await deactivatePrompt.activate();
        terminalWriteEvent.fire({ data: 'Please deactivate me', terminal });
        await sleep(1);

        verify(shell.showWarningMessage(expectedMessage, ...prompts)).never();
    });

    test('Do not show notification if notification is disabled', async () => {
        const resource = Uri.file('a');
        const terminal = ({
            creationOptions: {
                cwd: resource,
            },
        } as unknown) as Terminal;
        when(notificationEnabled.value).thenReturn(false);
        when(interpreterService.getActiveInterpreter(anything())).thenResolve(({
            type: PythonEnvType.Virtual,
        } as unknown) as PythonEnvironment);
        when(shell.showWarningMessage(expectedMessage, ...prompts)).thenResolve(undefined);

        await deactivatePrompt.activate();
        terminalWriteEvent.fire({ data: 'Please deactivate me', terminal });
        await sleep(1);

        verify(shell.showWarningMessage(expectedMessage, ...prompts)).never();
    });

    test('Do not show notification when virtual env is not activated for terminal', async () => {
        const resource = Uri.file('a');
        const terminal = ({
            creationOptions: {
                cwd: resource,
            },
        } as unknown) as Terminal;
        when(notificationEnabled.value).thenReturn(true);
        when(interpreterService.getActiveInterpreter(anything())).thenResolve(({
            type: PythonEnvType.Conda,
        } as unknown) as PythonEnvironment);
        when(shell.showWarningMessage(expectedMessage, ...prompts)).thenResolve(undefined);

        await deactivatePrompt.activate();
        terminalWriteEvent.fire({ data: 'Please deactivate me', terminal });
        await sleep(1);

        verify(shell.showWarningMessage(expectedMessage, ...prompts)).never();
    });

    test("Disable notification if `Don't show again` is clicked", async () => {
        const resource = Uri.file('a');
        const terminal = ({
            creationOptions: {
                cwd: resource,
            },
        } as unknown) as Terminal;
        when(notificationEnabled.value).thenReturn(true);
        when(interpreterService.getActiveInterpreter(anything())).thenResolve(({
            type: PythonEnvType.Virtual,
        } as unknown) as PythonEnvironment);
        when(shell.showWarningMessage(expectedMessage, ...prompts)).thenReturn(Promise.resolve(Common.doNotShowAgain));

        await deactivatePrompt.activate();
        terminalWriteEvent.fire({ data: 'Please deactivate me', terminal });
        await sleep(1);

        verify(notificationEnabled.updateValue(false)).once();
    });

    test('Disable notification if `Done, it works` is clicked', async () => {
        const resource = Uri.file('a');
        const terminal = ({
            creationOptions: {
                cwd: resource,
            },
        } as unknown) as Terminal;
        when(notificationEnabled.value).thenReturn(true);
        when(interpreterService.getActiveInterpreter(anything())).thenResolve(({
            type: PythonEnvType.Virtual,
        } as unknown) as PythonEnvironment);
        when(shell.showWarningMessage(expectedMessage, ...prompts)).thenReturn(
            Promise.resolve(Interpreters.deactivateDoneButton),
        );

        await deactivatePrompt.activate();
        terminalWriteEvent.fire({ data: 'Please deactivate me', terminal });
        await sleep(1);

        verify(notificationEnabled.updateValue(false)).once();
    });

    test('Open link to workaround if `See instructions` is clicked', async () => {
        const resource = Uri.file('a');
        const terminal = ({
            creationOptions: {
                cwd: resource,
            },
        } as unknown) as Terminal;
        when(notificationEnabled.value).thenReturn(true);
        when(interpreterService.getActiveInterpreter(anything())).thenResolve(({
            type: PythonEnvType.Virtual,
        } as unknown) as PythonEnvironment);
        when(shell.showWarningMessage(expectedMessage, ...prompts)).thenReturn(Promise.resolve(Common.seeInstructions));

        await deactivatePrompt.activate();
        terminalWriteEvent.fire({ data: 'Please deactivate me', terminal });
        await sleep(1);

        verify(shell.showWarningMessage(expectedMessage, ...prompts)).once();
        verify(browserService.launch(anything())).once();
    });

    test('Do not perform any action if prompt is closed', async () => {
        const resource = Uri.file('a');
        const terminal = ({
            creationOptions: {
                cwd: resource,
            },
        } as unknown) as Terminal;
        when(notificationEnabled.value).thenReturn(true);
        when(interpreterService.getActiveInterpreter(anything())).thenResolve(({
            type: PythonEnvType.Virtual,
        } as unknown) as PythonEnvironment);
        when(shell.showWarningMessage(expectedMessage, ...prompts)).thenResolve(undefined);

        await deactivatePrompt.activate();
        terminalWriteEvent.fire({ data: 'Please deactivate me', terminal });
        await sleep(1);

        verify(shell.showWarningMessage(expectedMessage, ...prompts)).once();
        verify(notificationEnabled.updateValue(false)).never();
        verify(browserService.launch(anything())).never();
    });
});
