// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
import { expect } from 'chai';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { Terminal, Uri } from 'vscode';
import { ActiveResourceService } from '../../../client/common/application/activeResource';
import { TerminalManager } from '../../../client/common/application/terminalManager';
import { IActiveResourceService, ITerminalManager } from '../../../client/common/application/types';
import { TerminalActivator } from '../../../client/common/terminal/activator';
import { ITerminalActivator } from '../../../client/common/terminal/types';
import { IDisposable } from '../../../client/common/types';
import { TerminalAutoActivation } from '../../../client/terminals/activation';
import { ITerminalAutoActivation } from '../../../client/terminals/types';

suite('Terminal Auto Activation', () => {
    let activator: ITerminalActivator;
    let terminalManager: ITerminalManager;
    let terminalAutoActivation: ITerminalAutoActivation;
    let activeResourceService: IActiveResourceService;
    const resource = Uri.parse('a');

    setup(() => {
        terminalManager = mock(TerminalManager);
        activator = mock(TerminalActivator);
        activeResourceService = mock(ActiveResourceService);

        terminalAutoActivation = new TerminalAutoActivation(instance(terminalManager), [], instance(activator), instance(activeResourceService));
    });

    test('New Terminals should be activated', async () => {
        type EventHandler = (e: Terminal) => void;
        let handler: undefined | EventHandler;
        const handlerDisposable = TypeMoq.Mock.ofType<IDisposable>();
        const terminal = TypeMoq.Mock.ofType<Terminal>();
        const onDidOpenTerminal = (cb: EventHandler) => {
            handler = cb;
            return handlerDisposable.object;
        };
        when(activeResourceService.getActiveResource()).thenReturn(resource);
        when(terminalManager.onDidOpenTerminal).thenReturn(onDidOpenTerminal);
        when(activator.activateEnvironmentInTerminal(anything(), anything())).thenResolve();

        terminalAutoActivation.register();

        expect(handler).not.to.be.an('undefined', 'event handler not initialized');

        handler!.bind(terminalAutoActivation)(terminal.object);

        verify(activator.activateEnvironmentInTerminal(terminal.object, anything())).once();
    });
    test('New Terminals should be activated with resource of single workspace', async () => {
        type EventHandler = (e: Terminal) => void;
        let handler: undefined | EventHandler;
        const handlerDisposable = TypeMoq.Mock.ofType<IDisposable>();
        const terminal = TypeMoq.Mock.ofType<Terminal>();
        const onDidOpenTerminal = (cb: EventHandler) => {
            handler = cb;
            return handlerDisposable.object;
        };
        when(activeResourceService.getActiveResource()).thenReturn(resource);
        when(terminalManager.onDidOpenTerminal).thenReturn(onDidOpenTerminal);
        when(activator.activateEnvironmentInTerminal(anything(), anything())).thenResolve();

        terminalAutoActivation.register();

        expect(handler).not.to.be.an('undefined', 'event handler not initialized');

        handler!.bind(terminalAutoActivation)(terminal.object);

        verify(activator.activateEnvironmentInTerminal(terminal.object, anything())).once();
    });
    test('New Terminals should be activated with resource of main workspace', async () => {
        type EventHandler = (e: Terminal) => void;
        let handler: undefined | EventHandler;
        const handlerDisposable = TypeMoq.Mock.ofType<IDisposable>();
        const terminal = TypeMoq.Mock.ofType<Terminal>();
        const onDidOpenTerminal = (cb: EventHandler) => {
            handler = cb;
            return handlerDisposable.object;
        };
        when(activeResourceService.getActiveResource()).thenReturn(resource);
        when(terminalManager.onDidOpenTerminal).thenReturn(onDidOpenTerminal);
        when(activator.activateEnvironmentInTerminal(anything(), anything())).thenResolve();
        terminalAutoActivation.register();

        expect(handler).not.to.be.an('undefined', 'event handler not initialized');

        handler!.bind(terminalAutoActivation)(terminal.object);

        verify(activator.activateEnvironmentInTerminal(terminal.object, anything())).once();
    });
});
