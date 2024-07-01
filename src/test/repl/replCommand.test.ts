// Create test suite and test cases for the `replUtils` module
import * as vscode from 'vscode';
import * as TypeMoq from 'typemoq';
import { Disposable } from 'vscode';
import { IInterpreterService } from '../../client/interpreter/contracts';
import { ICommandManager } from '../../client/common/application/types';
import { ICodeExecutionHelper } from '../../client/terminals/types';
import { registerReplCommands } from '../../client/repl/replCommands';

suite('REPL - register native repl command', () => {
    let interpreterService: TypeMoq.IMock<IInterpreterService>;
    let commandManager: TypeMoq.IMock<ICommandManager>;
    let executionHelper: TypeMoq.IMock<ICodeExecutionHelper>;
    setup(() => {
        interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
        commandManager = TypeMoq.Mock.ofType<ICommandManager>();
        executionHelper = TypeMoq.Mock.ofType<ICodeExecutionHelper>();
    });

    test('Ensure repl command is registered', async () => {
        const disposable = TypeMoq.Mock.ofType<Disposable>();
        const disposableArray: Disposable[] = [disposable.object];

        await registerReplCommands(
            disposableArray,
            interpreterService.object,
            executionHelper.object,
            commandManager.object,
        );

        // Check to see if the command was registered
        commandManager.verify((c) => c.registerCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.once());
    });
});
