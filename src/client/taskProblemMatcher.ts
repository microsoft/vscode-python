// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ShellExecution, Task, TaskScope, tasks, Disposable } from 'vscode';

export function registerPythonTaskProvider(): Disposable {
    const taskProvider = tasks.registerTaskProvider('pythonTask', {
        provideTasks: () =>
            Promise.resolve([
                new Task(
                    { type: 'pythonTask', task: 'defaultTask' },
                    TaskScope.Workspace,
                    'Default Task',
                    'pythonTask',
                    new ShellExecution('python joke.py'), // Hard coded for now: joke.py is in my ext.host workspace. Could be any file in user's workspace.
                    '$pythonCustomMatcher', // Use the custom problem matcher defined in package.json
                ),
            ]),

        resolveTask(_task: Task): Task | undefined {
            return undefined;
        },
    });
    return taskProvider;
}
