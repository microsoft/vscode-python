// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length no-any max-classes-per-file

import { assert, expect } from 'chai';
import * as sinon from 'sinon';
import * as typemoq from 'typemoq';
import { DiagnosticSeverity, Uri } from 'vscode';
import { BaseDiagnostic, BaseDiagnosticsService } from '../../../../client/application/diagnostics/base';
import {
    PythonPathDeprecatedDiagnostic,
    PythonPathDeprecatedDiagnosticService
} from '../../../../client/application/diagnostics/checks/pythonPathDeprecated';
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
    IDiagnosticHandlerService
} from '../../../../client/application/diagnostics/types';
import { IWorkspaceService } from '../../../../client/common/application/types';
import { IDisposableRegistry, Resource } from '../../../../client/common/types';
import { Common } from '../../../../client/common/utils/localize';
import { IServiceContainer } from '../../../../client/ioc/types';

suite('Application Diagnostics - Python Path Deprecated', () => {
    let diagnosticService: PythonPathDeprecatedDiagnosticService;
    let messageHandler: typemoq.IMock<IDiagnosticHandlerService<MessageCommandPrompt>>;
    let commandFactory: typemoq.IMock<IDiagnosticsCommandFactory>;
    let workspaceService: typemoq.IMock<IWorkspaceService>;
    let filterService: typemoq.IMock<IDiagnosticFilterService>;
    let serviceContainer: typemoq.IMock<IServiceContainer>;
    function createContainer() {
        serviceContainer = typemoq.Mock.ofType<IServiceContainer>();
        filterService = typemoq.Mock.ofType<IDiagnosticFilterService>();
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
            diagnosticService = new (class extends PythonPathDeprecatedDiagnosticService {
                public _clear() {
                    while (BaseDiagnosticsService.handledDiagnosticCodeKeys.length > 0) {
                        BaseDiagnosticsService.handledDiagnosticCodeKeys.shift();
                    }
                }
            })(createContainer(), messageHandler.object, []);
            (diagnosticService as any)._clear();
        });

        teardown(() => {
            sinon.restore();
        });

        test('Can handle PythonPathDeprecatedDiagnostic diagnostics', async () => {
            const diagnostic = typemoq.Mock.ofType<IDiagnostic>();
            diagnostic
                .setup((d) => d.code)
                .returns(() => DiagnosticCodes.PythonPathDeprecatedDiagnostic)
                .verifiable(typemoq.Times.atLeastOnce());

            const canHandle = await diagnosticService.canHandle(diagnostic.object);
            expect(canHandle).to.be.equal(
                true,
                `Should be able to handle ${DiagnosticCodes.PythonPathDeprecatedDiagnostic}`
            );
            diagnostic.verifyAll();
        });
        test('Can not handle non-PythonPathDeprecatedDiagnostic diagnostics', async () => {
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
                .setup((f) =>
                    f.shouldIgnoreDiagnostic(typemoq.It.isValue(DiagnosticCodes.PythonPathDeprecatedDiagnostic))
                )
                .returns(() => Promise.resolve(true))
                .verifiable(typemoq.Times.once());
            diagnostic
                .setup((d) => d.code)
                .returns(() => DiagnosticCodes.PythonPathDeprecatedDiagnostic)
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
        test('Python Path Deprecated Diagnostic is handled as expected', async () => {
            const resource = Uri.parse('a');
            const diagnostic = new PythonPathDeprecatedDiagnostic('message', resource);
            const launchCmd = ({ cmd: 'launchCmd' } as any) as IDiagnosticCommand;
            const ignoreCmd = ({ cmd: 'ignoreCmd' } as any) as IDiagnosticCommand;
            filterService
                .setup((f) =>
                    f.shouldIgnoreDiagnostic(typemoq.It.isValue(DiagnosticCodes.PythonPathDeprecatedDiagnostic))
                )
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
                        typemoq.It.isObjectWith<CommandOption<'launch', string>>({ type: 'launch' })
                    )
                )
                .returns(() => launchCmd)
                .verifiable(typemoq.Times.once());

            commandFactory
                .setup((f) =>
                    f.createCommand(
                        typemoq.It.isAny(),
                        typemoq.It.isObjectWith<CommandOption<'ignore', DiagnosticScope>>({ type: 'ignore' })
                    )
                )
                .returns(() => ignoreCmd)
                .verifiable(typemoq.Times.once());

            await diagnosticService.handle([diagnostic]);

            messageHandler.verifyAll();
            commandFactory.verifyAll();
            expect(messagePrompt).not.be.equal(undefined, 'Message prompt not set');
            expect(messagePrompt!.commandPrompts.length).to.equal(4, 'Incorrect length');
            expect(messagePrompt!.commandPrompts[0].command).not.be.equal(undefined, 'Command not set');
            expect(messagePrompt!.commandPrompts[0].command!.diagnostic).to.be.deep.equal(diagnostic);
            expect(messagePrompt!.commandPrompts[0].prompt).to.be.deep.equal(Common.yesPlease());
            expect(messagePrompt!.commandPrompts[1]).to.be.deep.equal({ prompt: Common.noIWillDoItLater() });
            expect(messagePrompt!.commandPrompts[2]).to.be.deep.equal({
                prompt: Common.moreInfo(),
                command: launchCmd
            });
            expect(messagePrompt!.commandPrompts[3]).to.be.deep.equal({
                prompt: Common.doNotShowAgain(),
                command: ignoreCmd
            });

            const _removePythonPathFromWorkspaceSettings = sinon.stub(
                PythonPathDeprecatedDiagnosticService.prototype,
                '_removePythonPathFromWorkspaceSettings'
            );
            _removePythonPathFromWorkspaceSettings.resolves();
            await messagePrompt!.commandPrompts[0].command!.invoke();
            assert(_removePythonPathFromWorkspaceSettings.calledOnceWith(resource));
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
                constructor(message: string, resource: Resource) {
                    super(
                        'SomeRandomDiagnostic' as any,
                        message,
                        DiagnosticSeverity.Information,
                        DiagnosticScope.WorkspaceFolder,
                        resource
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
    });
});
