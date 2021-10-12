// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { DeprecatePythonPath } from '../../../../client/common/experiments/groups';
import { FileSystem } from '../../../../client/common/platform/fileSystem';
import { IExperimentService } from '../../../../client/common/types';
import { createDeferred } from '../../../../client/common/utils/async';
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
    let experiments: IExperimentService;
    const sandbox = sinon.createSandbox();
    suiteSetup(async () => {
        envPaths = await fs.readJson(envsLocation);
        terminalSettings = vscode.workspace.getConfiguration('terminal', vscode.workspace.workspaceFolders![0].uri);
        pythonSettings = vscode.workspace.getConfiguration('python', vscode.workspace.workspaceFolders![0].uri);
        defaultShell.Windows = terminalSettings.inspect('integrated.defaultProfile.windows').globalValue;
        defaultShell.Linux = terminalSettings.inspect('integrated.defaultProfile.linux').globalValue;
        await terminalSettings.update('integrated.defaultProfile.linux', 'bash', vscode.ConfigurationTarget.Global);
        experiments = (await initialize()).serviceContainer.get<IExperimentService>(IExperimentService);
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
        sandbox.restore();
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
            'integrated.defaultProfile.windows',
            defaultShell.Windows,
            vscode.ConfigurationTarget.Global,
        );
        await terminalSettings.update(
            'integrated.defaultProfile.linux',
            defaultShell.Linux,
            vscode.ConfigurationTarget.Global,
        );
        await pythonSettings.update('condaPath', undefined, vscode.ConfigurationTarget.Workspace);
        if (experiments.inExperimentSync(DeprecatePythonPath.experiment)) {
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
        let terminal: vscode.Terminal;
        const waitForTerminal = createDeferred();
        const dispose = vscode.window.onDidWriteTerminalData((e) => {
            if (e.terminal === terminal && e.data.toLowerCase().includes('activ')) {
                waitForTerminal.resolve();
            }
        });
        terminal = vscode.window.createTerminal();
        await Promise.race([waitForTerminal.promise, sleep(consoleInitWaitMs)]);

        terminal.sendText(`python ${pythonFile.toCommandArgument()} ${logFile.toCommandArgument()}`, true);
        await waitForCondition(() => fs.pathExists(logFile), logFileCreationWaitMs, `${logFile} file not created.`);

        if (dispose) {
            dispose.dispose();
        }
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
        if (experiments.inExperimentSync(DeprecatePythonPath.experiment)) {
            await setGlobalInterpreterPath(envPath);
            const p = vscode.workspace.getConfiguration('python').get<string>('defaultInterpreterPath');
            expect(fileSystem.arePathsSame(p ?? '', envPath)).to.equal(
                true,
                `setGlobalInterpreterPath did not work: ${p}`,
            );
        } else {
            await setPythonPathInWorkspaceRoot(envPath);
            const p = vscode.workspace.getConfiguration('python').get<string>('pythonPath');
            expect(fileSystem.arePathsSame(p ?? '', envPath)).to.equal(
                true,
                `setPythonPathInWorkspaceRoot did not work: ${p}`,
            );
        }

        const extension = vscode.extensions.getExtension('ms-python.python');
        if (!extension?.isActive) {
            await extension?.activate();
        }
        expect(extension?.isActive).to.equal(true, 'Extension is not activated');

        // Wait for some time for the settings to propagate after activation
        await waitForCondition(
            () => {
                const { execCommand } = extension?.exports.settings.getExecutionDetails();
                return Promise.resolve(fileSystem.arePathsSame(execCommand[0], envPath));
            },
            waitTimeForActivation,
            `${envPath} setting not propagated yet.`,
        );

        const { execCommand } = extension?.exports.settings.getExecutionDetails();
        expect(fileSystem.arePathsSame(execCommand[0], envPath)).to.equal(
            true,
            `Python not set to testing environment [actual] ${execCommand[0]} != [expected] ${envPath}`,
        );

        const content = await openTerminalAndAwaitCommandContent(waitTimeForActivation, file, outputFile, 5_000);
        expect(fileSystem.arePathsSame(content, envPath)).to.equal(
            true,
            `Environment not activated ${content} != ${envPath}`,
        );
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
    test('Should activate with conda', async function () {
        this.skip();
        // Powershell does not work with conda by default, hence use cmd.
        await terminalSettings.update(
            'integrated.defaultProfile.windows',
            'Command Prompt',
            vscode.ConfigurationTarget.Global,
        );
        await pythonSettings.update('condaPath', envPaths.condaExecPath, vscode.ConfigurationTarget.Workspace);
        await testActivation(envPaths.condaPath);
    }).timeout(TEST_TIMEOUT * 2);
});
