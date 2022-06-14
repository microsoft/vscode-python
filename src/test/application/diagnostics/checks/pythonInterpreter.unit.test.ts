// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as typemoq from 'typemoq';
import { BaseDiagnosticsService } from '../../../../client/application/diagnostics/base';
import { InvalidLaunchJsonDebuggerDiagnostic } from '../../../../client/application/diagnostics/checks/invalidLaunchJsonDebugger';
import {
    InvalidPythonInterpreterDiagnostic,
    InvalidPythonInterpreterService,
} from '../../../../client/application/diagnostics/checks/pythonInterpreter';
import { CommandOption, IDiagnosticsCommandFactory } from '../../../../client/application/diagnostics/commands/types';
import { DiagnosticCodes } from '../../../../client/application/diagnostics/constants';
import {
    DiagnosticCommandPromptHandlerServiceId,
    MessageCommandPrompt,
} from '../../../../client/application/diagnostics/promptHandler';
import {
    IDiagnostic,
    IDiagnosticCommand,
    IDiagnosticHandlerService,
    IDiagnosticsService,
} from '../../../../client/application/diagnostics/types';
import { CommandsWithoutArgs } from '../../../../client/common/application/commands';
import { IPlatformService } from '../../../../client/common/platform/types';
import { IConfigurationService, IDisposableRegistry, IPythonSettings } from '../../../../client/common/types';
import { noop } from '../../../../client/common/utils/misc';
import { IInterpreterHelper, IInterpreterService } from '../../../../client/interpreter/contracts';
import { IServiceContainer } from '../../../../client/ioc/types';
import { EnvironmentType } from '../../../../client/pythonEnvironments/info';

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
        serviceContainer
            .setup((s) =>
                s.get(
                    typemoq.It.isValue(IDiagnosticHandlerService),
                    typemoq.It.isValue(DiagnosticCommandPromptHandlerServiceId),
                ),
            )
            .returns(() => messageHandler.object);
        commandFactory = typemoq.Mock.ofType<IDiagnosticsCommandFactory>();
        serviceContainer
            .setup((s) => s.get(typemoq.It.isValue(IDiagnosticsCommandFactory)))
            .returns(() => commandFactory.object);
        settings = typemoq.Mock.ofType<IPythonSettings>();
        settings.setup((s) => s.pythonPath).returns(() => pythonPath);
        const configService = typemoq.Mock.ofType<IConfigurationService>();
        configService.setup((c) => c.getSettings(typemoq.It.isAny())).returns(() => settings.object);
        serviceContainer
            .setup((s) => s.get(typemoq.It.isValue(IConfigurationService)))
            .returns(() => configService.object);
        interpreterService = typemoq.Mock.ofType<IInterpreterService>();
        serviceContainer
            .setup((s) => s.get(typemoq.It.isValue(IInterpreterService)))
            .returns(() => interpreterService.object);
        platformService = typemoq.Mock.ofType<IPlatformService>();
        serviceContainer
            .setup((s) => s.get(typemoq.It.isValue(IPlatformService)))
            .returns(() => platformService.object);
        helper = typemoq.Mock.ofType<IInterpreterHelper>();
        serviceContainer.setup((s) => s.get(typemoq.It.isValue(IInterpreterHelper))).returns(() => helper.object);
        serviceContainer.setup((s) => s.get(typemoq.It.isValue(IDisposableRegistry))).returns(() => []);
        return serviceContainer.object;
    }
    suite('Diagnostics', () => {
        setup(() => {
            diagnosticService = new (class extends InvalidPythonInterpreterService {
                public _clear() {
                    while (BaseDiagnosticsService.handledDiagnosticCodeKeys.length > 0) {
                        BaseDiagnosticsService.handledDiagnosticCodeKeys.shift();
                    }
                }
                protected addPythonPathChangedHandler() {
                    noop();
                }
            })(createContainer(), []);
            (diagnosticService as any)._clear();
        });

        test('Can handle InvalidPythonPathInterpreter diagnostics', async () => {
            for (const code of [
                DiagnosticCodes.NoPythonInterpretersDiagnostic,
                DiagnosticCodes.NoCurrentlySelectedPythonInterpreterDiagnostic,
            ]) {
                const diagnostic = typemoq.Mock.ofType<IDiagnostic>();
                diagnostic
                    .setup((d) => d.code)
                    .returns(() => code)
                    .verifiable(typemoq.Times.atLeastOnce());

                const canHandle = await diagnosticService.canHandle(diagnostic.object);
                expect(canHandle).to.be.equal(true, `Should be able to handle ${code}`);
                diagnostic.verifyAll();
            }
        });
        test('Can not handle non-InvalidPythonPathInterpreter diagnostics', async () => {
            const diagnostic = typemoq.Mock.ofType<IDiagnostic>();
            diagnostic
                .setup((d) => d.code)
                .returns(() => 'Something Else' as any)
                .verifiable(typemoq.Times.atLeastOnce());

            const canHandle = await diagnosticService.canHandle(diagnostic.object);
            expect(canHandle).to.be.equal(false, 'Invalid value');
            diagnostic.verifyAll();
        });
        test('Should return diagnostics if there are no interpreters after double-checking', async () => {
            interpreterService
                .setup((i) => i.hasInterpreters())
                .returns(() => Promise.resolve(false))
                .verifiable(typemoq.Times.once());
            interpreterService
                .setup((i) => i.getInterpreters(undefined))
                .returns(() => [])
                .verifiable(typemoq.Times.once());

            const diagnostics = await diagnosticService.diagnose(undefined);
            expect(diagnostics).to.be.deep.equal(
                [new InvalidPythonInterpreterDiagnostic(DiagnosticCodes.NoPythonInterpretersDiagnostic, undefined)],
                'not the same',
            );
        });
        test('Should return invalid diagnostics if there are interpreters but no current interpreter', async () => {
            interpreterService
                .setup((i) => i.hasInterpreters())
                .returns(() => Promise.resolve(true))
                .verifiable(typemoq.Times.once());
            interpreterService
                .setup((i) => i.getActiveInterpreter(typemoq.It.isAny()))
                .returns(() => {
                    return Promise.resolve(undefined);
                })
                .verifiable(typemoq.Times.once());

            const diagnostics = await diagnosticService.diagnose(undefined);
            expect(diagnostics).to.be.deep.equal(
                [
                    new InvalidPythonInterpreterDiagnostic(
                        DiagnosticCodes.NoCurrentlySelectedPythonInterpreterDiagnostic,
                        undefined,
                    ),
                ],
                'not the same',
            );
            settings.verifyAll();
            interpreterService.verifyAll();
        });
        test('Should return empty diagnostics if there are interpreters and a current interpreter', async () => {
            interpreterService
                .setup((i) => i.hasInterpreters())
                .returns(() => Promise.resolve(true))
                .verifiable(typemoq.Times.once());
            interpreterService
                .setup((i) => i.getActiveInterpreter(typemoq.It.isAny()))
                .returns(() => {
                    return Promise.resolve({ envType: EnvironmentType.Unknown } as any);
                })
                .verifiable(typemoq.Times.once());

            const diagnostics = await diagnosticService.diagnose(undefined);
            expect(diagnostics).to.be.deep.equal([], 'not the same');
            settings.verifyAll();
            interpreterService.verifyAll();
        });
        test('Handling no interpreters diagnostic should return download link', async () => {
            const diagnostic = new InvalidPythonInterpreterDiagnostic(
                DiagnosticCodes.NoPythonInterpretersDiagnostic,
                undefined,
            );
            const cmd = ({} as any) as IDiagnosticCommand;
            let messagePrompt: MessageCommandPrompt | undefined;
            messageHandler
                .setup((i) => i.handle(typemoq.It.isValue(diagnostic), typemoq.It.isAny()))
                .callback((_d, p: MessageCommandPrompt) => (messagePrompt = p))
                .returns(() => Promise.resolve())
                .verifiable(typemoq.Times.once());
            commandFactory
                .setup((f) =>
                    f.createCommand(
                        typemoq.It.isAny(),
                        typemoq.It.isObjectWith<CommandOption<'launch', string>>({ type: 'launch' }),
                    ),
                )
                .returns(() => cmd)
                .verifiable(typemoq.Times.once());

            await diagnosticService.handle([diagnostic]);

            messageHandler.verifyAll();
            commandFactory.verifyAll();
            expect(messagePrompt).not.be.equal(undefined, 'Message prompt not set');
            expect(messagePrompt!.commandPrompts).to.be.deep.equal([{ prompt: 'Download', command: cmd }]);
            expect(messagePrompt!.onClose).to.not.be.equal(undefined, 'onClose handler should be set.');
        });
        test('Handling no currently selected interpreter diagnostic should show select interpreter message', async () => {
            const diagnostic = new InvalidPythonInterpreterDiagnostic(
                DiagnosticCodes.NoCurrentlySelectedPythonInterpreterDiagnostic,
                undefined,
            );
            const cmd = ({} as any) as IDiagnosticCommand;
            let messagePrompt: MessageCommandPrompt | undefined;
            messageHandler
                .setup((i) => i.handle(typemoq.It.isValue(diagnostic), typemoq.It.isAny()))
                .callback((_d, p: MessageCommandPrompt) => (messagePrompt = p))
                .returns(() => Promise.resolve())
                .verifiable(typemoq.Times.once());
            commandFactory
                .setup((f) =>
                    f.createCommand(
                        typemoq.It.isAny(),
                        typemoq.It.isObjectWith<CommandOption<'executeVSCCommand', CommandsWithoutArgs>>({
                            type: 'executeVSCCommand',
                        }),
                    ),
                )
                .returns(() => cmd)
                .verifiable(typemoq.Times.once());

            await diagnosticService.handle([diagnostic]);

            messageHandler.verifyAll();
            commandFactory.verifyAll();
            expect(messagePrompt).not.be.equal(undefined, 'Message prompt not set');
            expect(messagePrompt!.onClose).be.equal(undefined, 'onClose handler should not be set.');
            expect(messagePrompt!.commandPrompts).to.be.deep.equal([
                { prompt: 'Select Python Interpreter', command: cmd },
            ]);
        });
        test('Handling no interpreters diagnostic should return select interpreter cmd', async () => {
            const diagnostic = new InvalidPythonInterpreterDiagnostic(
                DiagnosticCodes.NoCurrentlySelectedPythonInterpreterDiagnostic,
                undefined,
            );
            const cmd = ({} as any) as IDiagnosticCommand;
            let messagePrompt: MessageCommandPrompt | undefined;
            messageHandler
                .setup((i) => i.handle(typemoq.It.isValue(diagnostic), typemoq.It.isAny()))
                .callback((_d, p: MessageCommandPrompt) => (messagePrompt = p))
                .returns(() => Promise.resolve())
                .verifiable(typemoq.Times.once());
            commandFactory
                .setup((f) =>
                    f.createCommand(
                        typemoq.It.isAny(),
                        typemoq.It.isObjectWith<CommandOption<'executeVSCCommand', CommandsWithoutArgs>>({
                            type: 'executeVSCCommand',
                        }),
                    ),
                )
                .returns(() => cmd)
                .verifiable(typemoq.Times.once());

            await diagnosticService.handle([diagnostic]);

            messageHandler.verifyAll();
            commandFactory.verifyAll();
            expect(messagePrompt).not.be.equal(undefined, 'Message prompt not set');
            expect(messagePrompt!.onClose).be.equal(undefined, 'onClose handler should not be set.');
            expect(messagePrompt!.commandPrompts).to.be.deep.equal([
                { prompt: 'Select Python Interpreter', command: cmd },
            ]);
        });
        test('Handling an empty diagnostic should not show a message nor return a command', async () => {
            const diagnostics: IDiagnostic[] = [];
            const cmd = ({} as any) as IDiagnosticCommand;

            messageHandler
                .setup((i) => i.handle(typemoq.It.isAny(), typemoq.It.isAny()))
                .callback((_d, p: MessageCommandPrompt) => p)
                .returns(() => Promise.resolve())
                .verifiable(typemoq.Times.never());
            commandFactory
                .setup((f) =>
                    f.createCommand(
                        typemoq.It.isAny(),
                        typemoq.It.isObjectWith<CommandOption<'executeVSCCommand', CommandsWithoutArgs>>({
                            type: 'executeVSCCommand',
                        }),
                    ),
                )
                .returns(() => cmd)
                .verifiable(typemoq.Times.never());

            await diagnosticService.handle(diagnostics);

            messageHandler.verifyAll();
            commandFactory.verifyAll();
        });
        test('Handling an unsupported diagnostic code should not show a message nor return a command', async () => {
            const diagnostic = new InvalidPythonInterpreterDiagnostic(
                DiagnosticCodes.NoCurrentlySelectedPythonInterpreterDiagnostic,
                undefined,
            );
            const cmd = ({} as any) as IDiagnosticCommand;
            const diagnosticServiceMock = (typemoq.Mock.ofInstance(diagnosticService) as any) as typemoq.IMock<
                InvalidPythonInterpreterService
            >;

            diagnosticServiceMock.setup((f) => f.canHandle(typemoq.It.isAny())).returns(() => Promise.resolve(false));
            messageHandler
                .setup((i) => i.handle(typemoq.It.isAny(), typemoq.It.isAny()))
                .callback((_d, p: MessageCommandPrompt) => p)
                .returns(() => Promise.resolve())
                .verifiable(typemoq.Times.never());
            commandFactory
                .setup((f) =>
                    f.createCommand(
                        typemoq.It.isAny(),
                        typemoq.It.isObjectWith<CommandOption<'executeVSCCommand', CommandsWithoutArgs>>({
                            type: 'executeVSCCommand',
                        }),
                    ),
                )
                .returns(() => cmd)
                .verifiable(typemoq.Times.never());

            await diagnosticServiceMock.object.handle([diagnostic]);

            messageHandler.verifyAll();
            commandFactory.verifyAll();
        });
        test('Getting command prompts for an unsupported diagnostic code should throw an error', async () => {
            const diagnostic = new InvalidLaunchJsonDebuggerDiagnostic(DiagnosticCodes.JustMyCodeDiagnostic, undefined);
            const cmd = ({} as any) as IDiagnosticCommand;

            messageHandler
                .setup((i) => i.handle(typemoq.It.isAny(), typemoq.It.isAny()))
                .callback((_d, p: MessageCommandPrompt) => p)
                .returns(() => Promise.resolve())
                .verifiable(typemoq.Times.never());
            commandFactory
                .setup((f) =>
                    f.createCommand(
                        typemoq.It.isAny(),
                        typemoq.It.isObjectWith<CommandOption<'executeVSCCommand', CommandsWithoutArgs>>({
                            type: 'executeVSCCommand',
                        }),
                    ),
                )
                .returns(() => cmd)
                .verifiable(typemoq.Times.never());

            try {
                await diagnosticService.handle([diagnostic]);
            } catch (err) {
                expect((err as Error).message).to.be.equal(
                    "Invalid diagnostic for 'InvalidPythonInterpreterService'",
                    'Error message is different',
                );
            }

            messageHandler.verifyAll();
            commandFactory.verifyAll();
        });
    });
});
