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
import { ICurrentProcess, IExperimentService, IExperimentsManager } from '../../../../client/common/types';
import { PYTHON_VIRTUAL_ENVS_LOCATION } from '../../../ciConstants';
import {
    // PYTHON_PATH,
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
import * as ExperimentHelpers from '../../../../client/common/experiments/helpers';
import { getCommandPromptLocation } from '../../../../client/common/terminal/commandPrompt';

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
    const sandbox = sinon.createSandbox();
    suiteSetup(async () => {
        sandbox.stub(ExperimentHelpers, 'inDiscoveryExperiment').resolves(true);
        envPaths = await fs.readJson(envsLocation);
        terminalSettings = vscode.workspace.getConfiguration('terminal', vscode.workspace.workspaceFolders![0].uri);
        pythonSettings = vscode.workspace.getConfiguration('python', vscode.workspace.workspaceFolders![0].uri);
        defaultShell.Windows = terminalSettings.inspect('integrated.shell.windows').globalValue;
        defaultShell.Linux = terminalSettings.inspect('integrated.shell.linux').globalValue;
        console.warn(`defaultShell values: ${JSON.stringify(defaultShell)}`);
        await terminalSettings.update('integrated.shell.linux', '/bin/bash', vscode.ConfigurationTarget.Global);
        const serviceContainer = (await initialize()).serviceContainer;
        experiments = serviceContainer.get<IExperimentsManager>(IExperimentsManager);
        const experimentService = serviceContainer.get<IExperimentService>(IExperimentService);
        sandbox.stub(experimentService, 'inExperiment').resolves(true);

        const currentProcess = serviceContainer.get<ICurrentProcess>(ICurrentProcess);
        const cmdPath = getCommandPromptLocation(currentProcess);
        console.warn(`cmdPath: ${cmdPath}`);
        await terminalSettings.update('integrated.shell.windows', cmdPath, vscode.ConfigurationTarget.Global);
        console.warn(`Updated terminal.integrated.shell.windows to ${cmdPath}`);
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
        const command = `python ${pythonFile.toCommandArgument()} ${logFile.toCommandArgument()}`;
        console.warn(`command to send to terminal: ${command}`);
        terminal.sendText(`python ${pythonFile.toCommandArgument()} ${logFile.toCommandArgument()}`, true);
        console.warn(`command sent to terminal, waiting for the log file to be created`);
        await waitForCondition(() => fs.pathExists(logFile), logFileCreationWaitMs, `${logFile} file not created.`);
        console.warn(`check if path exists`);
        const exists = await fs.pathExists(logFile);
        console.warn(`Does the path to ${logFile} exist? ${exists}`);
        // return 'foo';
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
        const result = experiments.inExperiment(DeprecatePythonPath.experiment);
        console.warn(
            `testActivation for envPath: ${envPath} - inExperiment(DeprecatePythonPath.experiment): ${result}`,
        );
        const before = pythonSettings.inspect('defaultInterpreterPath');
        if (experiments.inExperiment(DeprecatePythonPath.experiment)) {
            await setGlobalInterpreterPath(envPath);
        } else {
            await setPythonPathInWorkspaceRoot(envPath);
        }
        const after = pythonSettings.inspect('defaultInterpreterPath');
        console.warn(`interpreter path before: ${JSON.stringify(before)} - after: ${JSON.stringify(after)}`);
        const content = await openTerminalAndAwaitCommandContent(waitTimeForActivation * 3, file, outputFile, 5_000);
        console.warn(`openTerminalAndAwaitCommandContent done for envPath: ${envPath}`);
        console.warn(`content: ${content} - envPath: ${envPath}`);
        // expect(true).to.equal(true);
        expect(fileSystem.arePathsSame(content, envPath)).to.equal(true, 'Environment not activated');
    }

    // test('Should not activate', async () => {
    //     await updateSetting(
    //         'terminal.activateEnvironment',
    //         false,
    //         vscode.workspace.workspaceFolders![0].uri,
    //         vscode.ConfigurationTarget.WorkspaceFolder,
    //     );
    //     const content = await openTerminalAndAwaitCommandContent(waitTimeForActivation, file, outputFile, 5_000);
    //     expect(fileSystem.arePathsSame(content, PYTHON_PATH)).to.equal(false, 'Environment not activated');
    // });

    [true, false].forEach((value) => {
        suite(`Test activation with DeprecatePythonPath experiment value set to ${value}`, () => {
            let deprecatePythonPathStub: sinon.SinonStub;
            setup(() => {
                console.warn('setup');
                deprecatePythonPathStub = sandbox.stub(experiments, 'inExperiment');
                deprecatePythonPathStub.withArgs(DeprecatePythonPath.experiment).returns(value);
                console.warn(`DeprecatePythonPath.experiment set to ${value}`);
            });

            teardown(() => {
                deprecatePythonPathStub.restore();
            });

            test('Should activate with venv', async function () {
                console.warn(`Should activate with venv with DeprecatePythonPath.experiment set to ${value}`);
                if (process.env.CI_PYTHON_VERSION && process.env.CI_PYTHON_VERSION.startsWith('2.')) {
                    this.skip();
                }
                console.warn(`Did not skip test`);
                await testActivation(envPaths.venvPath);
                console.warn(`tested activation with venv`);
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
    });
    // suite('venv', () => {
    //     let deprecatePythonPathStub: sinon.SinonStub;
    //     setup(() => {
    //         deprecatePythonPathStub = sandbox.stub(experiments, 'inExperiment');
    //     });

    //     teardown(() => {
    //         deprecatePythonPathStub.restore();
    //     });

    //     test('Should activate with venv in DeprecatePythonPath experiment', async function () {
    //         deprecatePythonPathStub.withArgs(DeprecatePythonPath.experiment).returns(true);
    //         if (process.env.CI_PYTHON_VERSION && process.env.CI_PYTHON_VERSION.startsWith('2.')) {
    //             this.skip();
    //         }
    //         await testActivation(envPaths.venvPath);
    //     }).timeout(TEST_TIMEOUT * 2);
    //     test('Should activate with venv not in DeprecatePythonPath experiment', async function () {
    //         deprecatePythonPathStub.withArgs(DeprecatePythonPath.experiment).returns(false);
    //         if (process.env.CI_PYTHON_VERSION && process.env.CI_PYTHON_VERSION.startsWith('2.')) {
    //             this.skip();
    //         }
    //         await testActivation(envPaths.venvPath);
    //     }).timeout(TEST_TIMEOUT * 2);
    // });
    // test('Should activate with pipenv', async () => {
    //     await testActivation(envPaths.pipenvPath);
    // });
    // test('Should activate with virtualenv', async () => {
    //     await testActivation(envPaths.virtualEnvPath);
    // });
    // test('Should activate with conda', async () => {
    //     await terminalSettings.update(
    //         'integrated.shell.windows',
    //         'C:\\Windows\\System32\\cmd.exe',
    //         vscode.ConfigurationTarget.Global,
    //     );
    //     await pythonSettings.update('condaPath', envPaths.condaExecPath, vscode.ConfigurationTarget.Workspace);
    //     await testActivation(envPaths.condaPath);
    // }).timeout(TEST_TIMEOUT * 2);
});
