// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length no-any max-classes-per-file

import { assert, expect } from 'chai';
import * as typemoq from 'typemoq';
import { DiagnosticSeverity, Extension, Uri, WorkspaceConfiguration } from 'vscode';
import { BaseDiagnostic, BaseDiagnosticsService } from '../../../../client/application/diagnostics/base';
import {
    UpgradeCodeRunnerDiagnostic,
    UpgradeCodeRunnerDiagnosticService,
} from '../../../../client/application/diagnostics/checks/upgradeCodeRunner';
import { CommandOption, IDiagnosticsCommandFactory } from '../../../../client/application/diagnostics/commands/types';
import { DiagnosticCodes } from '../../../../client/application/diagnostics/constants';
import {
    DiagnosticCommandPromptHandlerServiceId,
    MessageCommandPrompt,
} from '../../../../client/application/diagnostics/promptHandler';
import {
    DiagnosticScope,
    IDiagnostic,
    IDiagnosticCommand,
    IDiagnosticFilterService,
    IDiagnosticHandlerService,
} from '../../../../client/application/diagnostics/types';
import { IWorkspaceService } from '../../../../client/common/application/types';
import { CODE_RUNNER_EXTENSION_ID } from '../../../../client/common/constants';
import { DeprecatePythonPath } from '../../../../client/common/experiments/groups';
import { IDisposableRegistry, IExperimentsManager, IExtensions, Resource } from '../../../../client/common/types';
import { Common, Diagnostics } from '../../../../client/common/utils/localize';
import { IServiceContainer } from '../../../../client/ioc/types';

