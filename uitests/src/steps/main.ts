// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import {
    After,
    AfterAll,
    Before,
    BeforeAll,
    HookScenarioResult,
    setDefaultTimeout,
    setDefinitionFunctionWrapper,
    setWorldConstructor,
    Status
} from 'cucumber';
import * as fs from 'fs-extra';
import * as path from 'path';
// import { PerformanceObserver } from 'perf_hooks';
import * as rimraf from 'rimraf';
import { extensionActivationTimeout, maxHookTimeout, maxStepTimeout } from '../constants';
import { noop, RetryOptions, retryWrapper } from '../helpers';
import { debug, error, warn } from '../helpers/logger';
import { getTestOptions, restoreDefaultUserSettings, TestOptions, waitForPythonExtensionToActivate } from '../setup';
import { clearWorkspace, dismissMessages, initializeWorkspace } from '../setup/environment';
import { IApplication, ITestOptions } from '../types';
import { Application } from '../vscode';
import { WorldParameters } from './types';

// tslint:disable: no-invalid-this mocha-no-side-effect-code no-any non-literal-require no-function-expression
// const times: string[] = [];
// const obs = new PerformanceObserver(list => {
//     const entry = list.getEntries()[0]!;
//     times.push(`Time for ('${entry.name}') ${entry.duration.toLocaleString()}`);
// });

// keeps track of the fact that we have dismissed onetime messages displayed in VSC.
// E.g. messages such as 'Tip: You can select an interpreter from statusbar'.
// Such messages will keep showing up until they are dismissed by user - never to be displayed again.
// Dismissing such messages makes it easy for testing (less noise when testing messages and less noice in screenshots).
// This will get reset when user loads VSC for first time.
let oneTimeMessagesDismissed = false;

/**
 * Context object available in every step.
 * Step = BDD Step such as `Given`, `When` and `Then`.
 *
 * @class MyWorld
 */
class MyWorld {
    public readonly app: IApplication;
    public readonly options: ITestOptions;
    constructor({ parameters, attach }: { attach: Function; parameters: WorldParameters }) {
        debug('Start MyWorld contructor');
        const testOptions = getTestOptions(
            parameters.channel,
            parameters.testDir,
            parameters.pythonPath,
            parameters.verboseLogging
        );
        this.app = new Application(testOptions);
        this.app.on('start', emulateFirstTimeLoad =>
            emulateFirstTimeLoad ? (oneTimeMessagesDismissed = false) : undefined
        );
        this.app.on('screenshotCatured', data => attach(data, 'image/png'));
        this.options = testOptions;
        debug('End MyWorld contructor');
    }
}
declare module 'cucumber' {
    /**
     * Context object available in every step.
     * Step = BDD Step such as `Given`, `When` and `Then`.
     *
     * @export
     * @interface World
     */
    // tslint:disable-next-line: interface-name
    export interface World {
        app: IApplication;
        options: ITestOptions;
    }
}

// obs.observe({ entryTypes: ['measure'], buffered: false }); //we want to react to full measurements and not individual marks

// type ScenarioTimes = Record<string, { start: string; stop?: string; durations: { before?: number; steps?: number; after?: number; total?: number } }>;
// const times: { beforeAll?: number; afterAll?: number; scenarios: ScenarioTimes } = { scenarios: {} };
// const stopWatch = new StopWatch();

setWorldConstructor(MyWorld);

// We might have steps that are slow, hence allow max timeouts of 2 minutes.
// Also easy for debugging.
setDefaultTimeout(maxStepTimeout);

// Wait for a max of 2 minutes (download VSC, install, activate python extension).
// All of this takes time when running the first time, hence allow max timeout of 2 minutes.
BeforeAll({ timeout: maxHookTimeout }, async function() {
    debug('Before all');
    // const options = getTestOptions(argv.channel, argv.destination, 'python', argv.verbose);
    // const app = new Application(options);
    // await app.start()
    //     .then(() => info('VS Code successfully launched'))
    //     .catch(console.error.bind(console, 'Failed to launch VS Code'));
    // await sleep(10000);
    // await app.quickopen.runCommand('View: Close Editor');
    // await new Promise(resolve => setTimeout(resolve, 3000));
    // performance.mark('BeforeAll-start');
    // const testOptions = await initialize();
    // const app = new Application(testOptions);
    // await app.start();
    // await activateAndDismissMessages(app);
    // await app.stop();
    // performance.mark('BeforeAll-end');
    // performance.measure('BeforeAll', 'BeforeAll-start', 'BeforeAll-end');
});

