// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { Disposable, Terminal as VSCodeTerminal, WorkspaceConfiguration } from 'vscode';
import { ITerminalManager, IWorkspaceService } from '../../../client/common/application/types';
import { IPlatformService } from '../../../client/common/platform/types';
import { TerminalService } from '../../../client/common/terminal/service';
import { ITerminalActivator, ITerminalHelper, TerminalShellType } from '../../../client/common/terminal/types';
import { IDisposableRegistry } from '../../../client/common/types';
import { IServiceContainer } from '../../../client/ioc/types';

// tslint:disable-next-line:max-func-body-length
suite('Terminal Service', () => {
    let service: TerminalService;
    let terminal: TypeMoq.IMock<VSCodeTerminal>;
    let terminalManager: TypeMoq.IMock<ITerminalManager>;
    let terminalHelper: TypeMoq.IMock<ITerminalHelper>;
    let terminalActivator: TypeMoq.IMock<ITerminalActivator>;
    let platformService: TypeMoq.IMock<IPlatformService>;
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    let disposables: Disposable[] = [];
    let mockServiceContainer: TypeMoq.IMock<IServiceContainer>;
    setup(() => {
        terminal = TypeMoq.Mock.ofType<VSCodeTerminal>();
        terminalManager = TypeMoq.Mock.ofType<ITerminalManager>();
        platformService = TypeMoq.Mock.ofType<IPlatformService>();
        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        terminalHelper = TypeMoq.Mock.ofType<ITerminalHelper>();
        terminalActivator = TypeMoq.Mock.ofType<ITerminalActivator>();
        disposables = [];

        mockServiceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        mockServiceContainer.setup((c) => c.get(ITerminalManager)).returns(() => terminalManager.object);
        mockServiceContainer.setup((c) => c.get(ITerminalHelper)).returns(() => terminalHelper.object);
        mockServiceContainer.setup((c) => c.get(IPlatformService)).returns(() => platformService.object);
        mockServiceContainer.setup((c) => c.get(IDisposableRegistry)).returns(() => disposables);
        mockServiceContainer.setup((c) => c.get(IWorkspaceService)).returns(() => workspaceService.object);
        mockServiceContainer.setup((c) => c.get(ITerminalActivator)).returns(() => terminalActivator.object);
    });
    teardown(() => {
        if (service) {
            // tslint:disable-next-line:no-any
            service.dispose();
        }
        disposables.filter((item) => !!item).forEach((item) => item.dispose());
    });

    test('Ensure terminal is disposed', async () => {
        terminalHelper
            .setup((helper) => helper.getEnvironmentActivationCommands(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined));
        const os: string = 'windows';
        service = new TerminalService(mockServiceContainer.object);
        const shellPath = 'powershell.exe';
        workspaceService
            .setup((w) => w.getConfiguration(TypeMoq.It.isValue('terminal.integrated.shell')))
            .returns(() => {
                const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
                workspaceConfig.setup((c) => c.get(os)).returns(() => shellPath);
                return workspaceConfig.object;
            });

        platformService.setup((p) => p.isWindows).returns(() => os === 'windows');
        platformService.setup((p) => p.isLinux).returns(() => os === 'linux');
        platformService.setup((p) => p.isMac).returns(() => os === 'osx');
        terminalManager.setup((t) => t.createTerminal(TypeMoq.It.isAny())).returns(() => terminal.object);
        terminalHelper
            .setup((h) => h.buildCommandForTerminal(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => 'dummy text');

        // Sending a command will cause the terminal to be created
        await service.sendCommand('', []);

        terminal.verify((t) => t.show(TypeMoq.It.isValue(true)), TypeMoq.Times.exactly(2));
        service.dispose();
        terminal.verify((t) => t.dispose(), TypeMoq.Times.exactly(1));
    });

    test('Ensure command is sent to terminal and it is shown', async () => {
        terminalHelper
            .setup((helper) => helper.getEnvironmentActivationCommands(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined));
        service = new TerminalService(mockServiceContainer.object);
        const commandToSend = 'SomeCommand';
        const args = ['1', '2'];
        const commandToExpect = [commandToSend].concat(args).join(' ');
        terminalHelper
            .setup((h) => h.buildCommandForTerminal(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => commandToExpect);
        terminalHelper.setup((h) => h.identifyTerminalShell(TypeMoq.It.isAny())).returns(() => TerminalShellType.bash);
        terminalManager.setup((t) => t.createTerminal(TypeMoq.It.isAny())).returns(() => terminal.object);

        await service.sendCommand(commandToSend, args);

        terminal.verify((t) => t.show(TypeMoq.It.isValue(true)), TypeMoq.Times.exactly(2));
        terminal.verify(
            (t) => t.sendText(TypeMoq.It.isValue(commandToExpect), TypeMoq.It.isValue(true)),
            TypeMoq.Times.exactly(1)
        );
    });

    test('Ensure text is sent to terminal and it is shown', async () => {
        terminalHelper
            .setup((helper) => helper.getEnvironmentActivationCommands(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined));
        service = new TerminalService(mockServiceContainer.object);
        const textToSend = 'Some Text';
        terminalHelper.setup((h) => h.identifyTerminalShell(TypeMoq.It.isAny())).returns(() => TerminalShellType.bash);
        terminalManager.setup((t) => t.createTerminal(TypeMoq.It.isAny())).returns(() => terminal.object);

        await service.sendText(textToSend);

        terminal.verify((t) => t.show(TypeMoq.It.isValue(true)), TypeMoq.Times.exactly(2));
        terminal.verify((t) => t.sendText(TypeMoq.It.isValue(textToSend)), TypeMoq.Times.exactly(1));
    });

    test('Ensure terminal shown', async () => {
        terminalHelper
            .setup((helper) => helper.getEnvironmentActivationCommands(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined));
        service = new TerminalService(mockServiceContainer.object);
        terminalHelper.setup((h) => h.identifyTerminalShell(TypeMoq.It.isAny())).returns(() => TerminalShellType.bash);
        terminalManager.setup((t) => t.createTerminal(TypeMoq.It.isAny())).returns(() => terminal.object);

        await service.show();

        terminal.verify((t) => t.show(TypeMoq.It.isValue(true)), TypeMoq.Times.exactly(2));
    });

    test('Ensure terminal shown and focus is set to the Terminal', async () => {
        terminalHelper
            .setup((helper) => helper.getEnvironmentActivationCommands(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined));
        service = new TerminalService(mockServiceContainer.object);
        terminalHelper.setup((h) => h.identifyTerminalShell(TypeMoq.It.isAny())).returns(() => TerminalShellType.bash);
        terminalManager.setup((t) => t.createTerminal(TypeMoq.It.isAny())).returns(() => terminal.object);

        await service.show(false);

        terminal.verify((t) => t.show(TypeMoq.It.isValue(false)), TypeMoq.Times.exactly(2));
    });

    test('Ensure terminal is activated once after creation', async () => {
        service = new TerminalService(mockServiceContainer.object);
        terminalActivator
            .setup((h) => h.activateEnvironmentInTerminal(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.once());
        terminalManager
            .setup((t) => t.createTerminal(TypeMoq.It.isAny()))
            .returns(() => terminal.object)
            .verifiable(TypeMoq.Times.atLeastOnce());

        await service.show();
        await service.show();
        await service.show();
        await service.show();

        terminalHelper.verifyAll();
        terminalActivator.verifyAll();
        terminal.verify((t) => t.show(TypeMoq.It.isValue(true)), TypeMoq.Times.atLeastOnce());
    });

    test('Ensure terminal is activated once before sending text', async () => {
        service = new TerminalService(mockServiceContainer.object);
        const textToSend = 'Some Text';
        terminalActivator
            .setup((h) => h.activateEnvironmentInTerminal(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.once());
        terminalManager
            .setup((t) => t.createTerminal(TypeMoq.It.isAny()))
            .returns(() => terminal.object)
            .verifiable(TypeMoq.Times.atLeastOnce());

        await service.sendText(textToSend);
        await service.sendText(textToSend);
        await service.sendText(textToSend);
        await service.sendText(textToSend);

        terminalHelper.verifyAll();
        terminalActivator.verifyAll();
        terminal.verify((t) => t.show(TypeMoq.It.isValue(true)), TypeMoq.Times.atLeastOnce());
    });

    test('Ensure close event is not fired when another terminal is closed', async () => {
        terminalHelper
            .setup((helper) => helper.getEnvironmentActivationCommands(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined));
        let eventFired = false;
        let eventHandler: undefined | (() => void);
        terminalManager
            .setup((m) => m.onDidCloseTerminal(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns((handler) => {
                eventHandler = handler;
                // tslint:disable-next-line:no-empty
                return { dispose: () => {} };
            });
        service = new TerminalService(mockServiceContainer.object);
        service.onDidCloseTerminal(() => (eventFired = true), service);
        terminalHelper.setup((h) => h.identifyTerminalShell(TypeMoq.It.isAny())).returns(() => TerminalShellType.bash);
        terminalManager.setup((t) => t.createTerminal(TypeMoq.It.isAny())).returns(() => terminal.object);

        // This will create the terminal.
        await service.sendText('blah');

        expect(eventHandler).not.to.be.an('undefined', 'event handler not initialized');
        eventHandler!.bind(service)();
        expect(eventFired).to.be.equal(false, 'Event fired');
    });

    test('Ensure close event is not fired when terminal is closed', async () => {
        terminalHelper
            .setup((helper) => helper.getEnvironmentActivationCommands(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined));
        let eventFired = false;
        let eventHandler: undefined | ((t: VSCodeTerminal) => void);
        terminalManager
            .setup((m) => m.onDidCloseTerminal(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns((handler) => {
                eventHandler = handler;
                // tslint:disable-next-line:no-empty
                return { dispose: () => {} };
            });
        service = new TerminalService(mockServiceContainer.object);
        service.onDidCloseTerminal(() => (eventFired = true));

        terminalHelper.setup((h) => h.identifyTerminalShell(TypeMoq.It.isAny())).returns(() => TerminalShellType.bash);
        terminalManager.setup((t) => t.createTerminal(TypeMoq.It.isAny())).returns(() => terminal.object);

        // This will create the terminal.
        await service.sendText('blah');

        expect(eventHandler).not.to.be.an('undefined', 'event handler not initialized');
        eventHandler!.bind(service)(terminal.object);
        expect(eventFired).to.be.equal(true, 'Event not fired');
    });
});
