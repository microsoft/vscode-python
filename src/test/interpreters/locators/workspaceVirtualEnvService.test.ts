// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-classes-per-file max-func-body-length no-invalid-this
import { expect } from 'chai';
import { exec, ExecOptions } from 'child_process';
import * as path from 'path';
import { promisify } from 'util';
import { Uri } from 'vscode';
import '../../../client/common/extensions';
import { FileSystem } from '../../../client/common/platform/fileSystem';
import { createDeferredFromPromise, Deferred } from '../../../client/common/utils/async';
import { StopWatch } from '../../../client/common/utils/stopWatch';
import {
    IInterpreterLocatorService,
    IInterpreterWatcherBuilder,
    WORKSPACE_VIRTUAL_ENV_SERVICE
} from '../../../client/interpreter/contracts';
import { WorkspaceVirtualEnvWatcherService } from '../../../client/interpreter/locators/services/workspaceVirtualEnvWatcherService';
import { IServiceContainer } from '../../../client/ioc/types';
import { IS_CI_SERVER } from '../../ciConstants';
import { deleteFiles, getOSType, isPythonVersionInProcess, OSType, PYTHON_PATH, rootWorkspaceUri, waitForCondition } from '../../common';
import { IS_MULTI_ROOT_TEST } from '../../constants';
import { sleep } from '../../core';
import { initialize, multirootPath } from '../../initialize';

const execAsync = promisify(exec);

class Venvs {
    private readonly prefix = '.venv-';
    private readonly python = PYTHON_PATH.fileToCommandArgument();
    private readonly fullPrefix: string;
    private readonly procEnv: ExecOptions;
    private pipInstaller?: string;
    constructor (
        private readonly topDir: string
    ) {
        this.fullPrefix = path.join(this.topDir, this.prefix);
        this.procEnv = {
            cwd: this.topDir
        };
    }

    public async create(id: string): Promise<string> {
        // Ensure env is unique to avoid conflicts in tests (corrupting
        // test data).
        const timestamp = new Date().getTime().toString();
        const root = `${this.fullPrefix}${id}-${timestamp}`;
        let argv = [
            this.python, '-m', 'venv',
            root
        ];

        try {
            try {
                await this.run(argv);
            } catch (err) {
                if (!`${err}`.includes('ensurepip') && getOSType() !== OSType.Linux) {
                    throw err; // re-throw
                }
                if (IS_CI_SERVER) {
                    throw err; // re-throw
                }
                argv = [
                    this.python, '-m', 'venv',
                    '--system-site-packages',
                    '--without-pip',
                    root
                ];
                await this.run(argv);
                await this.installPip(root);
            }
        } catch (err2) {
            throw Error(`command failed ${root}, ${this.python}, Error: ${err2}`);
        }

        return root;
    }

    public async cleanUp() {
        await deleteFiles(`${this.fullPrefix}*`);
        if (this.pipInstaller) {
            await deleteFiles(this.pipInstaller);
            this.pipInstaller = undefined;
        }
    }

    private async installPip(root: string) {
        const script = this.pipInstaller
            ? this.pipInstaller
            : path.join(this.topDir, 'get-pip.py');
        if (!this.pipInstaller) {
            const fs = new FileSystem();
            if (!await fs.fileExists(script)) {
                await this.run([
                    'curl',
                    'https://bootstrap.pypa.io/get-pip.py',
                    '-o', script
                ]);
            }
            this.pipInstaller = script;
        }
        await this.run([
            path.join(root, 'bin', 'python'),
            script
        ]);
    }

    private async run(argv: string[]) {
        const cmdline = argv.join(' ');
        const { stderr } = await execAsync(cmdline, this.procEnv);
        if (stderr && stderr.length > 0) {
            throw Error(stderr);
        }
    }
}

