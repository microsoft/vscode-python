// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length no-any max-classes-per-file

import { assert, expect } from 'chai';
import * as typemoq from 'typemoq';
import { ConfigurationChangeEvent, Uri } from 'vscode';
import { BaseDiagnosticsService } from '../../../../client/application/diagnostics/base';
import {
    InvalidMacPythonInterpreterDiagnostic,
    InvalidMacPythonInterpreterService
} from '../../../../client/application/diagnostics/checks/macPythonInterpreter';
import { CommandOption, IDiagnosticsCommandFactory } from '../../../../client/application/diagnostics/commands/types';
import { DiagnosticCodes } from '../../../../client/application/diagnostics/constants';
import {
    DiagnosticCommandPromptHandlerServiceId,
    MessageCommandPrompt
} from '../../../../client/application/diagnostics/promptHandler';
import {
    DiagnosticScope,
    IDiagnostic,
    IDiagnosticCommand,
    IDiagnosticFilterService,
    IDiagnosticHandlerService,
    IDiagnosticsService
} from '../../../../client/application/diagnostics/types';
import { CommandsWithoutArgs } from '../../../../client/common/application/commands';
import { IWorkspaceService } from '../../../../client/common/application/types';
import { DeprecatePythonPath } from '../../../../client/common/experiments/groups';
import { IPlatformService } from '../../../../client/common/platform/types';
import {
    IConfigurationService,
    IDisposableRegistry,
    IExperimentsManager,
    IInterpreterPathService,
    InterpreterConfigurationScope,
    IPythonSettings,
    Resource
} from '../../../../client/common/types';
import { sleep } from '../../../../client/common/utils/async';
import { noop } from '../../../../client/common/utils/misc';
import { IInterpreterHelper, IInterpreterService } from '../../../../client/interpreter/contracts';
import { IServiceContainer } from '../../../../client/ioc/types';
import { EnvironmentType } from '../../../../client/pythonEnvironments/info';

