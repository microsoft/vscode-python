// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length no-any max-classes-per-file

import { expect } from 'chai';
import * as typemoq from 'typemoq';
import { ConfigurationChangeEvent } from 'vscode';
import { InvalidPythonInterpreterDiagnostic, InvalidPythonInterpreterService } from '../../../../client/application/diagnostics/checks/pythonInterpreter';
import { CommandOption, IDiagnosticsCommandFactory } from '../../../../client/application/diagnostics/commands/types';
import { DiagnosticCodes } from '../../../../client/application/diagnostics/constants';
import { DiagnosticCommandPromptHandlerServiceId, MessageCommandPrompt } from '../../../../client/application/diagnostics/promptHandler';
import { IDiagnostic, IDiagnosticCommand, IDiagnosticHandlerService, IDiagnosticsService } from '../../../../client/application/diagnostics/types';
import { IWorkspaceService } from '../../../../client/common/application/types';
import { IPlatformService } from '../../../../client/common/platform/types';
import { IConfigurationService, IDisposableRegistry, IPythonSettings } from '../../../../client/common/types';
import { IInterpreterHelper, IInterpreterService, InterpreterType } from '../../../../client/interpreter/contracts';
import { IServiceContainer } from '../../../../client/ioc/types';
import { noop } from '../../../../utils/misc';
import { sleep } from '../../../core';

