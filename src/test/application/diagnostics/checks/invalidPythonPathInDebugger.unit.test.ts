// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-invalid-template-strings max-func-body-length no-any

import { expect } from 'chai';
import * as path from 'path';
import * as typemoq from 'typemoq';
import { Uri } from 'vscode';
import { BaseDiagnosticsService } from '../../../../client/application/diagnostics/base';
import { InvalidPythonPathInDebuggerService } from '../../../../client/application/diagnostics/checks/invalidPythonPathInDebugger';
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
    IInvalidPythonPathInDebuggerService,
} from '../../../../client/application/diagnostics/types';
import { CommandsWithoutArgs } from '../../../../client/common/application/commands';
import { IDocumentManager, IWorkspaceService } from '../../../../client/common/application/types';
import { IConfigurationService, IPythonSettings } from '../../../../client/common/types';
import { PythonPathSource } from '../../../../client/debugger/extension/types';
import { IInterpreterHelper } from '../../../../client/interpreter/contracts';
import { IServiceContainer } from '../../../../client/ioc/types';

suite('Application Diagnostics - Checks Python Path in debugger', () => {
    let diagnosticService: IInvalidPythonPathInDebuggerService;
    let messageHandler: typemoq.IMock<IDiagnosticHandlerService<MessageCommandPrompt>>;
    let commandFactory: typemoq.IMock<IDiagnosticsCommandFactory>;
    let configService: typemoq.IMock<IConfigurationService>;
    let helper: typemoq.IMock<IInterpreterHelper>;
    let workspaceService: typemoq.IMock<IWorkspaceService>;
    let docMgr: typemoq.IMock<IDocumentManager>;
    setup(() => {
        const serviceContainer = typemoq.Mock.ofType<IServiceContainer>();
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
        docMgr = typemoq.Mock.ofType<IDocumentManager>();
        serviceContainer
            .setup((s) => s.get(typemoq.It.isValue(IDiagnosticsCommandFactory)))
            .returns(() => commandFactory.object);
        configService = typemoq.Mock.ofType<IConfigurationService>();
        serviceContainer
            .setup((s) => s.get(typemoq.It.isValue(IConfigurationService)))
            .returns(() => configService.object);
        helper = typemoq.Mock.ofType<IInterpreterHelper>();
        serviceContainer.setup((s) => s.get(typemoq.It.isValue(IInterpreterHelper))).returns(() => helper.object);
        workspaceService = typemoq.Mock.ofType<IWorkspaceService>();
        serviceContainer
            .setup((s) => s.get(typemoq.It.isValue(IWorkspaceService)))
            .returns(() => workspaceService.object);

        diagnosticService = new (class extends InvalidPythonPathInDebuggerService {
            public _clear() {
                while (BaseDiagnosticsService.handledDiagnosticCodeKeys.length > 0) {
                    BaseDiagnosticsService.handledDiagnosticCodeKeys.shift();
                }
            }
        })(
            serviceContainer.object,
            workspaceService.object,
            commandFactory.object,
            helper.object,
            docMgr.object,
            configService.object,
            [],
            messageHandler.object,
        );
        (diagnosticService as any)._clear();
    });

    test('Can handle InvalidPythonPathInDebugger diagnostics', async () => {
        for (const code of [
            DiagnosticCodes.InvalidPythonPathInDebuggerSettingsDiagnostic,
            DiagnosticCodes.InvalidPythonPathInDebuggerLaunchDiagnostic,
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
    test('Can not handle non-InvalidPythonPathInDebugger diagnostics', async () => {
        const diagnostic = typemoq.Mock.ofType<IDiagnostic>();
        diagnostic
            .setup((d) => d.code)
            .returns(() => 'Something Else' as any)
            .verifiable(typemoq.Times.atLeastOnce());

        const canHandle = await diagnosticService.canHandle(diagnostic.object);
        expect(canHandle).to.be.equal(false, 'Invalid value');
        diagnostic.verifyAll();
    });
    test('Should return empty diagnostics', async () => {
        const diagnostics = await diagnosticService.diagnose(undefined);
        expect(diagnostics).to.be.deep.equal([]);
    });
    test('InvalidPythonPathInDebuggerSettings diagnostic should display one option to with a command', async () => {
        const diagnostic = typemoq.Mock.ofType<IDiagnostic>();
        diagnostic
            .setup((d) => d.code)
            .returns(() => DiagnosticCodes.InvalidPythonPathInDebuggerSettingsDiagnostic)
            .verifiable(typemoq.Times.atLeastOnce());
        const interpreterSelectionCommand = typemoq.Mock.ofType<IDiagnosticCommand>();
        commandFactory
            .setup((f) =>
                f.createCommand(
                    typemoq.It.isAny(),
                    typemoq.It.isObjectWith<CommandOption<'executeVSCCommand', CommandsWithoutArgs>>({
                        type: 'executeVSCCommand',
                    }),
                ),
            )
            .returns(() => interpreterSelectionCommand.object)
            .verifiable(typemoq.Times.once());
        messageHandler.setup((m) => m.handle(typemoq.It.isAny(), typemoq.It.isAny())).verifiable(typemoq.Times.once());

        await diagnosticService.handle([diagnostic.object]);

        diagnostic.verifyAll();
        commandFactory.verifyAll();
        messageHandler.verifyAll();
    });
    test('InvalidPythonPathInDebuggerSettings diagnostic should display message once if invoked twice', async () => {
        const diagnostic = typemoq.Mock.ofType<IDiagnostic>();
        diagnostic
            .setup((d) => d.code)
            .returns(() => DiagnosticCodes.InvalidPythonPathInDebuggerSettingsDiagnostic)
            .verifiable(typemoq.Times.atLeastOnce());
        diagnostic
            .setup((d) => d.invokeHandler)
            .returns(() => 'default')
            .verifiable(typemoq.Times.atLeastOnce());
        const interpreterSelectionCommand = typemoq.Mock.ofType<IDiagnosticCommand>();
        commandFactory
            .setup((f) =>
                f.createCommand(
                    typemoq.It.isAny(),
                    typemoq.It.isObjectWith<CommandOption<'executeVSCCommand', CommandsWithoutArgs>>({
                        type: 'executeVSCCommand',
                    }),
                ),
            )
            .returns(() => interpreterSelectionCommand.object)
            .verifiable(typemoq.Times.exactly(1));
        messageHandler
            .setup((m) => m.handle(typemoq.It.isAny(), typemoq.It.isAny()))
            .verifiable(typemoq.Times.exactly(1));

        await diagnosticService.handle([diagnostic.object]);
        await diagnosticService.handle([diagnostic.object]);

        diagnostic.verifyAll();
        commandFactory.verifyAll();
        messageHandler.verifyAll();
    });
    test('InvalidPythonPathInDebuggerSettings diagnostic should display message twice if invoked twice', async () => {
        const diagnostic = typemoq.Mock.ofType<IDiagnostic>();
        diagnostic
            .setup((d) => d.code)
            .returns(() => DiagnosticCodes.InvalidPythonPathInDebuggerSettingsDiagnostic)
            .verifiable(typemoq.Times.atLeastOnce());
        diagnostic
            .setup((d) => d.invokeHandler)
            .returns(() => 'always')
            .verifiable(typemoq.Times.atLeastOnce());
        const interpreterSelectionCommand = typemoq.Mock.ofType<IDiagnosticCommand>();
        commandFactory
            .setup((f) =>
                f.createCommand(
                    typemoq.It.isAny(),
                    typemoq.It.isObjectWith<CommandOption<'executeVSCCommand', CommandsWithoutArgs>>({
                        type: 'executeVSCCommand',
                    }),
                ),
            )
            .returns(() => interpreterSelectionCommand.object)
            .verifiable(typemoq.Times.exactly(2));
        messageHandler
            .setup((m) => m.handle(typemoq.It.isAny(), typemoq.It.isAny()))
            .verifiable(typemoq.Times.exactly(2));

        await diagnosticService.handle([diagnostic.object]);
        await diagnosticService.handle([diagnostic.object]);

        diagnostic.verifyAll();
        commandFactory.verifyAll();
        messageHandler.verifyAll();
    });
    test('InvalidPythonPathInDebuggerLaunch diagnostic should display one option to with a command', async () => {
        const diagnostic = typemoq.Mock.ofType<IDiagnostic>();
        let options: MessageCommandPrompt | undefined;
        diagnostic
            .setup((d) => d.code)
            .returns(() => DiagnosticCodes.InvalidPythonPathInDebuggerLaunchDiagnostic)
            .verifiable(typemoq.Times.atLeastOnce());
        messageHandler
            .setup((m) => m.handle(typemoq.It.isAny(), typemoq.It.isAny()))
            .callback((_, opts: MessageCommandPrompt) => (options = opts))
            .verifiable(typemoq.Times.once());

        await diagnosticService.handle([diagnostic.object]);

        diagnostic.verifyAll();
        commandFactory.verifyAll();
        messageHandler.verifyAll();
        expect(options!.commandPrompts).to.be.lengthOf(1);
        expect(options!.commandPrompts[0].prompt).to.be.equal('Open launch.json');
    });
    test('Ensure we get python path from config when path = ${command:python.interpreterPath}', async () => {
        const pythonPath = '${command:python.interpreterPath}';

        const settings = typemoq.Mock.ofType<IPythonSettings>();
        settings
            .setup((s) => s.pythonPath)
            .returns(() => 'p')
            .verifiable(typemoq.Times.once());
        configService
            .setup((c) => c.getSettings(typemoq.It.isAny()))
            .returns(() => settings.object)
            .verifiable(typemoq.Times.once());
        helper
            .setup((h) => h.getInterpreterInformation(typemoq.It.isValue('p')))
            .returns(() => Promise.resolve({}))
            .verifiable(typemoq.Times.once());

        const valid = await diagnosticService.validatePythonPath(pythonPath);

        settings.verifyAll();
        configService.verifyAll();
        helper.verifyAll();
        expect(valid).to.be.equal(true, 'not valid');
    });
    test('Ensure ${workspaceFolder} is not expanded when a resource is not passed', async () => {
        const pythonPath = '${workspaceFolder}/venv/bin/python';

        workspaceService
            .setup((c) => c.getWorkspaceFolder(typemoq.It.isAny()))
            .returns(() => undefined)
            .verifiable(typemoq.Times.never());
        helper
            .setup((h) => h.getInterpreterInformation(typemoq.It.isAny()))
            .returns(() => Promise.resolve({}))
            .verifiable(typemoq.Times.once());

        await diagnosticService.validatePythonPath(pythonPath);

        configService.verifyAll();
        helper.verifyAll();
    });
    test('Ensure ${workspaceFolder} is expanded', async () => {
        const pythonPath = '${workspaceFolder}/venv/bin/python';

        const workspaceFolder = { uri: Uri.parse('full/path/to/workspace'), name: '', index: 0 };
        const expectedPath = `${workspaceFolder.uri.fsPath}/venv/bin/python`;

        workspaceService
            .setup((c) => c.getWorkspaceFolder(typemoq.It.isAny()))
            .returns(() => workspaceFolder)
            .verifiable(typemoq.Times.once());
        helper
            .setup((h) => h.getInterpreterInformation(typemoq.It.isValue(expectedPath)))
            .returns(() => Promise.resolve({}))
            .verifiable(typemoq.Times.once());

        const valid = await diagnosticService.validatePythonPath(
            pythonPath,
            PythonPathSource.settingsJson,
            Uri.parse('something'),
        );

        configService.verifyAll();
        helper.verifyAll();
        expect(valid).to.be.equal(true, 'not valid');
    });
    test('Ensure ${env:XYZ123} is expanded', async () => {
        const pythonPath = '${env:XYZ123}/venv/bin/python';

        process.env.XYZ123 = 'something/else';
        const expectedPath = `${process.env.XYZ123}/venv/bin/python`;
        workspaceService
            .setup((c) => c.getWorkspaceFolder(typemoq.It.isAny()))
            .returns(() => undefined)
            .verifiable(typemoq.Times.once());
        helper
            .setup((h) => h.getInterpreterInformation(typemoq.It.isValue(expectedPath)))
            .returns(() => Promise.resolve({}))
            .verifiable(typemoq.Times.once());

        const valid = await diagnosticService.validatePythonPath(pythonPath);

        configService.verifyAll();
        helper.verifyAll();
        expect(valid).to.be.equal(true, 'not valid');
    });
    test('Ensure we get python path from config when path = undefined', async () => {
        const pythonPath = undefined;

        const settings = typemoq.Mock.ofType<IPythonSettings>();
        settings
            .setup((s) => s.pythonPath)
            .returns(() => 'p')
            .verifiable(typemoq.Times.once());
        configService
            .setup((c) => c.getSettings(typemoq.It.isAny()))
            .returns(() => settings.object)
            .verifiable(typemoq.Times.once());
        helper
            .setup((h) => h.getInterpreterInformation(typemoq.It.isValue('p')))
            .returns(() => Promise.resolve({}))
            .verifiable(typemoq.Times.once());

        const valid = await diagnosticService.validatePythonPath(pythonPath);

        settings.verifyAll();
        configService.verifyAll();
        helper.verifyAll();
        expect(valid).to.be.equal(true, 'not valid');
    });
    test('Ensure we do not get python path from config when path is provided', async () => {
        const pythonPath = path.join('a', 'b');

        const settings = typemoq.Mock.ofType<IPythonSettings>();
        configService
            .setup((c) => c.getSettings(typemoq.It.isAny()))
            .returns(() => settings.object)
            .verifiable(typemoq.Times.never());
        helper
            .setup((h) => h.getInterpreterInformation(typemoq.It.isValue(pythonPath)))
            .returns(() => Promise.resolve({}))
            .verifiable(typemoq.Times.once());

        const valid = await diagnosticService.validatePythonPath(pythonPath);

        configService.verifyAll();
        helper.verifyAll();
        expect(valid).to.be.equal(true, 'not valid');
    });
    test('Ensure InvalidPythonPathInDebuggerLaunch diagnostic is handled when path is invalid in launch.json', async () => {
        const pythonPath = path.join('a', 'b');
        const settings = typemoq.Mock.ofType<IPythonSettings>();
        configService
            .setup((c) => c.getSettings(typemoq.It.isAny()))
            .returns(() => settings.object)
            .verifiable(typemoq.Times.never());
        let handleInvoked = false;
        diagnosticService.handle = (diagnostics) => {
            if (
                diagnostics.length !== 0 &&
                diagnostics[0].code === DiagnosticCodes.InvalidPythonPathInDebuggerLaunchDiagnostic
            ) {
                handleInvoked = true;
            }
            return Promise.resolve();
        };
        helper
            .setup((h) => h.getInterpreterInformation(typemoq.It.isValue(pythonPath)))
            .returns(() => Promise.resolve(undefined))
            .verifiable(typemoq.Times.once());

        const valid = await diagnosticService.validatePythonPath(pythonPath, PythonPathSource.launchJson);

        helper.verifyAll();
        expect(valid).to.be.equal(false, 'should be invalid');
        expect(handleInvoked).to.be.equal(true, 'should be invoked');
    });
    test('Ensure InvalidPythonPathInDebuggerSettings diagnostic is handled when path is invalid in settings.json', async () => {
        const pythonPath = undefined;
        const settings = typemoq.Mock.ofType<IPythonSettings>();
        settings
            .setup((s) => s.pythonPath)
            .returns(() => 'p')
            .verifiable(typemoq.Times.once());
        configService
            .setup((c) => c.getSettings(typemoq.It.isAny()))
            .returns(() => settings.object)
            .verifiable(typemoq.Times.once());
        let handleInvoked = false;
        diagnosticService.handle = (diagnostics) => {
            if (
                diagnostics.length !== 0 &&
                diagnostics[0].code === DiagnosticCodes.InvalidPythonPathInDebuggerSettingsDiagnostic
            ) {
                handleInvoked = true;
            }
            return Promise.resolve();
        };
        helper
            .setup((h) => h.getInterpreterInformation(typemoq.It.isValue('p')))
            .returns(() => Promise.resolve(undefined))
            .verifiable(typemoq.Times.once());

        const valid = await diagnosticService.validatePythonPath(pythonPath, PythonPathSource.settingsJson);

        helper.verifyAll();
        expect(valid).to.be.equal(false, 'should be invalid');
        expect(handleInvoked).to.be.equal(true, 'should be invoked');
    });
});
