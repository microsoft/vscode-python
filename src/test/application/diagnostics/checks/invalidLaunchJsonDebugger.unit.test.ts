// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { Uri, WorkspaceFolder } from 'vscode';
import { BaseDiagnosticsService } from '../../../../client/application/diagnostics/base';
import {
    InvalidLaunchJsonDebuggerDiagnostic,
    InvalidLaunchJsonDebuggerService,
} from '../../../../client/application/diagnostics/checks/invalidLaunchJsonDebugger';
import { IDiagnosticsCommandFactory } from '../../../../client/application/diagnostics/commands/types';
import { DiagnosticCodes } from '../../../../client/application/diagnostics/constants';
import { MessageCommandPrompt } from '../../../../client/application/diagnostics/promptHandler';
import {
    IDiagnostic,
    IDiagnosticHandlerService,
    IDiagnosticsService,
} from '../../../../client/application/diagnostics/types';
import { IWorkspaceService } from '../../../../client/common/application/types';
import { IFileSystem } from '../../../../client/common/platform/types';
import { Diagnostics } from '../../../../client/common/utils/localize';
import { IServiceContainer } from '../../../../client/ioc/types';

suite('Application Diagnostics - Checks if launch.json is invalid', () => {
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let diagnosticService: IDiagnosticsService;
    let commandFactory: TypeMoq.IMock<IDiagnosticsCommandFactory>;
    let fs: TypeMoq.IMock<IFileSystem>;
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    let baseWorkspaceService: TypeMoq.IMock<IWorkspaceService>;
    let messageHandler: TypeMoq.IMock<IDiagnosticHandlerService<MessageCommandPrompt>>;
    let workspaceFolder: WorkspaceFolder;
    setup(() => {
        workspaceFolder = { uri: Uri.parse('full/path/to/workspace'), name: '', index: 0 };
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        commandFactory = TypeMoq.Mock.ofType<IDiagnosticsCommandFactory>();
        fs = TypeMoq.Mock.ofType<IFileSystem>();
        messageHandler = TypeMoq.Mock.ofType<IDiagnosticHandlerService<MessageCommandPrompt>>();
        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        baseWorkspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        serviceContainer
            .setup((s) => s.get(TypeMoq.It.isValue(IWorkspaceService)))
            .returns(() => baseWorkspaceService.object);

        diagnosticService = new (class extends InvalidLaunchJsonDebuggerService {
            public _clear() {
                while (BaseDiagnosticsService.handledDiagnosticCodeKeys.length > 0) {
                    BaseDiagnosticsService.handledDiagnosticCodeKeys.shift();
                }
            }
            public async fixLaunchJson(code: DiagnosticCodes) {
                await super.fixLaunchJson(code);
            }
        })(serviceContainer.object, fs.object, [], workspaceService.object, messageHandler.object);
        (diagnosticService as any)._clear();
    });

    test('Can handle all InvalidLaunchJsonDebugger diagnostics', async () => {
        for (const code of [
            DiagnosticCodes.InvalidDebuggerTypeDiagnostic,
            DiagnosticCodes.JustMyCodeDiagnostic,
            DiagnosticCodes.ConsoleTypeDiagnostic,
        ]) {
            const diagnostic = TypeMoq.Mock.ofType<IDiagnostic>();
            diagnostic
                .setup((d) => d.code)
                .returns(() => code)
                .verifiable(TypeMoq.Times.atLeastOnce());

            const canHandle = await diagnosticService.canHandle(diagnostic.object);
            expect(canHandle).to.be.equal(true, `Should be able to handle ${code}`);
            diagnostic.verifyAll();
        }
    });

    test('Can not handle non-InvalidLaunchJsonDebugger diagnostics', async () => {
        const diagnostic = TypeMoq.Mock.ofType<IDiagnostic>();
        diagnostic
            .setup((d) => d.code)
            .returns(() => 'Something Else' as any)
            .verifiable(TypeMoq.Times.atLeastOnce());

        const canHandle = await diagnosticService.canHandle(diagnostic.object);
        expect(canHandle).to.be.equal(false, 'Invalid value');
        diagnostic.verifyAll();
    });

    test('Should return empty diagnostics if there are no workspace folders', async () => {
        workspaceService
            .setup((w) => w.hasWorkspaceFolders)
            .returns(() => false)
            .verifiable(TypeMoq.Times.once());
        const diagnostics = await diagnosticService.diagnose(undefined);
        expect(diagnostics).to.be.deep.equal([]);
        workspaceService.verifyAll();
    });

    test('Should return empty diagnostics if file launch.json does not exist', async () => {
        workspaceService
            .setup((w) => w.hasWorkspaceFolders)
            .returns(() => true)
            .verifiable(TypeMoq.Times.once());
        workspaceService
            .setup((w) => w.workspaceFolders)
            .returns(() => [workspaceFolder])
            .verifiable(TypeMoq.Times.once());
        workspaceService
            .setup((w) => w.getWorkspaceFolder(undefined))
            .returns(() => undefined)
            .verifiable(TypeMoq.Times.never());
        fs.setup((w) => w.fileExists(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(false))
            .verifiable(TypeMoq.Times.once());
        const diagnostics = await diagnosticService.diagnose(undefined);
        expect(diagnostics).to.be.deep.equal([]);
        workspaceService.verifyAll();
        fs.verifyAll();
    });

    test('Should return empty diagnostics if file launch.json does not contain strings "pythonExperimental" and "debugStdLib" ', async () => {
        const fileContents = 'Hello I am launch.json, although I am not very jsony';
        workspaceService
            .setup((w) => w.hasWorkspaceFolders)
            .returns(() => true)
            .verifiable(TypeMoq.Times.once());
        workspaceService
            .setup((w) => w.workspaceFolders)
            .returns(() => [workspaceFolder])
            .verifiable(TypeMoq.Times.once());
        fs.setup((w) => w.fileExists(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.once());
        fs.setup((w) => w.readFile(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(fileContents))
            .verifiable(TypeMoq.Times.once());
        const diagnostics = await diagnosticService.diagnose(undefined);
        expect(diagnostics).to.be.deep.equal([]);
        workspaceService.verifyAll();
        fs.verifyAll();
    });

    test('Should return InvalidDebuggerTypeDiagnostic if file launch.json contains string "pythonExperimental"', async () => {
        const fileContents = 'Hello I am launch.json, I contain string "pythonExperimental"';
        workspaceService
            .setup((w) => w.hasWorkspaceFolders)
            .returns(() => true)
            .verifiable(TypeMoq.Times.once());
        workspaceService
            .setup((w) => w.workspaceFolders)
            .returns(() => [workspaceFolder])
            .verifiable(TypeMoq.Times.once());
        fs.setup((w) => w.fileExists(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.once());
        fs.setup((w) => w.readFile(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(fileContents))
            .verifiable(TypeMoq.Times.once());
        const diagnostics = await diagnosticService.diagnose(undefined);
        expect(diagnostics).to.be.deep.equal(
            [new InvalidLaunchJsonDebuggerDiagnostic(DiagnosticCodes.InvalidDebuggerTypeDiagnostic, undefined)],
            'Diagnostics returned are not as expected',
        );
        workspaceService.verifyAll();
        fs.verifyAll();
    });

    test('Should return JustMyCodeDiagnostic if file launch.json contains string "debugStdLib"', async () => {
        const fileContents = 'Hello I am launch.json, I contain string "debugStdLib"';
        workspaceService
            .setup((w) => w.hasWorkspaceFolders)
            .returns(() => true)
            .verifiable(TypeMoq.Times.once());
        workspaceService
            .setup((w) => w.workspaceFolders)
            .returns(() => [workspaceFolder])
            .verifiable(TypeMoq.Times.once());
        fs.setup((w) => w.fileExists(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.once());
        fs.setup((w) => w.readFile(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(fileContents))
            .verifiable(TypeMoq.Times.once());
        const diagnostics = await diagnosticService.diagnose(undefined);
        expect(diagnostics).to.be.deep.equal(
            [new InvalidLaunchJsonDebuggerDiagnostic(DiagnosticCodes.JustMyCodeDiagnostic, undefined)],
            'Diagnostics returned are not as expected',
        );
        workspaceService.verifyAll();
        fs.verifyAll();
    });

    test('Should return ConfigPythonPathDiagnostic if file launch.json contains string "{config:python.pythonPath}"', async () => {
        const fileContents = 'Hello I am launch.json, I contain string {config:python.pythonPath}';
        workspaceService
            .setup((w) => w.hasWorkspaceFolders)
            .returns(() => true)
            .verifiable(TypeMoq.Times.once());
        workspaceService
            .setup((w) => w.workspaceFolders)
            .returns(() => [workspaceFolder])
            .verifiable(TypeMoq.Times.once());
        fs.setup((w) => w.fileExists(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.once());
        fs.setup((w) => w.readFile(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(fileContents))
            .verifiable(TypeMoq.Times.once());
        const diagnostics = await diagnosticService.diagnose(undefined);
        expect(diagnostics).to.be.deep.equal(
            [new InvalidLaunchJsonDebuggerDiagnostic(DiagnosticCodes.ConfigPythonPathDiagnostic, undefined, false)],
            'Diagnostics returned are not as expected',
        );
        workspaceService.verifyAll();
        fs.verifyAll();
    });

    test('Should return ConfigPythonPathDiagnostic if file launch.json contains string "{config:python.interpreterPath}"', async () => {
        const fileContents = 'Hello I am launch.json, I contain string {config:python.interpreterPath}';
        workspaceService
            .setup((w) => w.hasWorkspaceFolders)
            .returns(() => true)
            .verifiable(TypeMoq.Times.once());
        workspaceService
            .setup((w) => w.workspaceFolders)
            .returns(() => [workspaceFolder])
            .verifiable(TypeMoq.Times.once());
        fs.setup((w) => w.fileExists(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.once());
        fs.setup((w) => w.readFile(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(fileContents))
            .verifiable(TypeMoq.Times.once());
        const diagnostics = await diagnosticService.diagnose(undefined);
        expect(diagnostics).to.be.deep.equal(
            [new InvalidLaunchJsonDebuggerDiagnostic(DiagnosticCodes.ConfigPythonPathDiagnostic, undefined, false)],
            'Diagnostics returned are not as expected',
        );
        workspaceService.verifyAll();
        fs.verifyAll();
    });

    test('Should return both diagnostics if file launch.json contains string "debugStdLib" and  "pythonExperimental"', async () => {
        const fileContents = 'Hello I am launch.json, I contain both "debugStdLib" and "pythonExperimental"';
        workspaceService
            .setup((w) => w.hasWorkspaceFolders)
            .returns(() => true)
            .verifiable(TypeMoq.Times.once());
        workspaceService
            .setup((w) => w.workspaceFolders)
            .returns(() => [workspaceFolder])
            .verifiable(TypeMoq.Times.once());
        fs.setup((w) => w.fileExists(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.once());
        fs.setup((w) => w.readFile(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(fileContents))
            .verifiable(TypeMoq.Times.once());
        const diagnostics = await diagnosticService.diagnose(undefined);
        expect(diagnostics).to.be.deep.equal(
            [
                new InvalidLaunchJsonDebuggerDiagnostic(DiagnosticCodes.InvalidDebuggerTypeDiagnostic, undefined),
                new InvalidLaunchJsonDebuggerDiagnostic(DiagnosticCodes.JustMyCodeDiagnostic, undefined),
            ],
            'Diagnostics returned are not as expected',
        );
        workspaceService.verifyAll();
        fs.verifyAll();
    });

    test('All InvalidLaunchJsonDebugger diagnostics with `shouldShowPrompt` set to `true` should display a prompt with 2 buttons where clicking the first button will invoke a command', async () => {
        for (const code of [
            DiagnosticCodes.InvalidDebuggerTypeDiagnostic,
            DiagnosticCodes.JustMyCodeDiagnostic,
            DiagnosticCodes.ConsoleTypeDiagnostic,
        ]) {
            const diagnostic = TypeMoq.Mock.ofType<IDiagnostic>();
            let options: MessageCommandPrompt | undefined;
            diagnostic
                .setup((d) => d.code)
                .returns(() => code)
                .verifiable(TypeMoq.Times.atLeastOnce());
            diagnostic
                .setup((d) => d.shouldShowPrompt)
                .returns(() => true)
                .verifiable(TypeMoq.Times.atLeastOnce());
            messageHandler
                .setup((m) => m.handle(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .callback((_, opts: MessageCommandPrompt) => (options = opts))
                .verifiable(TypeMoq.Times.atLeastOnce());
            baseWorkspaceService
                .setup((c) => c.getWorkspaceFolder(TypeMoq.It.isAny()))
                .returns(() => workspaceFolder)
                .verifiable(TypeMoq.Times.atLeastOnce());

            await diagnosticService.handle([diagnostic.object]);

            diagnostic.verifyAll();
            commandFactory.verifyAll();
            messageHandler.verifyAll();
            baseWorkspaceService.verifyAll();
            expect(options!.commandPrompts).to.be.lengthOf(2);
            expect(options!.commandPrompts[0].prompt).to.be.equal(Diagnostics.yesUpdateLaunch());
            expect(options!.commandPrompts[0].command).not.to.be.equal(undefined, 'Command not set');
        }
    });

    test('All InvalidLaunchJsonDebugger diagnostics with `shouldShowPrompt` set to `false` should directly fix launch.json', async () => {
        for (const code of [DiagnosticCodes.ConfigPythonPathDiagnostic]) {
            let called = false;
            (diagnosticService as any).fixLaunchJson = () => {
                called = true;
            };
            const diagnostic = TypeMoq.Mock.ofType<IDiagnostic>();
            diagnostic
                .setup((d) => d.code)
                .returns(() => code)
                .verifiable(TypeMoq.Times.atLeastOnce());
            diagnostic
                .setup((d) => d.shouldShowPrompt)
                .returns(() => false)
                .verifiable(TypeMoq.Times.atLeastOnce());
            messageHandler
                .setup((m) => m.handle(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .verifiable(TypeMoq.Times.never());
            baseWorkspaceService
                .setup((c) => c.getWorkspaceFolder(TypeMoq.It.isAny()))
                .returns(() => workspaceFolder)
                .verifiable(TypeMoq.Times.atLeastOnce());

            await diagnosticService.handle([diagnostic.object]);

            diagnostic.verifyAll();
            commandFactory.verifyAll();
            messageHandler.verifyAll();
            baseWorkspaceService.verifyAll();
            expect(called).to.equal(true, '');
        }
    });

    test('All InvalidLaunchJsonDebugger diagnostics should display message twice if invoked twice', async () => {
        for (const code of [
            DiagnosticCodes.InvalidDebuggerTypeDiagnostic,
            DiagnosticCodes.JustMyCodeDiagnostic,
            DiagnosticCodes.ConsoleTypeDiagnostic,
        ]) {
            const diagnostic = TypeMoq.Mock.ofType<IDiagnostic>();
            diagnostic
                .setup((d) => d.code)
                .returns(() => code)
                .verifiable(TypeMoq.Times.atLeastOnce());
            diagnostic
                .setup((d) => d.invokeHandler)
                .returns(() => 'always')
                .verifiable(TypeMoq.Times.atLeastOnce());
            messageHandler.reset();
            messageHandler
                .setup((m) => m.handle(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
                .verifiable(TypeMoq.Times.exactly(2));
            baseWorkspaceService
                .setup((c) => c.getWorkspaceFolder(TypeMoq.It.isAny()))
                .returns(() => workspaceFolder)
                .verifiable(TypeMoq.Times.never());

            await diagnosticService.handle([diagnostic.object]);
            await diagnosticService.handle([diagnostic.object]);

            diagnostic.verifyAll();
            commandFactory.verifyAll();
            messageHandler.verifyAll();
            baseWorkspaceService.verifyAll();
        }
    });

    test('Function fixLaunchJson() returns if there are no workspace folders', async () => {
        for (const code of [
            DiagnosticCodes.InvalidDebuggerTypeDiagnostic,
            DiagnosticCodes.JustMyCodeDiagnostic,
            DiagnosticCodes.ConsoleTypeDiagnostic,
        ]) {
            workspaceService
                .setup((w) => w.hasWorkspaceFolders)
                .returns(() => false)
                .verifiable(TypeMoq.Times.atLeastOnce());
            workspaceService
                .setup((w) => w.workspaceFolders)
                .returns(() => [workspaceFolder])
                .verifiable(TypeMoq.Times.never());
            await (diagnosticService as any).fixLaunchJson(code);
            workspaceService.verifyAll();
        }
    });

    test('Function fixLaunchJson() returns if file launch.json does not exist', async () => {
        for (const code of [
            DiagnosticCodes.InvalidDebuggerTypeDiagnostic,
            DiagnosticCodes.JustMyCodeDiagnostic,
            DiagnosticCodes.ConsoleTypeDiagnostic,
        ]) {
            workspaceService
                .setup((w) => w.hasWorkspaceFolders)
                .returns(() => true)
                .verifiable(TypeMoq.Times.atLeastOnce());
            workspaceService
                .setup((w) => w.workspaceFolders)
                .returns(() => [workspaceFolder])
                .verifiable(TypeMoq.Times.atLeastOnce());
            fs.setup((w) => w.fileExists(TypeMoq.It.isAny()))
                .returns(() => Promise.resolve(false))
                .verifiable(TypeMoq.Times.atLeastOnce());
            fs.setup((w) => w.readFile(TypeMoq.It.isAny()))
                .returns(() => Promise.resolve(''))
                .verifiable(TypeMoq.Times.never());
            await (diagnosticService as any).fixLaunchJson(code);
            workspaceService.verifyAll();
            fs.verifyAll();
        }
    });

    test('File launch.json is fixed correctly when code equals JustMyCodeDiagnostic ', async () => {
        const launchJson = '{"debugStdLib": true, "debugStdLib": false}';
        const correctedlaunchJson = '{"justMyCode": false, "justMyCode": true}';
        workspaceService
            .setup((w) => w.hasWorkspaceFolders)
            .returns(() => true)
            .verifiable(TypeMoq.Times.once());
        workspaceService
            .setup((w) => w.workspaceFolders)
            .returns(() => [workspaceFolder])
            .verifiable(TypeMoq.Times.once());
        fs.setup((w) => w.fileExists(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.once());
        fs.setup((w) => w.readFile(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(launchJson))
            .verifiable(TypeMoq.Times.atLeastOnce());
        fs.setup((w) => w.writeFile(TypeMoq.It.isAnyString(), correctedlaunchJson))
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.once());
        await (diagnosticService as any).fixLaunchJson(DiagnosticCodes.JustMyCodeDiagnostic);
        workspaceService.verifyAll();
        fs.verifyAll();
    });

    test('File launch.json is fixed correctly when code equals InvalidDebuggerTypeDiagnostic ', async () => {
        const launchJson = '{"Python Experimental: task" "pythonExperimental"}';
        const correctedlaunchJson = '{"Python: task" "python"}';
        workspaceService
            .setup((w) => w.hasWorkspaceFolders)
            .returns(() => true)
            .verifiable(TypeMoq.Times.once());
        workspaceService
            .setup((w) => w.workspaceFolders)
            .returns(() => [workspaceFolder])
            .verifiable(TypeMoq.Times.once());
        fs.setup((w) => w.fileExists(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.once());
        fs.setup((w) => w.readFile(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(launchJson))
            .verifiable(TypeMoq.Times.atLeastOnce());
        fs.setup((w) => w.writeFile(TypeMoq.It.isAnyString(), correctedlaunchJson))
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.once());
        await (diagnosticService as any).fixLaunchJson(DiagnosticCodes.InvalidDebuggerTypeDiagnostic);
        workspaceService.verifyAll();
        fs.verifyAll();
    });

    test('File launch.json is fixed correctly when code equals ConsoleTypeDiagnostic ', async () => {
        const launchJson = '{"console": "none"}';
        const correctedlaunchJson = '{"console": "internalConsole"}';
        workspaceService
            .setup((w) => w.hasWorkspaceFolders)
            .returns(() => true)
            .verifiable(TypeMoq.Times.once());
        workspaceService
            .setup((w) => w.workspaceFolders)
            .returns(() => [workspaceFolder])
            .verifiable(TypeMoq.Times.once());
        fs.setup((w) => w.fileExists(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.once());
        fs.setup((w) => w.readFile(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(launchJson))
            .verifiable(TypeMoq.Times.atLeastOnce());
        fs.setup((w) => w.writeFile(TypeMoq.It.isAnyString(), correctedlaunchJson))
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.once());
        await (diagnosticService as any).fixLaunchJson(DiagnosticCodes.ConsoleTypeDiagnostic);
        workspaceService.verifyAll();
        fs.verifyAll();
    });

    test('File launch.json is fixed correctly when code equals ConfigPythonPathDiagnostic ', async () => {
        const launchJson = '"pythonPath": "{config:python.pythonPath}{config:python.interpreterPath}"';
        const correctedlaunchJson = '"python": "{command:python.interpreterPath}{command:python.interpreterPath}"';
        workspaceService
            .setup((w) => w.hasWorkspaceFolders)
            .returns(() => true)
            .verifiable(TypeMoq.Times.once());
        workspaceService
            .setup((w) => w.workspaceFolders)
            .returns(() => [workspaceFolder])
            .verifiable(TypeMoq.Times.once());
        fs.setup((w) => w.fileExists(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.once());
        fs.setup((w) => w.readFile(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(launchJson))
            .verifiable(TypeMoq.Times.atLeastOnce());
        fs.setup((w) => w.writeFile(TypeMoq.It.isAnyString(), correctedlaunchJson))
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.once());
        await (diagnosticService as any).fixLaunchJson(DiagnosticCodes.ConfigPythonPathDiagnostic);
        workspaceService.verifyAll();
        fs.verifyAll();
    });
});