suite('Application Diagnostics - Checks Python Interpreter', () => {
    let diagnosticService: IDiagnosticsService;
    let messageHandler: typemoq.IMock<IDiagnosticHandlerService<MessageCommandPrompt>>;
    let commandFactory: typemoq.IMock<IDiagnosticsCommandFactory>;
    let settings: typemoq.IMock<IPythonSettings>;
    let interpreterService: typemoq.IMock<IInterpreterService>;
    let platformService: typemoq.IMock<IPlatformService>;
    let helper: typemoq.IMock<IInterpreterHelper>;
    const pythonPath = 'My Python Path in Settings';
    let serviceContainer: typemoq.IMock<IServiceContainer>;
    function createContainer() {
        serviceContainer = typemoq.Mock.ofType<IServiceContainer>();
        messageHandler = typemoq.Mock.ofType<IDiagnosticHandlerService<MessageCommandPrompt>>();
        serviceContainer.setup(s => s.get(typemoq.It.isValue(IDiagnosticHandlerService), typemoq.It.isValue(DiagnosticCommandPromptHandlerServiceId)))
            .returns(() => messageHandler.object);
        commandFactory = typemoq.Mock.ofType<IDiagnosticsCommandFactory>();
        serviceContainer.setup(s => s.get(typemoq.It.isValue(IDiagnosticsCommandFactory)))
            .returns(() => commandFactory.object);
        settings = typemoq.Mock.ofType<IPythonSettings>();
        settings.setup(s => s.pythonPath).returns(() => pythonPath);
        const configService = typemoq.Mock.ofType<IConfigurationService>();
        configService.setup(c => c.getSettings(typemoq.It.isAny())).returns(() => settings.object);
        serviceContainer.setup(s => s.get(typemoq.It.isValue(IConfigurationService)))
            .returns(() => configService.object);
        interpreterService = typemoq.Mock.ofType<IInterpreterService>();
        serviceContainer.setup(s => s.get(typemoq.It.isValue(IInterpreterService)))
            .returns(() => interpreterService.object);
        platformService = typemoq.Mock.ofType<IPlatformService>();
        serviceContainer.setup(s => s.get(typemoq.It.isValue(IPlatformService)))
            .returns(() => platformService.object);
        helper = typemoq.Mock.ofType<IInterpreterHelper>();
        serviceContainer.setup(s => s.get(typemoq.It.isValue(IInterpreterHelper)))
            .returns(() => helper.object);
        serviceContainer.setup(s => s.get(typemoq.It.isValue(IDisposableRegistry)))
            .returns(() => []);
        return serviceContainer.object;
    }
    suite('Diagnostics', () => {
        setup(() => {
            diagnosticService = new class extends InvalidPythonInterpreterService {
                protected addPythonPathChangedHandler() { noop(); }
            }(createContainer());
        });

        test('Can handle InvalidPythonPathInterpreter diagnostics', async () => {
            for (const code of [
                DiagnosticCodes.NoPythonInterpretersDiagnostic,
                DiagnosticCodes.MacInterpreterSelectedAndHaveOtherInterpretersDiagnostic,
                DiagnosticCodes.MacInterpreterSelectedAndNoOtherInterpretersDiagnostic
            ]) {
                const diagnostic = typemoq.Mock.ofType<IDiagnostic>();
                diagnostic.setup(d => d.code)
                    .returns(() => code)
                    .verifiable(typemoq.Times.atLeastOnce());

                const canHandle = await diagnosticService.canHandle(diagnostic.object);
                expect(canHandle).to.be.equal(true, `Should be able to handle ${code}`);
                diagnostic.verifyAll();
            }
        });
        test('Can not handle non-InvalidPythonPathInterpreter diagnostics', async () => {
            const diagnostic = typemoq.Mock.ofType<IDiagnostic>();
            diagnostic.setup(d => d.code)
                .returns(() => 'Something Else')
                .verifiable(typemoq.Times.atLeastOnce());

            const canHandle = await diagnosticService.canHandle(diagnostic.object);
            expect(canHandle).to.be.equal(false, 'Invalid value');
            diagnostic.verifyAll();
        });
        test('Should return empty diagnostics if installer check is disabled', async () => {
            settings
                .setup(s => s.disableInstallationChecks)
                .returns(() => true)
                .verifiable(typemoq.Times.once());

            const diagnostics = await diagnosticService.diagnose();
            expect(diagnostics).to.be.deep.equal([]);
            settings.verifyAll();
        });
        test('Should return diagnostics if there are no interpreters', async () => {
            settings
                .setup(s => s.disableInstallationChecks)
                .returns(() => false)
                .verifiable(typemoq.Times.once());
            interpreterService
                .setup(i => i.getInterpreters(typemoq.It.isAny()))
                .returns(() => Promise.resolve([]))
                .verifiable(typemoq.Times.once());

            const diagnostics = await diagnosticService.diagnose();
            expect(diagnostics).to.be.deep.equal([new InvalidPythonInterpreterDiagnostic(DiagnosticCodes.NoPythonInterpretersDiagnostic)]);
            settings.verifyAll();
            interpreterService.verifyAll();
        });
        test('Should return empty diagnostics if there are interpreters and platform is not mac', async () => {
            settings
                .setup(s => s.disableInstallationChecks)
                .returns(() => false)
                .verifiable(typemoq.Times.once());
            interpreterService
                .setup(i => i.getInterpreters(typemoq.It.isAny()))
                .returns(() => Promise.resolve([{} as any]))
                .verifiable(typemoq.Times.once());
            platformService
                .setup(i => i.isMac)
                .returns(() => false)
                .verifiable(typemoq.Times.once());

            const diagnostics = await diagnosticService.diagnose();
            expect(diagnostics).to.be.deep.equal([]);
            settings.verifyAll();
            interpreterService.verifyAll();
            platformService.verifyAll();
        });
        test('Should return empty diagnostics if there are interpreters, platform is mac and selected interpreter is not default mac interpreter', async () => {
            settings
                .setup(s => s.disableInstallationChecks)
                .returns(() => false)
                .verifiable(typemoq.Times.once());
            interpreterService
                .setup(i => i.getInterpreters(typemoq.It.isAny()))
                .returns(() => Promise.resolve([{} as any]))
                .verifiable(typemoq.Times.once());
            platformService
                .setup(i => i.isMac)
                .returns(() => true)
                .verifiable(typemoq.Times.once());
            helper
                .setup(i => i.isMacDefaultPythonPath(typemoq.It.isAny()))
                .returns(() => false)
                .verifiable(typemoq.Times.once());

            const diagnostics = await diagnosticService.diagnose();
            expect(diagnostics).to.be.deep.equal([]);
            settings.verifyAll();
            interpreterService.verifyAll();
            platformService.verifyAll();
            helper.verifyAll();
        });
        test('Should return diagnostic if there are no other interpreters, platform is mac and selected interpreter is default mac interpreter', async () => {
            settings
                .setup(s => s.disableInstallationChecks)
                .returns(() => false)
                .verifiable(typemoq.Times.once());
            interpreterService
                .setup(i => i.getInterpreters(typemoq.It.isAny()))
                .returns(() => Promise.resolve([
                    { path: pythonPath } as any,
                    { path: pythonPath } as any
                ]))
                .verifiable(typemoq.Times.once());
            platformService
                .setup(i => i.isMac)
                .returns(() => true)
                .verifiable(typemoq.Times.once());
            helper
                .setup(i => i.isMacDefaultPythonPath(typemoq.It.isValue(pythonPath)))
                .returns(() => true)
                .verifiable(typemoq.Times.atLeastOnce());
            interpreterService
                .setup(i => i.getActiveInterpreter(typemoq.It.isAny()))
                .returns(() => { return Promise.resolve({ type: InterpreterType.Unknown } as any); })
                .verifiable(typemoq.Times.once());

            const diagnostics = await diagnosticService.diagnose();
            expect(diagnostics).to.be.deep.equal([new InvalidPythonInterpreterDiagnostic(DiagnosticCodes.MacInterpreterSelectedAndNoOtherInterpretersDiagnostic)]);
            settings.verifyAll();
            interpreterService.verifyAll();
            platformService.verifyAll();
            helper.verifyAll();
        });
        test('Should return diagnostic if there are other interpreters, platform is mac and selected interpreter is default mac interpreter', async () => {
            const nonMacStandardInterpreter = 'Non Mac Std Interpreter';
            settings
                .setup(s => s.disableInstallationChecks)
                .returns(() => false)
                .verifiable(typemoq.Times.once());
            interpreterService
                .setup(i => i.getInterpreters(typemoq.It.isAny()))
                .returns(() => Promise.resolve([
                    { path: pythonPath } as any,
                    { path: pythonPath } as any,
                    { path: nonMacStandardInterpreter } as any
                ]))
                .verifiable(typemoq.Times.once());
            platformService
                .setup(i => i.isMac)
                .returns(() => true)
                .verifiable(typemoq.Times.once());
            helper
                .setup(i => i.isMacDefaultPythonPath(typemoq.It.isValue(pythonPath)))
                .returns(() => true)
                .verifiable(typemoq.Times.atLeastOnce());
            helper
                .setup(i => i.isMacDefaultPythonPath(typemoq.It.isValue(nonMacStandardInterpreter)))
                .returns(() => false)
                .verifiable(typemoq.Times.atLeastOnce());
            interpreterService
                .setup(i => i.getActiveInterpreter(typemoq.It.isAny()))
                .returns(() => { return Promise.resolve({ type: InterpreterType.Unknown } as any); })
                .verifiable(typemoq.Times.once());

            const diagnostics = await diagnosticService.diagnose();
            expect(diagnostics).to.be.deep.equal([new InvalidPythonInterpreterDiagnostic(DiagnosticCodes.MacInterpreterSelectedAndHaveOtherInterpretersDiagnostic)]);
            settings.verifyAll();
            interpreterService.verifyAll();
            platformService.verifyAll();
            helper.verifyAll();
        });
        test('Handling no interpreters diagnostisc should return download link', async () => {
            const diagnostic = new InvalidPythonInterpreterDiagnostic(DiagnosticCodes.NoPythonInterpretersDiagnostic);
            const cmd = {} as any as IDiagnosticCommand;
            let messagePrompt: MessageCommandPrompt | undefined;
            messageHandler
                .setup(i => i.handle(typemoq.It.isValue(diagnostic), typemoq.It.isAny()))
                .callback((d, p: MessageCommandPrompt) => messagePrompt = p)
                .returns(() => Promise.resolve())
                .verifiable(typemoq.Times.once());
            commandFactory.setup(f => f.createCommand(typemoq.It.isAny(),
                typemoq.It.isObjectWith<CommandOption<'launch', string>>({ type: 'launch' })))
                .returns(() => cmd)
                .verifiable(typemoq.Times.once());

            await diagnosticService.handle([diagnostic]);

            messageHandler.verifyAll();
            commandFactory.verifyAll();
            expect(messagePrompt).not.be.equal(undefined, 'Message prompt not set');
            expect(messagePrompt!.commandPrompts).to.be.deep.equal([{ prompt: 'Download', command: cmd }]);
        });
        test('Handling no interpreters diagnostisc should return select interpreter cmd', async () => {
            const diagnostic = new InvalidPythonInterpreterDiagnostic(DiagnosticCodes.MacInterpreterSelectedAndHaveOtherInterpretersDiagnostic);
            const cmd = {} as any as IDiagnosticCommand;
            let messagePrompt: MessageCommandPrompt | undefined;
            messageHandler
                .setup(i => i.handle(typemoq.It.isValue(diagnostic), typemoq.It.isAny()))
                .callback((d, p: MessageCommandPrompt) => messagePrompt = p)
                .returns(() => Promise.resolve())
                .verifiable(typemoq.Times.once());
            commandFactory.setup(f => f.createCommand(typemoq.It.isAny(),
                typemoq.It.isObjectWith<CommandOption<'executeVSCCommand', string>>({ type: 'executeVSCCommand' })))
                .returns(() => cmd)
                .verifiable(typemoq.Times.once());

            await diagnosticService.handle([diagnostic]);

            messageHandler.verifyAll();
            commandFactory.verifyAll();
            expect(messagePrompt).not.be.equal(undefined, 'Message prompt not set');
            expect(messagePrompt!.commandPrompts).to.be.deep.equal([{ prompt: 'Select Python Interpreter', command: cmd }]);
        });
        test('Handling no interpreters diagnostisc should return download and learn links', async () => {
            const diagnostic = new InvalidPythonInterpreterDiagnostic(DiagnosticCodes.MacInterpreterSelectedAndNoOtherInterpretersDiagnostic);
            const cmdDownload = {} as any as IDiagnosticCommand;
            const cmdLearn = {} as any as IDiagnosticCommand;
            let messagePrompt: MessageCommandPrompt | undefined;
            messageHandler
                .setup(i => i.handle(typemoq.It.isValue(diagnostic), typemoq.It.isAny()))
                .callback((d, p: MessageCommandPrompt) => messagePrompt = p)
                .returns(() => Promise.resolve())
                .verifiable(typemoq.Times.once());
            commandFactory.setup(f => f.createCommand(typemoq.It.isAny(),
                typemoq.It.isObjectWith<CommandOption<'launch', string>>({ type: 'launch', options: 'https://code.visualstudio.com/docs/python/python-tutorial#_prerequisites' })))
                .returns(() => cmdLearn)
                .verifiable(typemoq.Times.once());
            commandFactory.setup(f => f.createCommand(typemoq.It.isAny(),
                typemoq.It.isObjectWith<CommandOption<'launch', string>>({ type: 'launch', options: 'https://www.python.org/downloads' })))
                .returns(() => cmdDownload)
                .verifiable(typemoq.Times.once());

            await diagnosticService.handle([diagnostic]);

            messageHandler.verifyAll();
            commandFactory.verifyAll();
            expect(messagePrompt).not.be.equal(undefined, 'Message prompt not set');
            expect(messagePrompt!.commandPrompts).to.be.deep.equal([{ prompt: 'Learn more', command: cmdLearn }, { prompt: 'Download', command: cmdDownload }]);
        });
    });

    suite('Change Handlers.', () => {
        test('Add PythonPath handler is invoked', async () => {
            let invoked = false;
            diagnosticService = new class extends InvalidPythonInterpreterService {
                protected addPythonPathChangedHandler() { invoked = true; }
            }(createContainer());

            expect(invoked).to.be.equal(true, 'Not invoked');
        });
        test('Event Handler is registered and invoked', async () => {
            let invoked = false;
            let callbackHandler!: (e: ConfigurationChangeEvent) => Promise<void>;
            const workspaceService = { onDidChangeConfiguration: cb => callbackHandler = cb } as any;
            const serviceContainerObject = createContainer();
            serviceContainer.setup(s => s.get(typemoq.It.isValue(IWorkspaceService)))
                .returns(() => workspaceService);
            diagnosticService = new class extends InvalidPythonInterpreterService {
                protected async onDidChangeConfiguration(_event: ConfigurationChangeEvent) { invoked = true; }
            }(serviceContainerObject);

            await callbackHandler({} as any);
            expect(invoked).to.be.equal(true, 'Not invoked');
        });
        test('Event Handler is registered and not invoked', async () => {
            let invoked = false;
            const workspaceService = { onDidChangeConfiguration: noop } as any;
            const serviceContainerObject = createContainer();
            serviceContainer.setup(s => s.get(typemoq.It.isValue(IWorkspaceService)))
                .returns(() => workspaceService);
            diagnosticService = new class extends InvalidPythonInterpreterService {
                protected async onDidChangeConfiguration(_event: ConfigurationChangeEvent) { invoked = true; }
            }(serviceContainerObject);

            expect(invoked).to.be.equal(false, 'Not invoked');
        });
        test('Diagnostics are checked when path changes', async () => {
            const event = typemoq.Mock.ofType<ConfigurationChangeEvent>();
            const workspaceService = typemoq.Mock.ofType<IWorkspaceService>();
            const serviceContainerObject = createContainer();
            let diagnoseInvocationCount = 0;
            workspaceService
                .setup(w => w.hasWorkspaceFolders)
                .returns(() => true)
                .verifiable(typemoq.Times.once());
            workspaceService
                .setup(w => w.workspaceFolders)
                .returns(() => [{ uri: '' }] as any)
                .verifiable(typemoq.Times.once());
            serviceContainer.setup(s => s.get(typemoq.It.isValue(IWorkspaceService)))
                .returns(() => workspaceService.object);
            const diagnosticSvc = new class extends InvalidPythonInterpreterService {
                constructor(item) {
                    super(item);
                    this.changeThrottleTimeout = 1;
                }
                public onDidChangeConfigurationEx = e => super.onDidChangeConfiguration(e);
                public diagnose(): Promise<any> {
                    diagnoseInvocationCount += 1;
                    return Promise.resolve();
                }
            }(serviceContainerObject);

            event
                .setup(e => e.affectsConfiguration(typemoq.It.isValue('python.pythonPath'), typemoq.It.isAny()))
                .returns(() => true)
                .verifiable(typemoq.Times.atLeastOnce());

            await diagnosticSvc.onDidChangeConfigurationEx(event.object);
            event.verifyAll();
            await sleep(100);
            expect(diagnoseInvocationCount).to.be.equal(1, 'Not invoked');

            await diagnosticSvc.onDidChangeConfigurationEx(event.object);
            await sleep(100);
            expect(diagnoseInvocationCount).to.be.equal(2, 'Not invoked');
        });
        test('Diagnostics are checked and throttled when path changes', async () => {
            const event = typemoq.Mock.ofType<ConfigurationChangeEvent>();
            const workspaceService = typemoq.Mock.ofType<IWorkspaceService>();
            const serviceContainerObject = createContainer();
            let diagnoseInvocationCount = 0;
            workspaceService
                .setup(w => w.hasWorkspaceFolders)
                .returns(() => true)
                .verifiable(typemoq.Times.once());
            workspaceService
                .setup(w => w.workspaceFolders)
                .returns(() => [{ uri: '' }] as any)
                .verifiable(typemoq.Times.once());
            serviceContainer.setup(s => s.get(typemoq.It.isValue(IWorkspaceService)))
                .returns(() => workspaceService.object);
            const diagnosticSvc = new class extends InvalidPythonInterpreterService {
                constructor(item) {
                    super(item);
                    this.changeThrottleTimeout = 100;
                }
                public onDidChangeConfigurationEx = e => super.onDidChangeConfiguration(e);
                public diagnose(): Promise<any> {
                    diagnoseInvocationCount += 1;
                    return Promise.resolve();
                }
            }(serviceContainerObject);

            event
                .setup(e => e.affectsConfiguration(typemoq.It.isValue('python.pythonPath'), typemoq.It.isAny()))
                .returns(() => true)
                .verifiable(typemoq.Times.atLeastOnce());

            await diagnosticSvc.onDidChangeConfigurationEx(event.object);
            await diagnosticSvc.onDidChangeConfigurationEx(event.object);
            await diagnosticSvc.onDidChangeConfigurationEx(event.object);
            await diagnosticSvc.onDidChangeConfigurationEx(event.object);
            await diagnosticSvc.onDidChangeConfigurationEx(event.object);
            await sleep(500);
            event.verifyAll();
            expect(diagnoseInvocationCount).to.be.equal(1, 'Not invoked');
        });
    });
});
