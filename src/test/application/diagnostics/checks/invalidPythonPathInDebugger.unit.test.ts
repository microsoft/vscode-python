// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as typemoq from 'typemoq';
import { InvalidPythonPathInDebuggerService } from '../../../../client/application/diagnostics/checks/invalidPythonPathInDebugger';
import { CommandOption, IDiagnosticsCommandFactory } from '../../../../client/application/diagnostics/commands/types';
import { DiagnosticCodes } from '../../../../client/application/diagnostics/constants';
import { DiagnosticCommandPromptHandlerServiceId, MessageCommandPrompt } from '../../../../client/application/diagnostics/promptHandler';
import { IDiagnostic, IDiagnosticCommand, IDiagnosticHandlerService, IDiagnosticsService } from '../../../../client/application/diagnostics/types';
import { IServiceContainer } from '../../../../client/ioc/types';

// tslint:disable-next-line:max-func-body-length
suite('Application Diagnostics - Checks Python Path in debugger', () => {
    let diagnosticService: IDiagnosticsService;
    let messageHandler: typemoq.IMock<IDiagnosticHandlerService<MessageCommandPrompt>>;
    let commandFactory: typemoq.IMock<IDiagnosticsCommandFactory>;
    setup(() => {
        const serviceContainer = typemoq.Mock.ofType<IServiceContainer>();
        messageHandler = typemoq.Mock.ofType<IDiagnosticHandlerService<MessageCommandPrompt>>();
        serviceContainer.setup(s => s.get(typemoq.It.isValue(IDiagnosticHandlerService), typemoq.It.isValue(DiagnosticCommandPromptHandlerServiceId)))
            .returns(() => messageHandler.object);
        commandFactory = typemoq.Mock.ofType<IDiagnosticsCommandFactory>();
        serviceContainer.setup(s => s.get(typemoq.It.isValue(IDiagnosticsCommandFactory)))
            .returns(() => commandFactory.object);

        diagnosticService = new InvalidPythonPathInDebuggerService(serviceContainer.object);
    });

    test('Can handle InvalidPythonPathInDebugger diagnostics', async () => {
        const diagnostic = typemoq.Mock.ofType<IDiagnostic>();
        diagnostic.setup(d => d.code)
            .returns(() => DiagnosticCodes.InvalidPythonPathInDebuggerDiagnostic)
            .verifiable(typemoq.Times.atLeastOnce());

        const canHandle = await diagnosticService.canHandle(diagnostic.object);
        expect(canHandle).to.be.equal(true, 'Invalid value');
        diagnostic.verifyAll();
    });
    test('Can not handle non-InvalidPythonPathInDebugger diagnostics', async () => {
        const diagnostic = typemoq.Mock.ofType<IDiagnostic>();
        diagnostic.setup(d => d.code)
            .returns(() => 'Something Else')
            .verifiable(typemoq.Times.atLeastOnce());

        const canHandle = await diagnosticService.canHandle(diagnostic.object);
        expect(canHandle).to.be.equal(false, 'Invalid value');
        diagnostic.verifyAll();
    });
    test('Should return empty diagnostics', async () => {
        const diagnostics = await diagnosticService.diagnose();
        expect(diagnostics).to.be.deep.equal([]);
    });
    test('Should display one option to with a command', async () => {
        const diagnostic = typemoq.Mock.ofType<IDiagnostic>();
        diagnostic.setup(d => d.code)
            .returns(() => DiagnosticCodes.InvalidEnvironmentPathVariableDiagnostic)
            .verifiable(typemoq.Times.atLeastOnce());
        const interpreterSelectionCommand = typemoq.Mock.ofType<IDiagnosticCommand>();
        commandFactory.setup(f => f.createCommand(typemoq.It.isAny(),
            typemoq.It.isObjectWith<CommandOption<'executeVSCCommand', string>>({ type: 'executeVSCCommand' })))
            .returns(() => interpreterSelectionCommand.object)
            .verifiable(typemoq.Times.once());
        messageHandler.setup(m => m.handle(typemoq.It.isAny(), typemoq.It.isAny()))
            .verifiable(typemoq.Times.once());

        await diagnosticService.handle([diagnostic.object]);

        diagnostic.verifyAll();
        commandFactory.verifyAll();
        messageHandler.verifyAll();
    });
});
