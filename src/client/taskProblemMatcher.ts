// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ShellExecution, Task, TaskScope, tasks } from 'vscode';
import { Disposable } from 'vscode-jsonrpc';
import { traceLog } from './logging';
import { ICodeExecutionHelper, ICodeExecutionService } from './terminals/types';

export function registerPythonTaskProvider(
    executionHelper: ICodeExecutionHelper,
    codeExecutionService: ICodeExecutionService,
): Disposable {
    const taskProvider = tasks.registerTaskProvider('pythonTask', {
        provideTasks: () =>
            Promise.resolve([
                new Task(
                    { type: 'pythonTask', task: 'defaultTask' },
                    TaskScope.Workspace,
                    'Trigger Python Task',
                    'pythonTask',
                    new ShellExecution('echo hi'), // Hard coded for now: joke.py is in my ext.host workspace. Could be any file in user's workspace.
                    '$pythonCustomMatcher', // Use the custom problem matcher defined in package.json
                ),
            ]),

        resolveTask(_task: Task): Task | undefined {
            return undefined;
        },
    });

    tasks.onDidStartTask(async (e) => {
        traceLog(`Task started: ${e.execution.task.name}`);

        if (e.execution.task.name === 'Trigger Python Task') {
            // TODO: If the task(dummy task/entry point task --> may cd to prep execution) started is for Python extension,
            // Create new task (Real task that will run current Python file),
            // execute that new task with their current python file

            // TODO: Get the file to execute

            const pythonFile = await executionHelper.getFileToExecute();
            // TODO: MIGHT NEED TO set cwd for file execution using await this.setCwdForFileExecution(file, options);

            // TODO: const { command, args } = await this.getExecuteFileArgs(file, [file.fsPath.fileToCommandArgumentForPythonExt(),]);
            const { command, args } = await codeExecutionService.getExecuteFileArgs(
                [
                    pythonFile!.fsPath.fileToCommandArgumentForPythonExt(), // TODO: Remove bang !
                ],
                pythonFile!,
            );
            // TODO: build command for specific terminal
            const finalCommand = terminalHelper.buildCommandForTerminal(terminalShellType, command, args);
            // TODO: pass command, args as argument to new ShellExecution below

            const currentPythonFileTask = new Task(
                { type: 'pythonTask2', task: 'defaultTask2' },
                TaskScope.Workspace,
                'Run current Python file',
                'pythonTask',
                new ShellExecution(finalCommand), // TODO: Get the current active Python file and make command to run this
                '$pythonCustomMatcher', // Use the custom problem matcher defined in package.json
            );

            tasks.executeTask(currentPythonFileTask);
        }
    });

    return taskProvider;
}
