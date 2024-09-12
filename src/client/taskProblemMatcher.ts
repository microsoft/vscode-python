// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ShellExecution, Task, TaskScope, tasks, Disposable } from 'vscode';
import { traceLog } from './logging';

export function registerPythonTaskProvider(): Disposable {
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

    tasks.onDidStartTask((e) => {
        traceLog(`Task started: ${e.execution.task.name}`);

        if (e.execution.task.name === 'Trigger Python Task') {
            // TODO: If the task started is for Python extension,
            // Create new task,
            // execute that new task with their current python file

            const runCurrentFileCommand = '';
            // TODO: Get the file to execute
            // TODO: set cwd for file execution using await this.setCwdForFileExecution(file, options);
            // TODO: const { command, args } = await this.getExecuteFileArgs(file, [file.fsPath.fileToCommandArgumentForPythonExt(),]);
            // TODO: pass command, args as argument to new ShellExecution below

            const currentPythonFileTask = new Task(
                { type: 'pythonTask2', task: 'defaultTask2' },
                TaskScope.Workspace,
                'Run current Python file',
                'pythonTask',
                new ShellExecution('python joke.py'), // TODO: Get the current active Python file and make command to run this
                '$pythonCustomMatcher', // Use the custom problem matcher defined in package.json
            );

            tasks.executeTask(currentPythonFileTask);
        }
    });

    return taskProvider;
}