suite('Application Diagnostics - Upgrade Code Runner', () => {
    const resource = Uri.parse('a');
    let diagnosticService: UpgradeCodeRunnerDiagnosticService;
    let messageHandler: typemoq.IMock<IDiagnosticHandlerService<MessageCommandPrompt>>;
    let commandFactory: typemoq.IMock<IDiagnosticsCommandFactory>;
    let workspaceService: typemoq.IMock<IWorkspaceService>;
    let filterService: typemoq.IMock<IDiagnosticFilterService>;
    let serviceContainer: typemoq.IMock<IServiceContainer>;
    let experimentsManager: typemoq.IMock<IExperimentsManager>;
    let extensions: typemoq.IMock<IExtensions>;
    function createContainer() {
        extensions = typemoq.Mock.ofType<IExtensions>();
        serviceContainer = typemoq.Mock.ofType<IServiceContainer>();
        experimentsManager = typemoq.Mock.ofType<IExperimentsManager>();
        filterService = typemoq.Mock.ofType<IDiagnosticFilterService>();
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
            .setup((s) => s.get(typemoq.It.isValue(IExperimentsManager)))
            .returns(() => experimentsManager.object);
        serviceContainer
            .setup((s) => s.get(typemoq.It.isValue(IDiagnosticFilterService)))
            .returns(() => filterService.object);
        serviceContainer
            .setup((s) => s.get(typemoq.It.isValue(IDiagnosticsCommandFactory)))
            .returns(() => commandFactory.object);
        workspaceService = typemoq.Mock.ofType<IWorkspaceService>();
        serviceContainer
            .setup((s) => s.get(typemoq.It.isValue(IWorkspaceService)))
            .returns(() => workspaceService.object);
        serviceContainer.setup((s) => s.get(typemoq.It.isValue(IDisposableRegistry))).returns(() => []);
        return serviceContainer.object;
    }
    suite('Diagnostics', () => {
        setup(() => {
            diagnosticService = new (class extends UpgradeCodeRunnerDiagnosticService {
                public _clear() {
                    while (BaseDiagnosticsService.handledDiagnosticCodeKeys.length > 0) {
                        BaseDiagnosticsService.handledDiagnosticCodeKeys.shift();
                    }
                }
            })(createContainer(), messageHandler.object, [], extensions.object);
            (diagnosticService as any)._clear();
        });

        test('Can handle UpgradeCodeRunnerDiagnostic diagnostics', async () => {
            const diagnostic = typemoq.Mock.ofType<IDiagnostic>();
            diagnostic
                .setup((d) => d.code)
                .returns(() => DiagnosticCodes.UpgradeCodeRunnerDiagnostic)
                .verifiable(typemoq.Times.atLeastOnce());

            const canHandle = await diagnosticService.canHandle(diagnostic.object);
            expect(canHandle).to.be.equal(
                true,
                `Should be able to handle ${DiagnosticCodes.UpgradeCodeRunnerDiagnostic}`,
            );
            diagnostic.verifyAll();
        });

        test('Can not handle non-UpgradeCodeRunnerDiagnostic diagnostics', async () => {
            const diagnostic = typemoq.Mock.ofType<IDiagnostic>();
            diagnostic
                .setup((d) => d.code)
                .returns(() => 'Something Else' as any)
                .verifiable(typemoq.Times.atLeastOnce());

            const canHandle = await diagnosticService.canHandle(diagnostic.object);
            expect(canHandle).to.be.equal(false, 'Invalid value');
            diagnostic.verifyAll();
        });

        test('Should not display a message if the diagnostic code has been ignored', async () => {
            const diagnostic = typemoq.Mock.ofType<IDiagnostic>();

            filterService
                .setup((f) => f.shouldIgnoreDiagnostic(typemoq.It.isValue(DiagnosticCodes.UpgradeCodeRunnerDiagnostic)))
                .returns(() => Promise.resolve(true))
                .verifiable(typemoq.Times.once());
            diagnostic
                .setup((d) => d.code)
                .returns(() => DiagnosticCodes.UpgradeCodeRunnerDiagnostic)
                .verifiable(typemoq.Times.atLeastOnce());
            commandFactory
                .setup((f) => f.createCommand(typemoq.It.isAny(), typemoq.It.isAny()))
                .verifiable(typemoq.Times.never());
            messageHandler
                .setup((m) => m.handle(typemoq.It.isAny(), typemoq.It.isAny()))
                .verifiable(typemoq.Times.never());

            await diagnosticService.handle([diagnostic.object]);

            filterService.verifyAll();
            diagnostic.verifyAll();
            commandFactory.verifyAll();
            messageHandler.verifyAll();
        });

        test('UpgradeCodeRunnerDiagnostic is handled as expected', async () => {
            const diagnostic = new UpgradeCodeRunnerDiagnostic('message', resource);
            const ignoreCmd = ({ cmd: 'ignoreCmd' } as any) as IDiagnosticCommand;
            filterService
                .setup((f) => f.shouldIgnoreDiagnostic(typemoq.It.isValue(DiagnosticCodes.UpgradeCodeRunnerDiagnostic)))
                .returns(() => Promise.resolve(false));
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
                        typemoq.It.isObjectWith<CommandOption<'ignore', DiagnosticScope>>({ type: 'ignore' }),
                    ),
                )
                .returns(() => ignoreCmd)
                .verifiable(typemoq.Times.once());

            await diagnosticService.handle([diagnostic]);

            messageHandler.verifyAll();
            commandFactory.verifyAll();
            expect(messagePrompt).not.be.equal(undefined, 'Message prompt not set');
            expect(messagePrompt!.commandPrompts.length).to.equal(1, 'Incorrect length');
            expect(messagePrompt!.commandPrompts[0]).to.be.deep.equal({
                prompt: Common.doNotShowAgain(),
                command: ignoreCmd,
            });
        });

        test('Handling an empty diagnostic should not show a message nor return a command', async () => {
            const diagnostics: IDiagnostic[] = [];

            messageHandler
                .setup((i) => i.handle(typemoq.It.isAny(), typemoq.It.isAny()))
                .callback((_d, p: MessageCommandPrompt) => p)
                .returns(() => Promise.resolve())
                .verifiable(typemoq.Times.never());
            commandFactory
                .setup((f) => f.createCommand(typemoq.It.isAny(), typemoq.It.isAny()))
                .verifiable(typemoq.Times.never());

            await diagnosticService.handle(diagnostics);

            messageHandler.verifyAll();
            commandFactory.verifyAll();
        });

        test('Handling an unsupported diagnostic code should not show a message nor return a command', async () => {
            const diagnostic = new (class SomeRandomDiagnostic extends BaseDiagnostic {
                constructor(message: string, uri: Resource) {
                    super(
                        'SomeRandomDiagnostic' as any,
                        message,
                        DiagnosticSeverity.Information,
                        DiagnosticScope.WorkspaceFolder,
                        uri,
                    );
                }
            })('message', undefined);
            messageHandler
                .setup((i) => i.handle(typemoq.It.isAny(), typemoq.It.isAny()))
                .callback((_d, p: MessageCommandPrompt) => p)
                .returns(() => Promise.resolve())
                .verifiable(typemoq.Times.never());
            commandFactory
                .setup((f) => f.createCommand(typemoq.It.isAny(), typemoq.It.isAny()))
                .verifiable(typemoq.Times.never());

            await diagnosticService.handle([diagnostic]);

            messageHandler.verifyAll();
            commandFactory.verifyAll();
        });

        test('If a diagnostic has already been returned, empty diagnostics is returned', async () => {
            diagnosticService._diagnosticReturned = false;

            const diagnostics = await diagnosticService.diagnose(resource);

            assert.deepEqual(diagnostics, []);
        });

        test('If not in DeprecatePythonPath experiment, empty diagnostics is returned', async () => {
            experimentsManager.setup((e) => e.inExperiment(DeprecatePythonPath.experiment)).returns(() => false);
            experimentsManager
                .setup((e) => e.sendTelemetryIfInExperiment(DeprecatePythonPath.control))
                .returns(() => undefined);

            const diagnostics = await diagnosticService.diagnose(resource);

            assert.deepEqual(diagnostics, []);
        });

        test('If Code Runner extension is not installed, empty diagnostics is returned', async () => {
            experimentsManager.setup((e) => e.inExperiment(DeprecatePythonPath.experiment)).returns(() => true);
            experimentsManager
                .setup((e) => e.sendTelemetryIfInExperiment(DeprecatePythonPath.control))
                .returns(() => undefined);
            extensions.setup((e) => e.getExtension(CODE_RUNNER_EXTENSION_ID)).returns(() => undefined);

            const diagnostics = await diagnosticService.diagnose(resource);

            assert.deepEqual(diagnostics, []);
        });

        test('If Code Runner extension is installed but the appropriate feature flag is set in package.json, empty diagnostics is returned', async () => {
            experimentsManager.setup((e) => e.inExperiment(DeprecatePythonPath.experiment)).returns(() => true);
            experimentsManager
                .setup((e) => e.sendTelemetryIfInExperiment(DeprecatePythonPath.control))
                .returns(() => undefined);
            const extension = typemoq.Mock.ofType<Extension<any>>();
            extensions.setup((e) => e.getExtension(CODE_RUNNER_EXTENSION_ID)).returns(() => extension.object);
            extension
                .setup((e) => e.packageJSON)
                .returns(() => ({
                    featureFlags: {
                        usingNewPythonInterpreterPathApiV2: true,
                    },
                }));
            workspaceService
                .setup((w) => w.getConfiguration('code-runner', resource))
                .verifiable(typemoq.Times.never());

            const diagnostics = await diagnosticService.diagnose(resource);

            assert.deepEqual(diagnostics, []);
            workspaceService.verifyAll();
        });

        test('If old version of Code Runner extension is installed but setting `code-runner.executorMap.python` is not set, empty diagnostics is returned', async () => {
            experimentsManager.setup((e) => e.inExperiment(DeprecatePythonPath.experiment)).returns(() => true);
            experimentsManager
                .setup((e) => e.sendTelemetryIfInExperiment(DeprecatePythonPath.control))
                .returns(() => undefined);
            const workspaceConfig = typemoq.Mock.ofType<WorkspaceConfiguration>();
            const extension = typemoq.Mock.ofType<Extension<any>>();
            extensions.setup((e) => e.getExtension(CODE_RUNNER_EXTENSION_ID)).returns(() => extension.object);
            extension.setup((e) => e.packageJSON).returns(() => undefined);
            workspaceService
                .setup((w) => w.getConfiguration('code-runner', resource))
                .returns(() => workspaceConfig.object)
                .verifiable(typemoq.Times.once());
            workspaceConfig.setup((w) => w.get<string>('executorMap.python')).returns(() => undefined);

            const diagnostics = await diagnosticService.diagnose(resource);

            assert.deepEqual(diagnostics, []);
            workspaceService.verifyAll();
        });

        test('If old version of Code Runner extension is installed but $pythonPath is not being used, empty diagnostics is returned', async () => {
            experimentsManager.setup((e) => e.inExperiment(DeprecatePythonPath.experiment)).returns(() => true);
            experimentsManager
                .setup((e) => e.sendTelemetryIfInExperiment(DeprecatePythonPath.control))
                .returns(() => undefined);
            const workspaceConfig = typemoq.Mock.ofType<WorkspaceConfiguration>();
            const extension = typemoq.Mock.ofType<Extension<any>>();
            extensions.setup((e) => e.getExtension(CODE_RUNNER_EXTENSION_ID)).returns(() => extension.object);
            extension.setup((e) => e.packageJSON).returns(() => undefined);
            workspaceService
                .setup((w) => w.getConfiguration('code-runner', resource))
                .returns(() => workspaceConfig.object)
                .verifiable(typemoq.Times.once());
            workspaceConfig.setup((w) => w.get<string>('executorMap.python')).returns(() => 'Random string');

            const diagnostics = await diagnosticService.diagnose(resource);

            assert.deepEqual(diagnostics, []);
            workspaceService.verifyAll();
        });

        test('If old version of Code Runner extension is installed and $pythonPath is being used, diagnostic with appropriate message is returned', async () => {
            experimentsManager.setup((e) => e.inExperiment(DeprecatePythonPath.experiment)).returns(() => true);
            experimentsManager
                .setup((e) => e.sendTelemetryIfInExperiment(DeprecatePythonPath.control))
                .returns(() => undefined);
            const workspaceConfig = typemoq.Mock.ofType<WorkspaceConfiguration>();
            const extension = typemoq.Mock.ofType<Extension<any>>();
            extensions.setup((e) => e.getExtension(CODE_RUNNER_EXTENSION_ID)).returns(() => extension.object);
            extension.setup((e) => e.packageJSON).returns(() => undefined);
            workspaceService
                .setup((w) => w.getConfiguration('code-runner', resource))
                .returns(() => workspaceConfig.object)
                .verifiable(typemoq.Times.once());
            workspaceConfig
                .setup((w) => w.get<string>('executorMap.python'))
                .returns(() => 'This string contains $pythonPath');

            const diagnostics = await diagnosticService.diagnose(resource);

            expect(diagnostics.length).to.equal(1);
            expect(diagnostics[0].message).to.equal(Diagnostics.upgradeCodeRunner());
            expect(diagnostics[0].resource).to.equal(resource);
            expect(diagnosticService._diagnosticReturned).to.equal(true, '');

            workspaceService.verifyAll();
        });
    });
});
