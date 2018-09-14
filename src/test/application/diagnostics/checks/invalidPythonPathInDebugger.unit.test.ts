// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-invalid-template-strings max-func-body-length

import { expect } from 'chai';
import * as path from 'path';
import * as typemoq from 'typemoq';
import { InvalidPythonPathInDebuggerService } from '../../../../client/application/diagnostics/checks/invalidPythonPathInDebugger';
import { CommandOption, IDiagnosticsCommandFactory } from '../../../../client/application/diagnostics/commands/types';
import { DiagnosticCodes } from '../../../../client/application/diagnostics/constants';
import { DiagnosticCommandPromptHandlerServiceId, MessageCommandPrompt } from '../../../../client/application/diagnostics/promptHandler';
import { IDiagnostic, IDiagnosticCommand, IDiagnosticHandlerService, IInvalidPythonPathInDebuggerService } from '../../../../client/application/diagnostics/types';
import { IConfigurationService, IPythonSettings } from '../../../../client/common/types';
import { IInterpreterHelper } from '../../../../client/interpreter/contracts';
import { IServiceContainer } from '../../../../client/ioc/types';

suite('Application Diagnostics - Checks Python Path in debugger', () => {
    let diagnosticService: IInvalidPythonPathInDebuggerService;
    let messageHandler: typemoq.IMock<IDiagnosticHandlerService<MessageCommandPrompt>>;
    let commandFactory: typemoq.IMock<IDiagnosticsCommandFactory>;
    let configService: typemoq.IMock<IConfigurationService>;
    let helper: typemoq.IMock<IInterpreterHelper>;
    setup(() => {
        const serviceContainer = typemoq.Mock.ofType<IServiceContainer>();
        messageHandler = typemoq.Mock.ofType<IDiagnosticHandlerService<MessageCommandPrompt>>();
        serviceContainer.setup(s => s.get(typemoq.It.isValue(IDiagnosticHandlerService), typemoq.It.isValue(DiagnosticCommandPromptHandlerServiceId)))
            .returns(() => messageHandler.object);
        commandFactory = typemoq.Mock.ofType<IDiagnosticsCommandFactory>();
        serviceContainer.setup(s => s.get(typemoq.It.isValue(IDiagnosticsCommandFactory)))
            .returns(() => commandFactory.object);
        configService = typemoq.Mock.ofType<IConfigurationService>();
        serviceContainer.setup(s => s.get(typemoq.It.isValue(IConfigurationService)))
            .returns(() => configService.object);
        helper = typemoq.Mock.ofType<IInterpreterHelper>();
        serviceContainer.setup(s => s.get(typemoq.It.isValue(IInterpreterHelper)))
            .returns(() => helper.object);

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
    test('Ensure we get python path from config when path = ${config:python.pythonPath}', async () => {
        const pythonPath = '${config:python.pythonPath}';

        const settings = typemoq.Mock.ofType<IPythonSettings>();
        settings
            .setup(s => s.pythonPath)
            .returns(() => 'p')
            .verifiable(typemoq.Times.once());
        configService
            .setup(c => c.getSettings(typemoq.It.isAny()))
            .returns(() => settings.object)
            .verifiable(typemoq.Times.once());
        helper
            .setup(h => h.getInterpreterInformation(typemoq.It.isValue('p')))
            .returns(() => Promise.resolve({}))
            .verifiable(typemoq.Times.once());

        const valid = await diagnosticService.validatePythonPath(pythonPath);

        settings.verifyAll();
        configService.verifyAll();
        helper.verifyAll();
        expect(valid).to.be.equal(true, 'not valid');
    });
    test('Ensure we get python path from config when path = undefined', async () => {
        const pythonPath = undefined;

        const settings = typemoq.Mock.ofType<IPythonSettings>();
        settings
            .setup(s => s.pythonPath)
            .returns(() => 'p')
            .verifiable(typemoq.Times.once());
        configService
            .setup(c => c.getSettings(typemoq.It.isAny()))
            .returns(() => settings.object)
            .verifiable(typemoq.Times.once());
        helper
            .setup(h => h.getInterpreterInformation(typemoq.It.isValue('p')))
            .returns(() => Promise.resolve({}))
            .verifiable(typemoq.Times.once());

        const valid = await diagnosticService.validatePythonPath(pythonPath);

        settings.verifyAll();
        configService.verifyAll();
        helper.verifyAll();
        expect(valid).to.be.equal(true, 'not valid');
    });
    test('Ensure we do get python path from config when path is provided', async () => {
        const pythonPath = path.join('a', 'b');

        const settings = typemoq.Mock.ofType<IPythonSettings>();
        configService
            .setup(c => c.getSettings(typemoq.It.isAny()))
            .returns(() => settings.object)
            .verifiable(typemoq.Times.never());
        helper
            .setup(h => h.getInterpreterInformation(typemoq.It.isValue(pythonPath)))
            .returns(() => Promise.resolve({}))
            .verifiable(typemoq.Times.once());

        const valid = await diagnosticService.validatePythonPath(pythonPath);

        configService.verifyAll();
        helper.verifyAll();
        expect(valid).to.be.equal(true, 'not valid');
    });
    test('Ensure diagnosics are handled when path is invalid', async () => {
        const pythonPath = path.join('a', 'b');
        let handleInvoked = false;
        diagnosticService.handle = () => { handleInvoked = true; return Promise.resolve(); };
        helper
            .setup(h => h.getInterpreterInformation(typemoq.It.isValue(pythonPath)))
            .returns(() => Promise.resolve(undefined))
            .verifiable(typemoq.Times.once());

        const valid = await diagnosticService.validatePythonPath(pythonPath);

        helper.verifyAll();
        expect(valid).to.be.equal(false, 'should be invalid');
        expect(handleInvoked).to.be.equal(true, 'should be invoked');
    });
});
