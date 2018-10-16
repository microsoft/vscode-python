// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { Terminal } from 'vscode';
import { ITerminalManager } from '../../../client/common/application/types';
import { ITerminalActivator, ITerminalHelper } from '../../../client/common/terminal/types';
import { IDisposableRegistry } from '../../../client/common/types';
import { noop } from '../../../client/common/utils/misc';
import { IServiceContainer } from '../../../client/ioc/types';
import { TerminalAutoActivation } from '../../../client/terminals/activation';
import { ITerminalAutoActivation } from '../../../client/terminals/types';

suite('Terminal Auto Activation', () => {
    let activator: TypeMoq.IMock<ITerminalActivator>;
    let terminalManager: TypeMoq.IMock<ITerminalManager>;
    let terminalAutoActivation: ITerminalAutoActivation;

    setup(() => {
        terminalManager = TypeMoq.Mock.ofType<ITerminalManager>();
        activator = TypeMoq.Mock.ofType<ITerminalActivator>();
        const disposables = [];

        const serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        serviceContainer
            .setup(c => c.get(TypeMoq.It.isValue(ITerminalManager), TypeMoq.It.isAny()))
            .returns(() => terminalManager.object);
        serviceContainer
            .setup(c => c.get(TypeMoq.It.isValue(ITerminalHelper), TypeMoq.It.isAny()))
            .returns(() => activator.object);
        serviceContainer
            .setup(c => c.get(TypeMoq.It.isValue(IDisposableRegistry), TypeMoq.It.isAny()))
            .returns(() => disposables);

        terminalAutoActivation = new TerminalAutoActivation(serviceContainer.object, activator.object);
    });

    test('New Terminals should be activated', async () => {
        let eventHandler: undefined | ((e: Terminal) => void);
        const terminal = TypeMoq.Mock.ofType<Terminal>();
        terminalManager
            .setup(m => m.onDidOpenTerminal(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(handler => {
                eventHandler = handler;
                return { dispose: noop };
            });
        activator
            .setup(h => h.activateEnvironmentInTerminal(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .verifiable(TypeMoq.Times.once());

        terminalAutoActivation.register();

        expect(eventHandler).not.to.be.an('undefined', 'event handler not initialized');

        eventHandler!.bind(terminalAutoActivation)(terminal.object);

        activator.verifyAll();
    });
});
