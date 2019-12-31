// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-classes-per-file max-func-body-length no-invalid-this
import { expect } from 'chai';
import { exec } from 'child_process';
import * as path from 'path';
import { promisify } from 'util';
import { Uri } from 'vscode';
import '../../../client/common/extensions';
import { createDeferredFromPromise, Deferred } from '../../../client/common/utils/async';
import { StopWatch } from '../../../client/common/utils/stopWatch';
import { IInterpreterLocatorService, IInterpreterWatcherBuilder, WORKSPACE_VIRTUAL_ENV_SERVICE } from '../../../client/interpreter/contracts';
import { WorkspaceVirtualEnvWatcherService } from '../../../client/interpreter/locators/services/workspaceVirtualEnvWatcherService';
import { IServiceContainer } from '../../../client/ioc/types';
import { IS_CI_SERVER } from '../../ciConstants';
import { deleteFiles, getOSType, isPythonVersionInProcess, OSType, PYTHON_PATH, rootWorkspaceUri, waitForCondition } from '../../common';
import { IS_MULTI_ROOT_TEST } from '../../constants';
import { sleep } from '../../core';
import { initialize, multirootPath } from '../../initialize';

const execAsync = promisify(exec);
async function run(argv: string[], cwd: string) {
    const cmdline = argv.join(' ');
    const { stderr } = await execAsync(cmdline, {
        cwd: cwd
    });
    if (stderr && stderr.length > 0) {
        throw Error(stderr);
    }
}

class Venvs {
    constructor(private readonly cwd: string, private readonly prefix = '.venv-') {}

    public async create(name: string): Promise<string> {
        const venvRoot = this.resolve(name);
        const argv = [PYTHON_PATH.fileToCommandArgument(), '-m', 'venv', venvRoot];
        try {
            await run(argv, this.cwd);
        } catch (err) {
            throw new Error(`Failed to create Env ${path.basename(venvRoot)}, ${PYTHON_PATH}, Error: ${err}`);
        }
        return venvRoot;
    }

    public async cleanUp() {
        const globPattern = path.join(this.cwd, `${this.prefix}*`);
        await deleteFiles(globPattern);
    }

    private getID(name: string): string {
        // Ensure env is random to avoid conflicts in tests (currupting test data).
        const now = new Date().getTime().toString();
        return `${this.prefix}${name}${now}`;
    }

    private resolve(name: string): string {
        const id = this.getID(name);
        return path.join(this.cwd, id);
    }
}

const timeoutMs = IS_CI_SERVER ? 60_000 : 15_000;
suite('Interpreters - Workspace VirtualEnv Service', function() {
    this.timeout(timeoutMs);
    this.retries(0);

    const workspaceUri = IS_MULTI_ROOT_TEST ? Uri.file(path.join(multirootPath, 'workspace3')) : rootWorkspaceUri!;
    // "workspace4 does not exist.
    const workspace4 = Uri.file(path.join(multirootPath, 'workspace4'));
    const venvs = new Venvs(workspaceUri.fsPath);

    let serviceContainer: IServiceContainer;
    let locator: IInterpreterLocatorService;

    async function manuallyTriggerFSWatcher(deferred: Deferred<void>) {
        // Monitoring files on virtualized environments can be finicky...
        // Lets trigger the fs watcher manually for the tests.
        const stopWatch = new StopWatch();
        const builder = serviceContainer.get<IInterpreterWatcherBuilder>(IInterpreterWatcherBuilder);
        const watcher = (await builder.getWorkspaceVirtualEnvInterpreterWatcher(workspaceUri)) as WorkspaceVirtualEnvWatcherService;
        const binDir = getOSType() === OSType.Windows ? 'Scripts' : 'bin';
        const executable = getOSType() === OSType.Windows ? 'python.exe' : 'python';
        while (!deferred.completed && stopWatch.elapsedTime < timeoutMs - 10_000) {
            const pythonPath = path.join(workspaceUri.fsPath, binDir, executable);
            watcher.createHandler(Uri.file(pythonPath)).ignoreErrors();
            await sleep(1000);
        }
    }
    async function waitForInterpreterToBeDetected(venvRoot: string) {
        const envNameToLookFor = path.basename(venvRoot);
        const predicate = async () => {
            const items = await locator.getInterpreters(workspaceUri);
            return items.some(item => item.envName === envNameToLookFor);
        };
        const promise = waitForCondition(predicate, timeoutMs, `${envNameToLookFor}, Environment not detected in the workspace ${workspaceUri.fsPath}`);
        const deferred = createDeferredFromPromise(promise);
        manuallyTriggerFSWatcher(deferred).ignoreErrors();
        await deferred.promise;
    }
    async function createVirtualEnvironment(envSuffix: string) {
        return venvs.create(envSuffix);
    }

    suiteSetup(async function() {
        // skip for Python < 3, no venv support
        if (await isPythonVersionInProcess(undefined, '2')) {
            return this.skip();
        }

        serviceContainer = (await initialize()).serviceContainer;
        locator = serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, WORKSPACE_VIRTUAL_ENV_SERVICE);
        // This test is required, we need to wait for interpreter listing completes,
        // before proceeding with other tests.
        await venvs.cleanUp();
        await locator.getInterpreters(workspaceUri);
    });

    suiteTeardown(async () => venvs.cleanUp());
    teardown(async () => venvs.cleanUp());

    test('Detect Virtual Environment', async () => {
        const envName = await createVirtualEnvironment('one');
        await waitForInterpreterToBeDetected(envName);
    });

    test('Detect a new Virtual Environment', async () => {
        const env1 = await createVirtualEnvironment('first');
        await waitForInterpreterToBeDetected(env1);

        // Ensure second environment in our workspace folder is detected when created.
        const env2 = await createVirtualEnvironment('second');
        await waitForInterpreterToBeDetected(env2);
    });

    test('Detect a new Virtual Environment, and other workspace folder must not be affected (multiroot)', async function() {
        if (!IS_MULTI_ROOT_TEST) {
            return this.skip();
        }
        // There should be nothing in workspacec4.
        let items4 = await locator.getInterpreters(workspace4);
        expect(items4).to.be.lengthOf(0);

        const [env1, env2] = await Promise.all([createVirtualEnvironment('first3'), createVirtualEnvironment('second3')]);
        await Promise.all([waitForInterpreterToBeDetected(env1), waitForInterpreterToBeDetected(env2)]);

        // Workspace4 should still not have any interpreters.
        items4 = await locator.getInterpreters(workspace4);
        expect(items4).to.be.lengthOf(0);
    });
});
