// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { anything, instance, mock, verify, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { EventEmitter, Extension, Terminal } from 'vscode';
import { ActiveResourceService } from '../../client/common/application/activeResource';
import { TerminalManager } from '../../client/common/application/terminalManager';
import { IActiveResourceService, ICommandManager, ITerminalManager } from '../../client/common/application/types';
import { CODE_RUNNER_EXTENSION_ID } from '../../client/common/constants';
import { TerminalActivator } from '../../client/common/terminal/activator';
import { ITerminalActivator } from '../../client/common/terminal/types';
import { IExtensions } from '../../client/common/types';
import { ExtensionActivationForTerminalActivation, TerminalAutoActivation } from '../../client/terminals/activation';
import { ITerminalAutoActivation } from '../../client/terminals/types';
import { noop } from '../core';

// tslint:disable-next-line: max-func-body-length
suite('Terminal', () => {
    suite('Terminal - Terminal Activation', () => {
        let autoActivation: ITerminalAutoActivation;
        let manager: ITerminalManager;
        let activator: ITerminalActivator;
        let resourceService: IActiveResourceService;
        let onDidOpenTerminalEventEmitter: EventEmitter<Terminal>;
        let terminal: Terminal;
        let nonActivatedTerminal: Terminal;

        setup(() => {
            manager = mock(TerminalManager);
            activator = mock(TerminalActivator);
            resourceService = mock(ActiveResourceService);
            onDidOpenTerminalEventEmitter = new EventEmitter<Terminal>();
            when(manager.onDidOpenTerminal).thenReturn(onDidOpenTerminalEventEmitter.event);
            when(activator.activateEnvironmentInTerminal(anything(), anything())).thenResolve();

            autoActivation = new TerminalAutoActivation(
                instance(manager),
                [],
                instance(activator),
                instance(resourceService)
            );

            terminal = {
                dispose: noop,
                hide: noop,
                name: 'Some Name',
                creationOptions: {},
                processId: Promise.resolve(0),
                sendText: noop,
                show: noop,
            };
            nonActivatedTerminal = {
                dispose: noop,
                hide: noop,
                creationOptions: { hideFromUser: true },
                name: 'Something',
                processId: Promise.resolve(0),
                sendText: noop,
                show: noop,
            };
            autoActivation.register();
        });
        // teardown(() => fakeTimer.uninstall());

        test('Should activate terminal', async () => {
            // Trigger opening a terminal.
            // tslint:disable-next-line: no-any
            await ((onDidOpenTerminalEventEmitter.fire(terminal) as any) as Promise<void>);

            // The terminal should get activated.
            verify(activator.activateEnvironmentInTerminal(terminal, anything())).once();
        });
        test('Should not activate terminal if name starts with specific prefix', async () => {
            // Trigger opening a terminal.
            // tslint:disable-next-line: no-any
            await ((onDidOpenTerminalEventEmitter.fire(nonActivatedTerminal) as any) as Promise<void>);

            // The terminal should get activated.
            verify(activator.activateEnvironmentInTerminal(anything(), anything())).never();
        });
    });
    suite('Terminal - Extension Activation', () => {
        let commands: TypeMoq.IMock<ICommandManager>;
        let extensions: TypeMoq.IMock<IExtensions>;
        let extensionsChangeEvent: EventEmitter<void>;
        let activation: ExtensionActivationForTerminalActivation;
        setup(() => {
            commands = TypeMoq.Mock.ofType<ICommandManager>(undefined, TypeMoq.MockBehavior.Strict);
            extensions = TypeMoq.Mock.ofType<IExtensions>(undefined, TypeMoq.MockBehavior.Strict);
            extensionsChangeEvent = new EventEmitter<void>();
            extensions.setup((e) => e.onDidChange).returns(() => extensionsChangeEvent.event);
        });

        teardown(() => {
            extensionsChangeEvent.dispose();
        });

        function verifyAll() {
            commands.verifyAll();
            extensions.verifyAll();
        }

        test("If code runner extension is installed, don't show the play icon", async () => {
            // tslint:disable-next-line:no-any
            const extension = TypeMoq.Mock.ofType<Extension<any>>(undefined, TypeMoq.MockBehavior.Strict);
            extensions
                .setup((e) => e.getExtension(CODE_RUNNER_EXTENSION_ID))
                .returns(() => extension.object)
                .verifiable(TypeMoq.Times.once());
            activation = new ExtensionActivationForTerminalActivation(commands.object, extensions.object, []);

            commands
                .setup((c) => c.executeCommand('setContext', 'python.showPlayIcon', true))
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.never());
            commands
                .setup((c) => c.executeCommand('setContext', 'python.showPlayIcon', false))
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.once());

            await activation.activate();

            verifyAll();
        });

        test('If code runner extension is not installed, show the play icon', async () => {
            extensions
                .setup((e) => e.getExtension(CODE_RUNNER_EXTENSION_ID))
                .returns(() => undefined)
                .verifiable(TypeMoq.Times.once());
            activation = new ExtensionActivationForTerminalActivation(commands.object, extensions.object, []);

            commands
                .setup((c) => c.executeCommand('setContext', 'python.showPlayIcon', true))
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.once());
            commands
                .setup((c) => c.executeCommand('setContext', 'python.showPlayIcon', false))
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.never());

            await activation.activate();
            verifyAll();
        });
    });
});
