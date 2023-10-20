// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { mock, when, anything, instance, verify, reset } from 'ts-mockito';
import { EventEmitter, Terminal, TerminalDataWriteEvent, TextDocument, TextEditor, Uri } from 'vscode';
import * as sinon from 'sinon';
import { expect } from 'chai';
import {
    IApplicationEnvironment,
    IApplicationShell,
    IDocumentManager,
    ITerminalManager,
} from '../../../client/common/application/types';
import { IExperimentService, IPersistentState, IPersistentStateFactory } from '../../../client/common/types';
import { Common, Interpreters } from '../../../client/common/utils/localize';
import { TerminalEnvVarActivation } from '../../../client/common/experiments/groups';
import { sleep } from '../../core';
import { IInterpreterService } from '../../../client/interpreter/contracts';
import { PythonEnvironment } from '../../../client/pythonEnvironments/info';
import { TerminalDeactivateLimitationPrompt } from '../../../client/terminals/envCollectionActivation/deactivatePrompt';
import { PythonEnvType } from '../../../client/pythonEnvironments/base/info';
import { TerminalShellType } from '../../../client/common/terminal/types';
import * as processApi from '../../../client/common/process/rawProcessApis';
import * as fsapi from '../../../client/common/platform/fs-paths';
import { noop } from '../../../client/common/utils/misc';

suite('Terminal Deactivation Limitation Prompt', () => {
    let shell: IApplicationShell;
    let experimentService: IExperimentService;
    let persistentStateFactory: IPersistentStateFactory;
    let appEnvironment: IApplicationEnvironment;
    let deactivatePrompt: TerminalDeactivateLimitationPrompt;
    let terminalWriteEvent: EventEmitter<TerminalDataWriteEvent>;
    let notificationEnabled: IPersistentState<boolean>;
    let interpreterService: IInterpreterService;
    let terminalManager: ITerminalManager;
    let documentManager: IDocumentManager;
    const prompts = [Common.editSomething.format('~/.bashrc'), Common.doNotShowAgain];
    const expectedMessage = Interpreters.terminalDeactivatePrompt.format('~/.bashrc');
    const initScriptPath = 'home/node/.bashrc';
    const resource = Uri.file('a');
    let terminal: Terminal;

    setup(async () => {
        const activeEditorEvent = new EventEmitter<TextEditor | undefined>();
        const document = ({
            uri: Uri.file(''),
            getText: () => '',
        } as unknown) as TextDocument;
        sinon.stub(processApi, 'shellExec').callsFake(async (command: string) => {
            if (command !== 'echo ~/.bashrc') {
                throw new Error(`Unexpected command: ${command}`);
            }
            await sleep(1500);
            return { stdout: initScriptPath };
        });
        documentManager = mock<IDocumentManager>();
        terminalManager = mock<ITerminalManager>();
        terminal = ({
            creationOptions: { cwd: resource },
            processId: Promise.resolve(1),
            dispose: noop,
            show: noop,
            sendText: noop,
        } as unknown) as Terminal;
        when(terminalManager.createTerminal(anything())).thenReturn(terminal);
        when(documentManager.openTextDocument(initScriptPath)).thenReturn(Promise.resolve(document));
        when(documentManager.onDidChangeActiveTextEditor).thenReturn(activeEditorEvent.event);
        shell = mock<IApplicationShell>();
        interpreterService = mock<IInterpreterService>();
        experimentService = mock<IExperimentService>();
        persistentStateFactory = mock<IPersistentStateFactory>();
        appEnvironment = mock<IApplicationEnvironment>();
        when(appEnvironment.shell).thenReturn('bash');
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
            instance(appEnvironment),
            instance(documentManager),
            instance(terminalManager),
            instance(experimentService),
        );
    });

    teardown(() => {
        sinon.restore();
    });

    test('Show notification when "deactivate" command is run when a virtual env is selected', async () => {
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

        verify(shell.showWarningMessage(expectedMessage, ...prompts)).never();
    });

    test('When not in experiment, do not show notification for the same', async () => {
        reset(experimentService);
        when(experimentService.inExperimentSync(TerminalEnvVarActivation.experiment)).thenReturn(false);

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

    test('Edit script correctly if `Edit <script>` button is clicked', async () => {
        when(notificationEnabled.value).thenReturn(true);
        when(shell.showWarningMessage(expectedMessage, ...prompts)).thenReturn(Promise.resolve(prompts[0]));
        let fileCopied = false;
        let createdFile = false;
        sinon.stub(fsapi, 'copyFile').callsFake(async (_src: string, _dest: string) => {
            fileCopied = true;
            Promise.resolve();
        });
        sinon.stub(fsapi, 'pathExists').callsFake(async (p: string) => {
            if (p === initScriptPath) {
                return Promise.resolve(false);
            }
            return Promise.resolve(true);
        });
        sinon.stub(fsapi, 'createFile').callsFake(async (_: string) => {
            createdFile = true;
            return Promise.resolve();
        });
        when(shell.withProgress(anything(), anything())).thenResolve();
        const editor = mock<TextEditor>();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        when((editor as any).then).thenReturn(undefined);
        when(documentManager.showTextDocument(anything())).thenReturn(Promise.resolve(editor));
        when(editor.revealRange(anything(), anything())).thenReturn();
        when(documentManager.applyEdit(anything())).thenReturn();

        await deactivatePrompt._notifyUsers(TerminalShellType.bash, terminal);

        expect(fileCopied).to.equal(true);
        expect(createdFile).to.equal(true, 'File not created');
        verify(shell.withProgress(anything(), anything())).once();
        verify(shell.showWarningMessage(expectedMessage, ...prompts)).once();
        verify(notificationEnabled.updateValue(false)).once();
        verify(documentManager.applyEdit(anything())).once();
    });

    test('Restart terminal if running deactivate command in the same terminal the workaround was applied to', async () => {
        when(notificationEnabled.value).thenReturn(true);
        when(shell.showWarningMessage(expectedMessage, ...prompts)).thenReturn(Promise.resolve(prompts[0]));
        sinon.stub(fsapi, 'copyFile').callsFake(async (_src: string, _dest: string) => {
            Promise.resolve();
        });
        sinon.stub(fsapi, 'pathExists').callsFake(async (p: string) => {
            if (p === initScriptPath) {
                return Promise.resolve(false);
            }
            return Promise.resolve(true);
        });
        sinon.stub(fsapi, 'createFile').callsFake(async (_: string) => Promise.resolve());
        when(shell.withProgress(anything(), anything())).thenResolve();
        const editor = mock<TextEditor>();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        when((editor as any).then).thenReturn(undefined);
        when(documentManager.showTextDocument(anything())).thenReturn(Promise.resolve(editor));
        when(editor.revealRange(anything(), anything())).thenReturn();
        when(documentManager.applyEdit(anything())).thenReturn();

        await deactivatePrompt._notifyUsers(TerminalShellType.bash, terminal);

        reset(notificationEnabled);
        when(notificationEnabled.value).thenReturn(false);

        await deactivatePrompt._notifyUsers(TerminalShellType.bash, terminal);

        verify(terminalManager.createTerminal(anything())).once();
    });

    test('Do not perform any action if prompt is closed', async () => {
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
    });
});
