// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { After, AfterAll, Before, BeforeAll, HookScenarioResult, setDefaultTimeout, setDefinitionFunctionWrapper, setWorldConstructor, Status } from 'cucumber';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Application, context } from './application';
import { featurePath, maxHookTimeout, maxStepTimeout } from './constants';
import { AsyncFunction, noop, RetryOptions, retryWrapper } from './helpers';
import { activateAndDismissMessages, clearWorkspace, dismissMessages, resetWorkspace } from './setup';
import { initialize, initializeBasePaths, restoreDefaultUserSettings } from './setup/setup';

// tslint:disable: no-invalid-this mocha-no-side-effect-code no-any non-literal-require no-function-expression no-console

setWorldConstructor(function (options: { attach: Function }) {
    const hook = (buffer: Buffer) => options.attach(buffer, 'image/png');
    context.app.registerScreenshotHook(hook);
    context.app.registerAttachHook(options.attach.bind(options));
});

// We might have steps that are slow, hence allow max timeouts of 2 minutes.
// Also easy for debugging.
setDefaultTimeout(maxStepTimeout);

// Wait for a max of 2 minutes (download VSC, install, activate python extension).
// All of this takes time when running the first time, hence allow max timeout of 2 minutes.
BeforeAll({ timeout: maxHookTimeout }, async function () {
    const testOptions = await initialize();
    const app = new Application(testOptions);
    await app.start();
    await activateAndDismissMessages(app);
    await app.stop();
});

// const lastSetWorkspaceFolder = '';
Before(async function (scenario: HookScenarioResult) {
    const location = scenario.pickle.locations[0].line;
    const sourceLocation = path.relative(featurePath, scenario.sourceLocation.uri);
    const scenarioLogsPath = path.join(sourceLocation, `${scenario.pickle.name}:${location}`.replace(/[^a-z0-9\-]/gi, '_'));

    async function beforeHook() {
        try {
            // Do not move this list, this is required to initialize the context.
            context.scenario = scenario;
            await initializeBasePaths(scenarioLogsPath);
            await context.app.stop().catch(noop);
            const app = context.app;
            await fs.emptyDir(context.options.tempPath);
            await resetWorkspace();
            await restoreDefaultUserSettings();
            await app.restart({ workspaceOrFolder: context.options.workspacePathOrFolder });
            await dismissMessages();
        } catch (ex) {
            // Handle exception as cucumber doesn't handle (log) errors in hooks too well.
            // Basically they aren't logged, i.e. get swallowed up.
            console.error('Before hook failed', ex);
            throw ex;
        }
    }
    // Sometimes it fails due to connectivity issues.
    await retryWrapper({ count: 3 }, beforeHook);
});

After(async function (scenario: HookScenarioResult) {
    try {
        const name = `After_${new Date().getTime()}`.replace(/[^a-z0-9\-]/gi, '_');
        // Ignore errors, as its possible app hasn't started.
        await context.app.captureScreenshot(name).catch(noop);
        await dismissMessages();
        // Possible it has already died.
        await clearWorkspace().catch(noop);
    } catch (ex) {
        // If we had errors, kill VSC.
        await context.app.stop().catch(noop);

        // Handle exception as cucumber doesn't handle (log) errors in hooks too well.
        // Basically they aren't logged, i.e. get swallowed up.
        console.error('After hook failed', ex);
        throw ex;
    } finally {
        if (scenario.result.status === Status.PASSED) {
            await fs.emptyDir(context.options.logsPath).catch(noop);
        }
    }
});

AfterAll({ timeout: maxHookTimeout }, async function () {
    // Possible it has already died.
    await clearWorkspace().catch(noop);
    await context.app.stop().catch(ex => {
        console.error('Failed to shutdown gracefully', ex);
    });
});

/*
 * Create a wrapper for all steps to re-try if the step is configured for retry.
 * (its possible the UI isn't ready, hence we need to re-try some steps).
 *
 * Cast to any as type definitions setDefinitionFunctionWrapper is wrong.
*/
(setDefinitionFunctionWrapper as any)(function (fn: Function, opts?: { retry?: RetryOptions }) {
    return async function (this: {}) {
        const args = [].slice.call(arguments);
        if (!opts || !opts.retry) {
            return fn.apply(this, args);
        }
        return retryWrapper.bind(this)(opts.retry, fn as AsyncFunction, ...args);
    };
});
