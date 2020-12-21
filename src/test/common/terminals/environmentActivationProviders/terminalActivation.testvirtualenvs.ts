// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { DeprecatePythonPath } from '../../../../client/common/experiments/groups';
import { FileSystem } from '../../../../client/common/platform/fileSystem';
import { IExperimentsManager } from '../../../../client/common/types';
import { PYTHON_VIRTUAL_ENVS_LOCATION } from '../../../ciConstants';
import {
    PYTHON_PATH,
    resetGlobalInterpreterPathSetting,
    restorePythonPathInWorkspaceRoot,
    setGlobalInterpreterPath,
    setPythonPathInWorkspaceRoot,
    updateSetting,
    waitForCondition,
} from '../../../common';
import { EXTENSION_ROOT_DIR_FOR_TESTS, TEST_TIMEOUT } from '../../../constants';
import { sleep } from '../../../core';
import { initialize, initializeTest } from '../../../initialize';

// tslint:disable:max-func-body-length no-any
suite('Activation of Environments in Terminal', () => {
    const file = path.join(
        EXTENSION_ROOT_DIR_FOR_TESTS,
        'src',
        'testMultiRootWkspc',
        'smokeTests',
        'testExecInTerminal.py',
    );
    let outputFile = '';
    let outputFileCounter = 0;
    const fileSystem = new FileSystem();
    const outputFilesCreated: string[] = [];
    const envsLocation =
        PYTHON_VIRTUAL_ENVS_LOCATION !== undefined
            ? path.join(EXTENSION_ROOT_DIR_FOR_TESTS, PYTHON_VIRTUAL_ENVS_LOCATION)
            : path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'tmp', 'envPaths.json');
    const waitTimeForActivation = 5000;
    type EnvPath = {
        condaExecPath: string;
        condaPath: string;
        venvPath: string;
        pipenvPath: string;
        virtualEnvPath: string;
    };
    let envPaths: EnvPath;
    const defaultShell = {
        Windows: '',
        Linux: '',
        MacOS: '',
    };
    let terminalSettings: any;
    let pythonSettings: any;
    let experiments: IExperimentsManager;
    suiteSetup(async () => {
        envPaths = await fs.readJson(envsLocation);
        terminalSettings = vscode.workspace.getConfiguration('terminal', vscode.workspace.workspaceFolders![0].uri);
        pythonSettings = vscode.workspace.getConfiguration('python', vscode.workspace.workspaceFolders![0].uri);
        defaultShell.Windows = terminalSettings.inspect('integrated.shell.windows').globalValue;
        defaultShell.Linux = terminalSettings.inspect('integrated.shell.linux').globalValue;
        await terminalSettings.update('integrated.shell.linux', '/bin/bash', vscode.ConfigurationTarget.Global);
        experiments = (await initialize()).serviceContainer.get<IExperimentsManager>(IExperimentsManager);
    });

    setup(async () => {
        await initializeTest();
        outputFile = path.join(
            EXTENSION_ROOT_DIR_FOR_TESTS,
            'src',
            'testMultiRootWkspc',
            'smokeTests',
            `testExecInTerminal_${outputFileCounter}.log`,
        );
        outputFileCounter += 1;
        outputFilesCreated.push(outputFile);
    });

    suiteTeardown(async function () {
        // tslint:disable-next-line: no-invalid-this
        this.timeout(TEST_TIMEOUT * 2);
        await revertSettings();

        // remove all created log files.
        outputFilesCreated.forEach(async (filePath: string) => {
            if (await fs.pathExists(filePath)) {
                await fs.unlink(filePath);
            }
        });
    });

    async function revertSettings() {
        await updateSetting(
            'terminal.activateEnvironment',
            undefined,
            vscode.workspace.workspaceFolders![0].uri,
            vscode.ConfigurationTarget.WorkspaceFolder,
        );
        await terminalSettings.update(
            'integrated.shell.windows',
            defaultShell.Windows,
            vscode.ConfigurationTarget.Global,
        );
        await terminalSettings.update('integrated.shell.linux', defaultShell.Linux, vscode.ConfigurationTarget.Global);
        await pythonSettings.update('condaPath', undefined, vscode.ConfigurationTarget.Workspace);
        if (experiments.inExperiment(DeprecatePythonPath.experiment)) {
            await resetGlobalInterpreterPathSetting();
        } else {
            await restorePythonPathInWorkspaceRoot();
        }
    }

    /**
     * Open a terminal and issue a python `pythonFile` command, expecting it to
     * create a file `logfile`, with timeout limits.
     *
     * @param pythonFile The python script to run.
     * @param logFile The logfile that the python script will produce.
     * @param consoleInitWaitMs How long to wait for the console to initialize.
     * @param logFileCreationWaitMs How long to wait for the output file to be produced.
     */
    async function openTerminalAndAwaitCommandContent(
        consoleInitWaitMs: number,
        pythonFile: string,
        logFile: string,
        logFileCreationWaitMs: number,
    ): Promise<string> {
        const terminal = vscode.window.createTerminal();
        await sleep(consoleInitWaitMs);
        terminal.sendText(`python ${pythonFile.toCommandArgument()} ${logFile.toCommandArgument()}`, true);
        await waitForCondition(() => fs.pathExists(logFile), logFileCreationWaitMs, `${logFile} file not created.`);

        return fs.readFile(logFile, 'utf-8');
    }

    /**
     * Turn on `terminal.activateEnvironment`, produce a shell, run a python script
     * that outputs the path to the active python interpreter.
     *
     * Note: asserts that the envPath given matches the envPath returned by the script.
     *
     * @param envPath Python environment path to activate in the terminal (via vscode config)
     */
    async function testActivation(envPath: string) {
        await updateSetting(
            'terminal.activateEnvironment',
            true,
            vscode.workspace.workspaceFolders![0].uri,
            vscode.ConfigurationTarget.WorkspaceFolder,
        );
        if (experiments.inExperiment(DeprecatePythonPath.experiment)) {
            await setGlobalInterpreterPath(envPath);
        } else {
            await setPythonPathInWorkspaceRoot(envPath);
        }
        const content = await openTerminalAndAwaitCommandContent(waitTimeForActivation, file, outputFile, 5_000);
        expect(fileSystem.arePathsSame(content, envPath)).to.equal(true, 'Environment not activated');
    }

    test('Should not activate', async () => {
        await updateSetting(
            'terminal.activateEnvironment',
            false,
            vscode.workspace.workspaceFolders![0].uri,
            vscode.ConfigurationTarget.WorkspaceFolder,
        );
        const content = await openTerminalAndAwaitCommandContent(waitTimeForActivation, file, outputFile, 5_000);
        expect(fileSystem.arePathsSame(content, PYTHON_PATH)).to.equal(false, 'Environment not activated');
    });

    test('Should activate with venv', async function () {
        if (process.env.CI_PYTHON_VERSION && process.env.CI_PYTHON_VERSION.startsWith('2.')) {
            // tslint:disable-next-line: no-invalid-this
            this.skip();
        }
        await testActivation(envPaths.venvPath);
    });
    test('Should activate with pipenv', async () => {
        await testActivation(envPaths.pipenvPath);
    });
    test('Should activate with virtualenv', async () => {
        await testActivation(envPaths.virtualEnvPath);
    });
    test('Should activate with conda', async () => {
        await terminalSettings.update(
            'integrated.shell.windows',
            'C:\\Windows\\System32\\cmd.exe',
            vscode.ConfigurationTarget.Global,
        );
        await pythonSettings.update('condaPath', envPaths.condaExecPath, vscode.ConfigurationTarget.Workspace);
        await testActivation(envPaths.condaPath);
    }).timeout(TEST_TIMEOUT * 2);
});