const timeoutMs = IS_CI_SERVER ? 60_000 : 15_000;
suite('Interpreters - Workspace VirtualEnv Service', function() {
    this.timeout(timeoutMs);
    this.retries(0);

    const workspaceUri = IS_MULTI_ROOT_TEST
        ? Uri.file(path.join(multirootPath, 'workspace3'))
        : rootWorkspaceUri!;
    const venvs = new Venvs(workspaceUri.fsPath);
    const workspace4 = Uri.file(path.join(multirootPath, 'workspace4'));

    let serviceContainer: IServiceContainer;
    let locator: IInterpreterLocatorService;

    async function manuallyTriggerFSWatcher(deferred: Deferred<void>) {
        // Monitoring files on virtualized environments can be finicky...
        // Lets trigger the fs watcher manually for the tests.
        const stopWatch = new StopWatch();
        const builder = serviceContainer.get<IInterpreterWatcherBuilder>(IInterpreterWatcherBuilder);
        const watcher = (await builder.getWorkspaceVirtualEnvInterpreterWatcher(
            workspaceUri
        )) as WorkspaceVirtualEnvWatcherService;
        const binDir = getOSType() === OSType.Windows ? 'Scripts' : 'bin';
        const executable = getOSType() === OSType.Windows ? 'python.exe' : 'python';
        while (!deferred.completed && stopWatch.elapsedTime < timeoutMs - 10_000) {
            const pythonPath = path.join(workspaceUri.fsPath, binDir, executable);
            watcher.createHandler(Uri.file(pythonPath)).ignoreErrors();
            await sleep(1000);
        }
    }
    async function waitForInterpreterToBeDetected(envNameToLookFor: string) {
        const predicate = async () => {
            const items = await locator.getInterpreters(workspaceUri);
            return items.some(item => item.envName === envNameToLookFor);
        };
        const promise = waitForCondition(
            predicate,
            timeoutMs,
            `${envNameToLookFor}, Environment not detected in the workspace ${workspaceUri.fsPath}`
        );
        const deferred = createDeferredFromPromise(promise);
        manuallyTriggerFSWatcher(deferred).ignoreErrors();
        await deferred.promise;
    }

    suiteSetup(async function() {
        // Tests disabled due to CI failures: https://github.com/microsoft/vscode-python/issues/8804
        // tslint:disable-next-line:no-invalid-this
        return this.skip();

        // skip for Python < 3, no venv support
        if (await isPythonVersionInProcess(undefined, '2')) {
            return this.skip();
        }

        serviceContainer = (await initialize()).serviceContainer;
        locator = serviceContainer.get<IInterpreterLocatorService>(
            IInterpreterLocatorService,
            WORKSPACE_VIRTUAL_ENV_SERVICE
        );
        // This test is required, we need to wait for interpreter listing completes,
        // before proceeding with other tests.
        await venvs.cleanUp();
        await locator.getInterpreters(workspaceUri);
    });

    suiteTeardown(venvs.cleanUp);
    teardown(venvs.cleanUp);

    test('Detect Virtual Environment', async () => {
        const envName = await venvs.create('one');
        await waitForInterpreterToBeDetected(envName);
    });

    test('Detect a new Virtual Environment', async () => {
        const env1 = await venvs.create('first');
        await waitForInterpreterToBeDetected(env1);

        // Ensure second environment in our workspace folder is detected when created.
        const env2 = await venvs.create('second');
        await waitForInterpreterToBeDetected(env2);
    });

    test('Detect a new Virtual Environment, and other workspace folder must not be affected (multiroot)', async function() {
        if (!IS_MULTI_ROOT_TEST) {
            return this.skip();
        }
        // There should be nothing in workspacec4.
        let items4 = await locator.getInterpreters(workspace4);
        expect(items4).to.be.lengthOf(0);

        const [env1, env2] = await Promise.all([
            venvs.create('first3'),
            venvs.create('second3')
        ]);
        await Promise.all([waitForInterpreterToBeDetected(env1), waitForInterpreterToBeDetected(env2)]);

        // Workspace4 should still not have any interpreters.
        items4 = await locator.getInterpreters(workspace4);
        expect(items4).to.be.lengthOf(0);
    });
});
