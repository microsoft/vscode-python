// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';
import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { Terminal } from 'vscode';
import { ITerminalManager } from '../../../client/common/application/types';
import { ITerminalHelper } from '../../../client/common/terminal/types';
import { IDisposableRegistry } from '../../../client/common/types';
import { IServiceContainer } from '../../../client/ioc/types';
import { TerminalAutoActivation } from '../../../client/terminals/activation';
import { ITerminalAutoActivation } from '../../../client/terminals/types';
import { noop } from '../../../utils/misc';

suite('Terminal Auto Activation', () => {
    let helper: TypeMoq.IMock<ITerminalHelper>;
    let terminalManager: TypeMoq.IMock<ITerminalManager>;
    let terminalAutoActivation: ITerminalAutoActivation;

    setup(() => {
        terminalManager = TypeMoq.Mock.ofType<ITerminalManager>();
        helper = TypeMoq.Mock.ofType<ITerminalHelper>();
        const disposables = [];

        const serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        serviceContainer
            .setup(c => c.get(TypeMoq.It.isValue(ITerminalManager), TypeMoq.It.isAny()))
            .returns(() => terminalManager.object);
        serviceContainer
            .setup(c => c.get(TypeMoq.It.isValue(ITerminalHelper), TypeMoq.It.isAny()))
            .returns(() => helper.object);
        serviceContainer
            .setup(c => c.get(TypeMoq.It.isValue(IDisposableRegistry), TypeMoq.It.isAny()))
            .returns(() => disposables);

        terminalAutoActivation = new TerminalAutoActivation(serviceContainer.object);
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
        helper
            .setup(h => h.activateEnvironmentInTerminal(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .verifiable(TypeMoq.Times.once());

        terminalAutoActivation.register();

        expect(eventHandler).not.to.be.an('undefined', 'event handler not initialized');

        eventHandler!.bind(terminalAutoActivation)(terminal.object);

        helper.verifyAll();
    });
});