suite('Application Diagnostics - Checks Mac Python Interpreter', () => {
    let diagnosticService: IDiagnosticsService;
    let messageHandler: typemoq.IMock<IDiagnosticHandlerService<MessageCommandPrompt>>;
    let commandFactory: typemoq.IMock<IDiagnosticsCommandFactory>;
    let settings: typemoq.IMock<IPythonSettings>;
    let interpreterService: typemoq.IMock<IInterpreterService>;
    let platformService: typemoq.IMock<IPlatformService>;
    let helper: typemoq.IMock<IInterpreterHelper>;
    let filterService: typemoq.IMock<IDiagnosticFilterService>;
    const pythonPath = 'My Python Path in Settings';
    let serviceContainer: typemoq.IMock<IServiceContainer>;
    function createContainer() {
        serviceContainer = typemoq.Mock.ofType<IServiceContainer>();
        messageHandler = typemoq.Mock.ofType<IDiagnosticHandlerService<MessageCommandPrompt>>();
        serviceContainer
            .setup((s) =>
                s.get(
                    typemoq.It.isValue(IDiagnosticHandlerService),
                    typemoq.It.isValue(DiagnosticCommandPromptHandlerServiceId)
                )
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
        filterService = typemoq.Mock.ofType<IDiagnosticFilterService>();
        serviceContainer
            .setup((s) => s.get(typemoq.It.isValue(IDiagnosticFilterService)))
            .returns(() => filterService.object);

        platformService
            .setup((p) => p.isMac)
            .returns(() => true)
            .verifiable(typemoq.Times.once());
        return serviceContainer.object;
    }
    suite('Diagnostics', () => {
        setup(() => {
            diagnosticService = new (class extends InvalidMacPythonInterpreterService {
                public _clear() {
                    while (BaseDiagnosticsService.handledDiagnosticCodeKeys.length > 0) {
                        BaseDiagnosticsService.handledDiagnosticCodeKeys.shift();
                    }
                }
                protected addPythonPathChangedHandler() {
                    noop();
                }
            })(createContainer(), interpreterService.object, [], platformService.object, helper.object);
            (diagnosticService as any)._clear();
        });

        test('Can handle InvalidPythonPathInterpreter diagnostics', async () => {
            for (const code of [
                DiagnosticCodes.MacInterpreterSelectedAndHaveOtherInterpretersDiagnostic,
                DiagnosticCodes.MacInterpreterSelectedAndNoOtherInterpretersDiagnostic
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
        test('Should return empty diagnostics if not a Mac', async () => {
            platformService.reset();
            platformService
                .setup((p) => p.isMac)
                .returns(() => true)
                .verifiable(typemoq.Times.once());

            const diagnostics = await diagnosticService.diagnose(undefined);
            expect(diagnostics).to.be.deep.equal([]);
            platformService.verifyAll();
        });
        test('Should return empty diagnostics if installer check is disabled', async () => {
            settings
                .setup((s) => s.disableInstallationChecks)
                .returns(() => true)
                .verifiable(typemoq.Times.once());

            const diagnostics = await diagnosticService.diagnose(undefined);
            expect(diagnostics).to.be.deep.equal([]);
            settings.verifyAll();
            platformService.verifyAll();
        });
        test('Should return empty diagnostics if there are interpreters, one is selected, and platform is not mac', async () => {
            settings
                .setup((s) => s.disableInstallationChecks)
                .returns(() => false)
                .verifiable(typemoq.Times.once());
            interpreterService
                .setup((i) => i.hasInterpreters)
                .returns(() => Promise.resolve(true))
                .verifiable(typemoq.Times.once());
            interpreterService
                .setup((i) => i.getInterpreters(typemoq.It.isAny()))
                .returns(() => Promise.resolve([{} as any]))
                .verifiable(typemoq.Times.never());
            interpreterService
                .setup((i) => i.getActiveInterpreter(typemoq.It.isAny()))
                .returns(() => {
                    return Promise.resolve({ envType: EnvironmentType.Unknown } as any);
                })
                .verifiable(typemoq.Times.once());
            platformService
                .setup((i) => i.isMac)
                .returns(() => false)
                .verifiable(typemoq.Times.once());

            const diagnostics = await diagnosticService.diagnose(undefined);
            expect(diagnostics).to.be.deep.equal([]);
            settings.verifyAll();
            interpreterService.verifyAll();
            platformService.verifyAll();
        });
        test('Should return empty diagnostics if there are interpreters, platform is mac and selected interpreter is not default mac interpreter', async () => {
            settings
                .setup((s) => s.disableInstallationChecks)
                .returns(() => false)
                .verifiable(typemoq.Times.once());
            interpreterService
                .setup((i) => i.hasInterpreters)
                .returns(() => Promise.resolve(true))
                .verifiable(typemoq.Times.once());
            interpreterService
                .setup((i) => i.getInterpreters(typemoq.It.isAny()))
                .returns(() => Promise.resolve([{} as any]))
                .verifiable(typemoq.Times.never());
            interpreterService
                .setup((i) => i.getActiveInterpreter(typemoq.It.isAny()))
                .returns(() => {
                    return Promise.resolve({ envType: EnvironmentType.Unknown } as any);
                })
                .verifiable(typemoq.Times.once());
            platformService
                .setup((i) => i.isMac)
                .returns(() => true)
                .verifiable(typemoq.Times.once());
            helper
                .setup((i) => i.isMacDefaultPythonPath(typemoq.It.isAny()))
                .returns(() => Promise.resolve(false))
                .verifiable(typemoq.Times.once());

            const diagnostics = await diagnosticService.diagnose(undefined);
            expect(diagnostics).to.be.deep.equal([]);
            settings.verifyAll();
            interpreterService.verifyAll();
            platformService.verifyAll();
            helper.verifyAll();
        });
        test('Should return diagnostic if there are no other interpreters, platform is mac and selected interpreter is default mac interpreter', async () => {
            settings
                .setup((s) => s.disableInstallationChecks)
                .returns(() => false)
                .verifiable(typemoq.Times.once());
            interpreterService
                .setup((i) => i.getInterpreters(typemoq.It.isAny()))
                .returns(() => Promise.resolve([{ path: pythonPath } as any, { path: pythonPath } as any]))
                .verifiable(typemoq.Times.once());
            interpreterService
                .setup((i) => i.getActiveInterpreter(typemoq.It.isAny()))
                .returns(() => {
                    return Promise.resolve({ envType: EnvironmentType.Unknown } as any);
                })
                .verifiable(typemoq.Times.once());
            platformService
                .setup((i) => i.isMac)
                .returns(() => true)
                .verifiable(typemoq.Times.once());
            helper
                .setup((i) => i.isMacDefaultPythonPath(typemoq.It.isValue(pythonPath)))
                .returns(() => Promise.resolve(true))
                .verifiable(typemoq.Times.atLeastOnce());

            const diagnostics = await diagnosticService.diagnose(undefined);
            expect(diagnostics).to.be.deep.equal(
                [
                    new InvalidMacPythonInterpreterDiagnostic(
                        DiagnosticCodes.MacInterpreterSelectedAndNoOtherInterpretersDiagnostic,
                        undefined
                    )
                ],
                'not the same'
            );
            settings.verifyAll();
            interpreterService.verifyAll();
            platformService.verifyAll();
            helper.verifyAll();
        });
        test('Should return diagnostic if there are other interpreters, platform is mac and selected interpreter is default mac interpreter', async () => {
            const nonMacStandardInterpreter = 'Non Mac Std Interpreter';
            settings
                .setup((s) => s.disableInstallationChecks)
                .returns(() => false)
                .verifiable(typemoq.Times.once());
            interpreterService
                .setup((i) => i.getInterpreters(typemoq.It.isAny()))
                .returns(() =>
                    Promise.resolve([
                        { path: pythonPath } as any,
                        { path: pythonPath } as any,
                        { path: nonMacStandardInterpreter } as any
                    ])
                )
                .verifiable(typemoq.Times.once());
            platformService
                .setup((i) => i.isMac)
                .returns(() => true)
                .verifiable(typemoq.Times.once());
            helper
                .setup((i) => i.isMacDefaultPythonPath(typemoq.It.isValue(pythonPath)))
                .returns(() => Promise.resolve(true))
                .verifiable(typemoq.Times.atLeastOnce());
            helper
                .setup((i) => i.isMacDefaultPythonPath(typemoq.It.isValue(nonMacStandardInterpreter)))
                .returns(() => Promise.resolve(false))
                .verifiable(typemoq.Times.atLeastOnce());
            interpreterService
                .setup((i) => i.getActiveInterpreter(typemoq.It.isAny()))
                .returns(() => {
                    return Promise.resolve({ envType: EnvironmentType.Unknown } as any);
                })
                .verifiable(typemoq.Times.once());

            const diagnostics = await diagnosticService.diagnose(undefined);
            expect(diagnostics).to.be.deep.equal(
                [
                    new InvalidMacPythonInterpreterDiagnostic(
                        DiagnosticCodes.MacInterpreterSelectedAndHaveOtherInterpretersDiagnostic,
                        undefined
                    )
                ],
                'not the same'
            );
            settings.verifyAll();
            interpreterService.verifyAll();
            platformService.verifyAll();
            helper.verifyAll();
        });
        test('Handling no interpreters diagnostic should return select interpreter cmd', async () => {
            const diagnostic = new InvalidMacPythonInterpreterDiagnostic(
                DiagnosticCodes.MacInterpreterSelectedAndHaveOtherInterpretersDiagnostic,
                undefined
            );
            const cmd = ({} as any) as IDiagnosticCommand;
            const cmdIgnore = ({} as any) as IDiagnosticCommand;
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
                            type: 'executeVSCCommand'
                        })
                    )
                )
                .returns(() => cmd)
                .verifiable(typemoq.Times.once());
            commandFactory
                .setup((f) =>
                    f.createCommand(
                        typemoq.It.isAny(),
                        typemoq.It.isObjectWith<CommandOption<'ignore', DiagnosticScope>>({
                            type: 'ignore',
                            options: DiagnosticScope.Global
                        })
                    )
                )
                .returns(() => cmdIgnore)
                .verifiable(typemoq.Times.once());

            await diagnosticService.handle([diagnostic]);

            messageHandler.verifyAll();
            commandFactory.verifyAll();
            expect(messagePrompt).not.be.equal(undefined, 'Message prompt not set');
            expect(messagePrompt!.commandPrompts).to.be.deep.equal([
                { prompt: 'Select Python Interpreter', command: cmd },
                { prompt: 'Do not show again', command: cmdIgnore }
            ]);
        });
        test('Handling no interpreters diagnostisc should return 3 commands', async () => {
            const diagnostic = new InvalidMacPythonInterpreterDiagnostic(
                DiagnosticCodes.MacInterpreterSelectedAndNoOtherInterpretersDiagnostic,
                undefined
            );
            const cmdDownload = ({} as any) as IDiagnosticCommand;
            const cmdLearn = ({} as any) as IDiagnosticCommand;
            const cmdIgnore = ({} as any) as IDiagnosticCommand;
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
                        typemoq.It.isObjectWith<CommandOption<'launch', string>>({
                            type: 'launch',
                            options: 'https://code.visualstudio.com/docs/python/python-tutorial#_prerequisites'
                        })
                    )
                )
                .returns(() => cmdLearn)
                .verifiable(typemoq.Times.once());
            commandFactory
                .setup((f) =>
                    f.createCommand(
                        typemoq.It.isAny(),
                        typemoq.It.isObjectWith<CommandOption<'launch', string>>({
                            type: 'launch',
                            options: 'https://www.python.org/downloads'
                        })
                    )
                )
                .returns(() => cmdDownload)
                .verifiable(typemoq.Times.once());
            commandFactory
                .setup((f) =>
                    f.createCommand(
                        typemoq.It.isAny(),
                        typemoq.It.isObjectWith<CommandOption<'ignore', DiagnosticScope>>({
                            type: 'ignore',
                            options: DiagnosticScope.Global
                        })
                    )
                )
                .returns(() => cmdIgnore)
                .verifiable(typemoq.Times.once());

            await diagnosticService.handle([diagnostic]);

            messageHandler.verifyAll();
            commandFactory.verifyAll();
            expect(messagePrompt).not.be.equal(undefined, 'Message prompt not set');
            expect(messagePrompt!.commandPrompts).to.be.deep.equal([
                { prompt: 'Learn more', command: cmdLearn },
                { prompt: 'Download', command: cmdDownload },
                { prompt: 'Do not show again', command: cmdIgnore }
            ]);
        });
        test('Should not display a message if No Interpreters diagnostic has been ignored', async () => {
            const diagnostic = new InvalidMacPythonInterpreterDiagnostic(
                DiagnosticCodes.MacInterpreterSelectedAndNoOtherInterpretersDiagnostic,
                undefined
            );

            filterService
                .setup((f) =>
                    f.shouldIgnoreDiagnostic(
                        typemoq.It.isValue(DiagnosticCodes.MacInterpreterSelectedAndNoOtherInterpretersDiagnostic)
                    )
                )
                .returns(() => Promise.resolve(true))
                .verifiable(typemoq.Times.once());
            commandFactory
                .setup((f) => f.createCommand(typemoq.It.isAny(), typemoq.It.isAny()))
                .verifiable(typemoq.Times.never());
            messageHandler
                .setup((f) => f.handle(typemoq.It.isAny(), typemoq.It.isAny()))
                .verifiable(typemoq.Times.never());

            await diagnosticService.handle([diagnostic]);

            messageHandler.verifyAll();
            filterService.verifyAll();
            commandFactory.verifyAll();
        });
    });

    suite('Change Handlers.', () => {
        test('Add PythonPath handler is invoked', async () => {
            let invoked = false;
            diagnosticService = new (class extends InvalidMacPythonInterpreterService {
                protected addPythonPathChangedHandler() {
                    invoked = true;
                }
            })(createContainer(), interpreterService.object, [], platformService.object, helper.object);

            expect(invoked).to.be.equal(true, 'Not invoked');
        });
        test('Event Handler is registered and invoked', async () => {
            let invoked = false;
            let callbackHandler!: (e: ConfigurationChangeEvent) => Promise<void>;
            const workspaceService = {
                onDidChangeConfiguration: (cb: (e: ConfigurationChangeEvent) => Promise<void>) => (callbackHandler = cb)
            } as any;
            const serviceContainerObject = createContainer();

            serviceContainer.setup((s) => s.get(typemoq.It.isValue(IWorkspaceService))).returns(() => workspaceService);
            const experiments = typemoq.Mock.ofType<IExperimentsManager>();
            serviceContainer
                .setup((s) => s.get(typemoq.It.isValue(IExperimentsManager)))
                .returns(() => experiments.object);
            experiments.setup((e) => e.inExperiment(DeprecatePythonPath.experiment)).returns(() => false);
            experiments
                .setup((e) => e.sendTelemetryIfInExperiment(DeprecatePythonPath.control))
                .returns(() => undefined);
            diagnosticService = new (class extends InvalidMacPythonInterpreterService {
                protected async onDidChangeConfiguration(_event: ConfigurationChangeEvent) {
                    invoked = true;
                }
            })(serviceContainerObject, undefined as any, [], undefined as any, undefined as any);

            await callbackHandler({} as any);
            expect(invoked).to.be.equal(true, 'Not invoked');
        });
        test('Event Handler is registered and not invoked', async () => {
            let invoked = false;
            const workspaceService = { onDidChangeConfiguration: noop } as any;
            const serviceContainerObject = createContainer();
            serviceContainer.setup((s) => s.get(typemoq.It.isValue(IWorkspaceService))).returns(() => workspaceService);
            const experiments = typemoq.Mock.ofType<IExperimentsManager>();
            serviceContainer
                .setup((s) => s.get(typemoq.It.isValue(IExperimentsManager)))
                .returns(() => experiments.object);
            experiments.setup((e) => e.inExperiment(DeprecatePythonPath.experiment)).returns(() => false);
            experiments
                .setup((e) => e.sendTelemetryIfInExperiment(DeprecatePythonPath.control))
                .returns(() => undefined);
            diagnosticService = new (class extends InvalidMacPythonInterpreterService {
                protected async onDidChangeConfiguration(_event: ConfigurationChangeEvent) {
                    invoked = true;
                }
            })(serviceContainerObject, undefined as any, [], undefined as any, undefined as any);

            expect(invoked).to.be.equal(false, 'Not invoked');
        });
        test('Diagnostics are checked with Config change event uri when path changes and event is passed', async () => {
            const event = typemoq.Mock.ofType<ConfigurationChangeEvent>();
            const workspaceService = typemoq.Mock.ofType<IWorkspaceService>();
            const serviceContainerObject = createContainer();
            let diagnoseInvocationCount = 0;
            workspaceService
                .setup((w) => w.hasWorkspaceFolders)
                .returns(() => true)
                .verifiable(typemoq.Times.once());
            workspaceService
                .setup((w) => w.workspaceFolders)
                .returns(() => [{ uri: '' }] as any)
                .verifiable(typemoq.Times.once());
            serviceContainer
                .setup((s) => s.get(typemoq.It.isValue(IWorkspaceService)))
                .returns(() => workspaceService.object);
            const experiments = typemoq.Mock.ofType<IExperimentsManager>();
            serviceContainer
                .setup((s) => s.get(typemoq.It.isValue(IExperimentsManager)))
                .returns(() => experiments.object);
            experiments.setup((e) => e.inExperiment(DeprecatePythonPath.experiment)).returns(() => false);
            experiments
                .setup((e) => e.sendTelemetryIfInExperiment(DeprecatePythonPath.control))
                .returns(() => undefined);
            const diagnosticSvc = new (class extends InvalidMacPythonInterpreterService {
                constructor(
                    arg1: IServiceContainer,
                    arg2: IInterpreterService,
                    arg3: IPlatformService,
                    arg4: IInterpreterHelper
                ) {
                    super(arg1, arg2, [], arg3, arg4);
                    this.changeThrottleTimeout = 1;
                }
                public onDidChangeConfigurationEx = (e: ConfigurationChangeEvent) => super.onDidChangeConfiguration(e);
                public diagnose(): Promise<any> {
                    diagnoseInvocationCount += 1;
                    return Promise.resolve();
                }
            })(
                serviceContainerObject,
                typemoq.Mock.ofType<IInterpreterService>().object,
                typemoq.Mock.ofType<IPlatformService>().object,
                typemoq.Mock.ofType<IInterpreterHelper>().object
            );

            event
                .setup((e) => e.affectsConfiguration(typemoq.It.isValue('python.pythonPath'), typemoq.It.isAny()))
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

        test('Diagnostics are checked with correct interpreter config uri when path changes and only config uri is passed', async () => {
            const configUri = Uri.parse('i');
            const interpreterConfigurationScope = typemoq.Mock.ofType<InterpreterConfigurationScope>();
            interpreterConfigurationScope.setup((i) => i.uri).returns(() => Uri.parse('i'));
            const workspaceService = typemoq.Mock.ofType<IWorkspaceService>();
            const serviceContainerObject = createContainer();
            let diagnoseInvocationCount = 0;
            serviceContainer
                .setup((s) => s.get(typemoq.It.isValue(IWorkspaceService)))
                .returns(() => workspaceService.object);
            const experiments = typemoq.Mock.ofType<IExperimentsManager>();
            serviceContainer
                .setup((s) => s.get(typemoq.It.isValue(IExperimentsManager)))
                .returns(() => experiments.object);
            experiments.setup((e) => e.inExperiment(DeprecatePythonPath.experiment)).returns(() => false);
            experiments
                .setup((e) => e.sendTelemetryIfInExperiment(DeprecatePythonPath.control))
                .returns(() => undefined);
            const diagnosticSvc = new (class extends InvalidMacPythonInterpreterService {
                constructor(
                    arg1: IServiceContainer,
                    arg2: IInterpreterService,
                    arg3: IPlatformService,
                    arg4: IInterpreterHelper
                ) {
                    super(arg1, arg2, [], arg3, arg4);
                    this.changeThrottleTimeout = 1;
                }
                public onDidChangeConfigurationEx = (e?: ConfigurationChangeEvent, i?: InterpreterConfigurationScope) =>
                    super.onDidChangeConfiguration(e, i);
                public diagnose(resource: Resource): Promise<any> {
                    diagnoseInvocationCount += 1;
                    assert.deepEqual(resource, configUri);
                    return Promise.resolve();
                }
            })(
                serviceContainerObject,
                typemoq.Mock.ofType<IInterpreterService>().object,
                typemoq.Mock.ofType<IPlatformService>().object,
                typemoq.Mock.ofType<IInterpreterHelper>().object
            );

            await diagnosticSvc.onDidChangeConfigurationEx(undefined, interpreterConfigurationScope.object);
            await sleep(100);
            expect(diagnoseInvocationCount).to.be.equal(1, 'Not invoked');

            await diagnosticSvc.onDidChangeConfigurationEx(undefined, interpreterConfigurationScope.object);
            await sleep(100);
            expect(diagnoseInvocationCount).to.be.equal(2, 'Not invoked');
        });

        test('Diagnostics throws error when none of config uri or config change event uri is passed', async () => {
            const workspaceService = typemoq.Mock.ofType<IWorkspaceService>();
            const serviceContainerObject = createContainer();
            serviceContainer
                .setup((s) => s.get(typemoq.It.isValue(IWorkspaceService)))
                .returns(() => workspaceService.object);
            const experiments = typemoq.Mock.ofType<IExperimentsManager>();
            serviceContainer
                .setup((s) => s.get(typemoq.It.isValue(IExperimentsManager)))
                .returns(() => experiments.object);
            experiments.setup((e) => e.inExperiment(DeprecatePythonPath.experiment)).returns(() => false);
            experiments
                .setup((e) => e.sendTelemetryIfInExperiment(DeprecatePythonPath.control))
                .returns(() => undefined);
            const diagnosticSvc = new (class extends InvalidMacPythonInterpreterService {
                constructor(
                    arg1: IServiceContainer,
                    arg2: IInterpreterService,
                    arg3: IPlatformService,
                    arg4: IInterpreterHelper
                ) {
                    super(arg1, arg2, [], arg3, arg4);
                    this.changeThrottleTimeout = 1;
                }
                public onDidChangeConfigurationEx = (e?: ConfigurationChangeEvent, i?: InterpreterConfigurationScope) =>
                    super.onDidChangeConfiguration(e, i);
            })(
                serviceContainerObject,
                typemoq.Mock.ofType<IInterpreterService>().object,
                typemoq.Mock.ofType<IPlatformService>().object,
                typemoq.Mock.ofType<IInterpreterHelper>().object
            );

            await expect(diagnosticSvc.onDidChangeConfigurationEx(undefined, undefined)).to.eventually.be.rejectedWith(
                Error
            );
        });

        test('Diagnostics are checked and throttled when path changes', async () => {
            const event = typemoq.Mock.ofType<ConfigurationChangeEvent>();
            const workspaceService = typemoq.Mock.ofType<IWorkspaceService>();
            const serviceContainerObject = createContainer();
            let diagnoseInvocationCount = 0;
            workspaceService
                .setup((w) => w.hasWorkspaceFolders)
                .returns(() => true)
                .verifiable(typemoq.Times.once());
            workspaceService
                .setup((w) => w.workspaceFolders)
                .returns(() => [{ uri: '' }] as any)
                .verifiable(typemoq.Times.once());
            serviceContainer
                .setup((s) => s.get(typemoq.It.isValue(IWorkspaceService)))
                .returns(() => workspaceService.object);
            const experiments = typemoq.Mock.ofType<IExperimentsManager>();
            serviceContainer
                .setup((s) => s.get(typemoq.It.isValue(IExperimentsManager)))
                .returns(() => experiments.object);
            experiments.setup((e) => e.inExperiment(DeprecatePythonPath.experiment)).returns(() => false);
            experiments
                .setup((e) => e.sendTelemetryIfInExperiment(DeprecatePythonPath.control))
                .returns(() => undefined);
            const diagnosticSvc = new (class extends InvalidMacPythonInterpreterService {
                constructor(
                    arg1: IServiceContainer,
                    arg2: IInterpreterService,
                    arg3: IPlatformService,
                    arg4: IInterpreterHelper
                ) {
                    super(arg1, arg2, [], arg3, arg4);
                    this.changeThrottleTimeout = 100;
                }
                public onDidChangeConfigurationEx = (e: ConfigurationChangeEvent) => super.onDidChangeConfiguration(e);
                public diagnose(): Promise<any> {
                    diagnoseInvocationCount += 1;
                    return Promise.resolve();
                }
            })(
                serviceContainerObject,
                typemoq.Mock.ofType<IInterpreterService>().object,
                typemoq.Mock.ofType<IPlatformService>().object,
                typemoq.Mock.ofType<IInterpreterHelper>().object
            );

            event
                .setup((e) => e.affectsConfiguration(typemoq.It.isValue('python.pythonPath'), typemoq.It.isAny()))
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

        test('Ensure event Handler is registered correctly if in Deprecate Python path experiment', async () => {
            let interpreterPathServiceHandler: Function;
            const workspaceService = { onDidChangeConfiguration: noop } as any;
            const serviceContainerObject = createContainer();

            const interpreterPathService = typemoq.Mock.ofType<IInterpreterPathService>();
            interpreterPathService
                .setup((d) => d.onDidChange(typemoq.It.isAny(), typemoq.It.isAny()))
                .callback((cb) => (interpreterPathServiceHandler = cb))
                .returns(() => {
                    return { dispose: noop };
                });
            serviceContainer
                .setup((s) => s.get(typemoq.It.isValue(IInterpreterPathService)))
                .returns(() => interpreterPathService.object);

            serviceContainer.setup((s) => s.get(typemoq.It.isValue(IWorkspaceService))).returns(() => workspaceService);
            const experiments = typemoq.Mock.ofType<IExperimentsManager>();
            serviceContainer
                .setup((s) => s.get(typemoq.It.isValue(IExperimentsManager)))
                .returns(() => experiments.object);
            experiments.setup((e) => e.inExperiment(DeprecatePythonPath.experiment)).returns(() => true);
            experiments
                .setup((e) => e.sendTelemetryIfInExperiment(DeprecatePythonPath.control))
                .returns(() => undefined);
            diagnosticService = new (class extends InvalidMacPythonInterpreterService {})(
                serviceContainerObject,
                undefined as any,
                [],
                undefined as any,
                undefined as any
            );

            expect(interpreterPathServiceHandler!).to.not.equal(undefined, 'Handler not set');
        });
    });
});