// const lastSetWorkspaceFolder = '';
Before(async function(scenario: HookScenarioResult) {
    debug('Start Before');
    const options = (this.app as Application).options as TestOptions;
    await options.updateForScenario(scenario);
    // Initialize the workspace with the required code.
    // I.e. if required download the source that's meant to be used for testing (from a git repo).
    // Optionally if we're to use a new sub directory in the repo, then update the workspace folder accordingly.
    const newWorkspaceFolder = await initializeWorkspace(scenario, this.app.workspacePathOrFolder);
    if (newWorkspaceFolder) {
        options.udpateWorkspaceFolder(newWorkspaceFolder);
    }

    // These must never change (we control the test environment, hence we need to ensure `settings.json` is as expected).
    // For every test this will be reset (possible a test had updated the user settings).
    await restoreDefaultUserSettings(options);
    await this.app.start();
    // Activating extension can be slow on windows.
    await waitForPythonExtensionToActivate(extensionActivationTimeout, this.app);

    debug('Waiting for VSC & Python Extension to display its messages, so they can be dimissed');
    // Rather than waiting & then dismissing messages, just keep retrying to dismiss messages for 5 seconds.
    const dismiss = async () => dismissMessages(this.app).then(() => Promise.reject());
    const timeout = oneTimeMessagesDismissed ? 5000 : 1000;
    await retryWrapper({ timeout, logFailures: false }, dismiss).catch(noop);
    oneTimeMessagesDismissed = true;

    // Since we activated the python extension, lets close and reload.
    // For the tests the extension should not be activated (the tests will do that).
    await this.app.reload();

    // performance.mark(`${scenario.pickle.name}-start`);
    // performance.mark(`${scenario.pickle.name}-before-start`);
    // const location = scenario.pickle.locations[0].line;
    // const sourceLocation = path.relative(featurePath, scenario.sourceLocation.uri);
    // const scenarioLogsPath = path.join(sourceLocation, `${scenario.pickle.name}:${location}`.replace(/[^a-z0-9\-]/gi, '_'));

    // async function beforeHook() {
    //     try {
    //         // Do not move this list, this is required to initialize the context.
    //         context.scenario = scenario;
    //         await initializeTestScenarioPaths(scenarioLogsPath);
    //         await context.app.stop().catch(noop);
    //         const app = context.app;
    //         await fs.emptyDir(context.options.tempPath);
    //         await resetWorkspace();
    //         await restoreDefaultUserSettings();
    //         await app.restart({ workspaceOrFolder: context.options.workspacePathOrFolder });
    //         await dismissMessages();
    //     } catch (ex) {
    //         // Handle exception as cucumber doesn't handle (log) errors in hooks too well.
    //         // Basically they aren't logged, i.e. get swallowed up.
    //         console.error('Before hook failed', ex);
    //         throw ex;
    //     }
    // }
    // // Sometimes it fails due to connectivity issues.
    // await retryWrapper({ count: 3 }, beforeHook);
    // performance.mark(`${scenario.pickle.name}-before-end`);
    // performance.measure(`${scenario.pickle.name}-before`, `${scenario.pickle.name}-before-start`, `${scenario.pickle.name}-before-end`);
});

