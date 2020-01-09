// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-func-body-length messages-must-be-localized

import { expect } from 'chai';
import { anything, capture, deepEqual, instance, mock, verify, when } from 'ts-mockito';
import { ApplicationShell } from '../../client/common/application/applicationShell';
import { CommandManager } from '../../client/common/application/commandManager';
import { DocumentManager } from '../../client/common/application/documentManager';
import { IApplicationShell, ICommandManager, IDocumentManager } from '../../client/common/application/types';
import { Commands } from '../../client/common/constants';
import { ServiceContainer } from '../../client/ioc/container';
import { LinterCommands } from '../../client/linters/linterCommands';
import { LinterManager } from '../../client/linters/linterManager';
import { LintingEngine } from '../../client/linters/lintingEngine';
import { ILinterInfo, ILinterManager, ILintingEngine } from '../../client/linters/types';

suite('Linting - Linter Commands', () => {
    let linterCommands: LinterCommands;
    let manager: ILinterManager;
    let shell: IApplicationShell;
    let docManager: IDocumentManager;
    let cmdManager: ICommandManager;
    let lintingEngine: ILintingEngine;
    setup(() => {
        const svcContainer = mock(ServiceContainer);
        manager = mock(LinterManager);
        shell = mock(ApplicationShell);
        docManager = mock(DocumentManager);
        cmdManager = mock(CommandManager);
        lintingEngine = mock(LintingEngine);
        when(svcContainer.get<ILinterManager>(ILinterManager)).thenReturn(instance(manager));
        when(svcContainer.get<IApplicationShell>(IApplicationShell)).thenReturn(instance(shell));
        when(svcContainer.get<IDocumentManager>(IDocumentManager)).thenReturn(instance(docManager));
        when(svcContainer.get<ICommandManager>(ICommandManager)).thenReturn(instance(cmdManager));
        when(svcContainer.get<ILintingEngine>(ILintingEngine)).thenReturn(instance(lintingEngine));
        linterCommands = new LinterCommands(instance(svcContainer));
    });

    test('Commands are registered', () => {
        verify(cmdManager.registerCommand(Commands.Set_Linter, anything())).once();
        verify(cmdManager.registerCommand(Commands.Enable_Linter, anything())).once();
        verify(cmdManager.registerCommand(Commands.Run_Linter, anything())).once();
    });

    test('Run Linting method will lint all open files', async () => {
        when(lintingEngine.lintOpenPythonFiles()).thenResolve('Hello' as any);

        const result = await linterCommands.runLinting();

        expect(result).to.be.equal('Hello');
    });

    async function testEnableLintingWithCurrentState(currentState: boolean, selectedState: 'on' | 'off' | undefined) {
        when(manager.isLintingEnabled(true, anything())).thenResolve(currentState);
        const expectedQuickPickOptions = {
            matchOnDetail: true,
            matchOnDescription: true,
            placeHolder: `current: ${currentState ? 'on' : 'off'}`
        };
        when(shell.showQuickPick(anything(), anything())).thenResolve(selectedState as any);

        await linterCommands.enableLintingAsync();

        verify(shell.showQuickPick(anything(), anything())).once();
        const options = capture(shell.showQuickPick).last()[0];
        const quickPickOptions = capture(shell.showQuickPick).last()[1];
        expect(options).to.deep.equal(['on', 'off']);
        expect(quickPickOptions).to.deep.equal(expectedQuickPickOptions);

        if (selectedState) {
            verify(manager.enableLintingAsync(selectedState === 'on', anything())).once();
        } else {
            verify(manager.enableLintingAsync(anything(), anything())).never();
        }
    }
    test("Enable linting should check if linting is enabled, and display current state of 'on' and select nothing", async () => {
        await testEnableLintingWithCurrentState(true, undefined);
    });
    test("Enable linting should check if linting is enabled, and display current state of 'on' and select 'on'", async () => {
        await testEnableLintingWithCurrentState(true, 'on');
    });
    test("Enable linting should check if linting is enabled, and display current state of 'on' and select 'off'", async () => {
        await testEnableLintingWithCurrentState(true, 'off');
    });
    test("Enable linting should check if linting is enabled, and display current state of 'off' and select 'on'", async () => {
        await testEnableLintingWithCurrentState(true, 'on');
    });
    test("Enable linting should check if linting is enabled, and display current state of 'off' and select 'off'", async () => {
        await testEnableLintingWithCurrentState(true, 'off');
    });

    test('Set Linter should display a quickpick', async () => {
        when(manager.getAllLinterInfos()).thenReturn([]);
        when(manager.getActiveLinters(true, anything())).thenResolve([]);
        when(shell.showQuickPick(anything(), anything())).thenResolve();
        const expectedQuickPickOptions = {
            matchOnDetail: true,
            matchOnDescription: true,
            placeHolder: 'current: none'
        };

        await linterCommands.setLinterAsync();

        verify(shell.showQuickPick(anything(), anything()));
        const quickPickOptions = capture(shell.showQuickPick).last()[1];
        expect(quickPickOptions).to.deep.equal(expectedQuickPickOptions);
    });
    test('Set Linter should display a quickpick and currently active linter when only one is enabled', async () => {
        const linterId = 'Hello World';
        const activeLinters: ILinterInfo[] = [{ id: linterId } as any];
        when(manager.getAllLinterInfos()).thenReturn([]);
        when(manager.getActiveLinters(true, anything())).thenResolve(activeLinters);
        when(shell.showQuickPick(anything(), anything())).thenResolve();
        const expectedQuickPickOptions = {
            matchOnDetail: true,
            matchOnDescription: true,
            placeHolder: `current: ${linterId}`
        };

        await linterCommands.setLinterAsync();

        verify(shell.showQuickPick(anything(), anything())).once();
        const quickPickOptions = capture(shell.showQuickPick).last()[1];
        expect(quickPickOptions).to.deep.equal(expectedQuickPickOptions);
    });
    test('Set Linter should display a quickpick and with message about multiple linters being enabled', async () => {
        const activeLinters: ILinterInfo[] = [{ id: 'linterId' } as any, { id: 'linterId2' } as any];
        when(manager.getAllLinterInfos()).thenReturn([]);
        when(manager.getActiveLinters(true, anything())).thenResolve(activeLinters);
        when(shell.showQuickPick(anything(), anything())).thenResolve();
        const expectedQuickPickOptions = {
            matchOnDetail: true,
            matchOnDescription: true,
            placeHolder: 'current: multiple selected'
        };

        await linterCommands.setLinterAsync();

        verify(shell.showQuickPick(anything(), anything()));
        const quickPickOptions = capture(shell.showQuickPick).last()[1];
        expect(quickPickOptions).to.deep.equal(expectedQuickPickOptions);
    });
    test('Selecting a linter should display warning message about multiple linters', async () => {
        const linters: ILinterInfo[] = [{ id: '1' }, { id: '2' }, { id: '3', product: 'Three' }] as any;
        const activeLinters: ILinterInfo[] = [{ id: '1' }, { id: '3' }] as any;
        when(manager.getAllLinterInfos()).thenReturn(linters);
        when(manager.getActiveLinters(true, anything())).thenResolve(activeLinters);
        when(shell.showQuickPick(anything(), anything())).thenResolve('3' as any);
        when(shell.showWarningMessage(anything(), 'Yes', 'No')).thenResolve('Yes' as any);
        const expectedQuickPickOptions = {
            matchOnDetail: true,
            matchOnDescription: true,
            placeHolder: 'current: multiple selected'
        };

        await linterCommands.setLinterAsync();

        verify(shell.showQuickPick(anything(), anything())).once();
        verify(shell.showWarningMessage(anything(), 'Yes', 'No')).once();
        const quickPickOptions = capture(shell.showQuickPick).last()[1];
        expect(quickPickOptions).to.deep.equal(expectedQuickPickOptions);
        verify(manager.setActiveLintersAsync(deepEqual(['Three']), anything())).once();
    });
});
