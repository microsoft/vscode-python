// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ShellExecution, Task, TaskScope, tasks } from 'vscode';
import { Disposable } from 'vscode-jsonrpc';
import { traceLog } from './logging';
import { ICodeExecutionHelper, ICodeExecutionService } from './terminals/types';
import { ITerminalHelper } from './common/terminal/types';
import { IActiveResourceService, ITerminalManager } from './common/application/types';
import { IConfigurationService } from './common/types';
import { PlatformService } from './common/platform/platformService';
import { buildPythonExecInfo } from './pythonEnvironments/exec';
import { IInterpreterService } from './interpreter/contracts';

export function registerPythonTaskProvider(
    executionHelper: ICodeExecutionHelper,
    terminalHelper: ITerminalHelper,
    terminalManager: ITerminalManager,
    configurationService: IConfigurationService,
    interpreterService: IInterpreterService,
    activeResourceService: IActiveResourceService,
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

            // TODO: Have to rebuild getExecuteFileArgs from scartch because we can't inject codeExecutionService.
            // const { command, args } = await codeExecutionService.getExecuteFileArgs(
            //     [
            //         pythonFile!.fsPath.fileToCommandArgumentForPythonExt(), // TODO: Remove bang !
            //     ],
            //     pythonFile!,
            // );

            const platformService = new PlatformService();
            // Reimplement getExecutableInfo here
            const resource = activeResourceService.getActiveResource();
            const pythonSettings = configurationService.getSettings(resource);
            const interpreter = await interpreterService.getActiveInterpreter(resource);
            const interpreterPath = interpreter?.path ?? pythonSettings.pythonPath;
            const command = platformService.isWindows ? interpreterPath.replace(/\\/g, '/') : interpreterPath;
            const { launchArgs } = pythonSettings.terminal;
            const arrFileToCommandArgumentForPythonExt = pythonFile!.fsPath.fileToCommandArgumentForPythonExt();
            const pythonExecInfo = buildPythonExecInfo(command, [
                ...launchArgs,
                ...arrFileToCommandArgumentForPythonExt,
            ]);

            // TODO: build command for specific terminal
            const hiddenTerminal = terminalManager.createTerminal({
                name: 'PythonHidden',
                env: {},
                hideFromUser: true,
            });
            const terminalShellType = terminalHelper.identifyTerminalShell(hiddenTerminal);
            const finalCommand = terminalHelper.buildCommandForTerminal(
                terminalShellType,
                pythonExecInfo.command,
                pythonExecInfo.args,
            );
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