After(async function(scenario: HookScenarioResult) {
    // Close all editors, etc.
    // Finally reset user history.
    // performance.mark(`${scenario.pickle.name}-after-start`);
    try {
        if (this.app.isAlive) {
            // Capture a screenshot after every scenario.
            // Whether it fails or not (very useful when trying to figure out whether a test actually ran, why it failed, etc).
            const name = `After_${new Date().getTime()}`;
            // If VS Code has died, then ignore the errors (capturing screenshots will fail).
            await this.app.captureScreenshot(name).catch(warn.bind(warn, 'Failed to capture after hook screenshot.'));
            await dismissMessages(this.app);
            // If VS Code has died, then ignore the errors (clearing workspace using `commands` from the `command palette` will fail).
            await clearWorkspace(this.app).catch(warn.bind(warn, 'Failed to clear the workspace.'));
        }
    } catch (ex) {
        // Handle exception as cucumber doesn't handle (log) errors in hooks too well.
        // Basically they aren't logged, i.e. get swallowed up.
        error('After hook failed', ex);
        throw ex;
    } finally {
        await this.app.exit().catch(warn.bind(warn, 'Failed to exit in After hook'));
        const options = (this.app as Application).options;
        if (scenario.result.status === Status.PASSED) {
            // If the tests have passed, then delete everything related to previous tests.
            // Delete screenshots, logs, everything that's transient.
            await Promise.all([
                new Promise(resolve => rimraf(options.logsPath, resolve)).catch(noop),
                new Promise(resolve => rimraf(options.reportsPath, resolve)).catch(noop),
                new Promise(resolve => rimraf(options.screenshotsPath, resolve)).catch(noop),
                new Promise(resolve => rimraf(options.tempPath, resolve)).catch(noop),
                new Promise(resolve => rimraf(options.workspacePathOrFolder, resolve)).catch(noop)
            ]);
        } else {
            // Ok, test failed, copy everythign we'll need to triage this issue.
            // State of the workspace folder, logs, screenshots, everything.
            // Rememeber, screenshots are specific to each test (hence they are preserved as long as we don't delete them).
            await fs.copy(options.workspacePathOrFolder, path.join(options.reportsPath, 'workspace folder'));
            await fs.copyFile(options.userSettingsFilePath, path.join(options.reportsPath, 'user_settings.json'));
            await Promise.all([
                new Promise(resolve => rimraf(options.workspacePathOrFolder, resolve)).catch(noop),
                new Promise(resolve => rimraf(options.tempPath, resolve)).catch(noop)
            ]);
        }
    }
    // performance.mark(`${scenario.pickle.name}-after-end`);
    // performance.mark(`${scenario.pickle.name}-end`);
    // performance.measure(`${scenario.pickle.name}-after`, `${scenario.pickle.name}-after-start`, `${scenario.pickle.name}-after-end`);
    // performance.measure(scenario.pickle.name, `${scenario.pickle.name}-start`, `${scenario.pickle.name}-end`);
});

AfterAll({ timeout: maxHookTimeout }, async function() {
    // performance.mark('AfterAll-start');
    // // Possible it has already died.
    // await clearWorkspace().catch(noop);
    // await context.app.stop().catch(ex => console.error('Failed to shutdown gracefully', ex));
    // performance.mark('AfterAll-end');
    // performance.measure('AfterAll', 'AfterAll-start', 'AfterAll-end');
    // console.log(`\n${times.join('\n')}`);
});
/*
 * Create a wrapper for all steps to re-try if the step is configured for retry.
 * (its possible the UI isn't ready, hence we need to re-try some steps).
 *
 * Cast to any as type definitions setDefinitionFunctionWrapper is wrong.
 */
type AsyncFunction = (...args: any[]) => Promise<any>;
(setDefinitionFunctionWrapper as any)(function(fn: Function, opts?: { retry?: RetryOptions }) {
    return async function(this: {}) {
        const args = [].slice.call(arguments);
        if (!opts || !opts.retry) {
            return fn.apply(this, args);
        }
        return retryWrapper.bind(this)(opts.retry, fn as AsyncFunction, ...args);
    };
});

// /*
// Capture screenshots after every step.
// */
// (setDefinitionFunctionWrapper as any)(function (fn: Function) {
//     async function captureScreenshot() {
//         try {
//             const name = `After_${new Date().getTime()}`.replace(/[^a-z0-9\-]/gi, '_');
//             // Ignore errors, as its possible app hasn't started.
//             await context.app.captureScreenshot(name).catch(noop);
//         } catch { noop(); }
//     }
//     return async function (this: {}) {
//         const result = fn.apply(this, [].slice.call(arguments));
//         if (result.then) {
//             return (result as Promise<any>).finally(captureScreenshot);
//         } else {
//             await captureScreenshot();
//             return result;
//         }
//     };
// });
