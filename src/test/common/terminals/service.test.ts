// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { Disposable, Terminal as VSCodeTerminal } from 'vscode';
import { ITerminalManager } from '../../../client/common/application/types';
import { IPlatformService } from '../../../client/common/platform/types';
import { TerminalService } from '../../../client/common/terminal/service';
import { ITerminalHelper, TerminalShellType } from '../../../client/common/terminal/types';
import { IDisposableRegistry } from '../../../client/common/types';
import { IServiceContainer } from '../../../client/ioc/types';
import { initialize } from '../../initialize';

// tslint:disable-next-line:max-func-body-length
suite('Terminal Service', () => {
    let service: TerminalService;
    let helper: TypeMoq.IMock<ITerminalHelper>;
    let terminal: TypeMoq.IMock<VSCodeTerminal>;
    let terminalManager: TypeMoq.IMock<ITerminalManager>;
    let platformService: TypeMoq.IMock<IPlatformService>;
    let disposables: Disposable[] = [];
    let mockServiceContainer: TypeMoq.IMock<IServiceContainer>;
    suiteSetup(initialize);
    setup(() => {
        helper = TypeMoq.Mock.ofType<ITerminalHelper>();
        terminal = TypeMoq.Mock.ofType<VSCodeTerminal>();
        terminalManager = TypeMoq.Mock.ofType<ITerminalManager>();
        platformService = TypeMoq.Mock.ofType<IPlatformService>();
        disposables = [];
        helper.setup(h => h.createTerminal()).returns(() => terminal.object);
        helper.setup(h => h.createTerminal(TypeMoq.It.isAny())).returns(() => terminal.object);
        helper.setup(h => h.getTerminalShellPath()).returns(() => '');
        helper.setup(h => h.identifyTerminalShell(TypeMoq.It.isAnyString())).returns(() => TerminalShellType.other);

        mockServiceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        mockServiceContainer.setup(c => c.get(ITerminalHelper)).returns(() => helper.object);
        mockServiceContainer.setup(c => c.get(ITerminalManager)).returns(() => terminalManager.object);
        mockServiceContainer.setup(c => c.get(IPlatformService)).returns(() => platformService.object);
        mockServiceContainer.setup(c => c.get(IDisposableRegistry)).returns(() => disposables);
    });
    teardown(() => {
        if (service) {
            // tslint:disable-next-line:no-any
            service.dispose();
        }
        disposables.filter(item => !!item).forEach(item => item.dispose());
    });

    test('Ensure terminal is disposed', async () => {
        service = new TerminalService(mockServiceContainer.object);
        await service.sendCommand('', []);

        terminal.verify(t => t.show(), TypeMoq.Times.exactly(2));
        service.dispose();
        terminal.verify(t => t.dispose(), TypeMoq.Times.exactly(1));
    });

    test('Ensure command is sent to terminal and it is shown', async () => {
        service = new TerminalService(mockServiceContainer.object);
        const commandToSend = 'SomeCommand';
        const args = ['1', '2'];
        const commandToExpect = [commandToSend].concat(args).join(' ');
        helper.setup(h => h.buildCommandForTerminal(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => commandToExpect);
        await service.sendCommand(commandToSend, args);

        terminal.verify(t => t.show(), TypeMoq.Times.exactly(2));
        terminal.verify(t => t.sendText(TypeMoq.It.isValue(commandToExpect), TypeMoq.It.isValue(true)), TypeMoq.Times.exactly(1));
    });

    test('Ensure text is sent to terminal and it is shown', async () => {
        service = new TerminalService(mockServiceContainer.object);
        const textToSend = 'Some Text';
        await service.sendText(textToSend);

        terminal.verify(t => t.show(), TypeMoq.Times.exactly(2));
        terminal.verify(t => t.sendText(TypeMoq.It.isValue(textToSend)), TypeMoq.Times.exactly(1));
    });

    test('Ensure close event is not fired when another terminal is closed', async () => {
        let eventFired = false;
        let eventHandler: undefined | (() => void);
        terminalManager.setup(m => m.onDidCloseTerminal(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(handler => {
            eventHandler = handler;
            // tslint:disable-next-line:no-empty
            return { dispose: () => { } };
        });
        service = new TerminalService(mockServiceContainer.object);
        service.onDidCloseTerminal(() => eventFired = true);
        // This will create the terminal.
        await service.sendText('blah');

        expect(eventHandler).not.to.be.an('undefined', 'event handler not initialized');
        eventHandler!.bind(service)();
        expect(eventFired).to.be.equal(false, 'Event fired');
    });

    test('Ensure close event is not fired when terminal is closed', async () => {
        let eventFired = false;
        let eventHandler: undefined | ((t: VSCodeTerminal) => void);
        terminalManager.setup(m => m.onDidCloseTerminal(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(handler => {
            eventHandler = handler;
            // tslint:disable-next-line:no-empty
            return { dispose: () => { } };
        });
        service = new TerminalService(mockServiceContainer.object);
        service.onDidCloseTerminal(() => eventFired = true);
        // This will create the terminal.
        await service.sendText('blah');

        expect(eventHandler).not.to.be.an('undefined', 'event handler not initialized');
        eventHandler!.bind(service)(terminal.object);
        expect(eventFired).to.be.equal(true, 'Event not fired');
    });
});
