'use strict';

// tslint:disable:no-var-requires no-require-imports

// This line should always be right on top.
// tslint:disable:no-any
if ((Reflect as any).metadata === undefined) {
    require('reflect-metadata');
}

// Initialize source maps (this must never be moved up nor further down).
import { initialize } from './sourceMapSupport';
initialize(require('vscode'));
// Initialize the logger first.
require('./common/logger');

//===============================================
// We start tracking the extension's startup time at this point.  The
// locations at which we record various Intervals are marked below in
// the same way as this.

const durations: Record<string, number> = {};
import { StopWatch } from './common/utils/stopWatch';
// Do not move this line of code (used to measure extension load times).
const stopWatch = new StopWatch();

//===============================================
// loading starts here

import { ProgressLocation, ProgressOptions, window } from 'vscode';

import { buildApi, IExtensionApi } from './api';
import { IApplicationShell } from './common/application/types';
import { traceError } from './common/logger';
import { IAsyncDisposableRegistry, IExtensionContext } from './common/types';
import { createDeferred } from './common/utils/async';
import { Common } from './common/utils/localize';
import { activateComponents } from './extensionActivation';
import { isBlocked, promptBlock, promptUnblock } from './extensionBlocked';
import { initializeComponents, initializeGlobals } from './extensionInit';
import { IServiceContainer } from './ioc/types';
import { sendErrorTelemetry, sendSuccessTelemetry } from './startupTelemetry';

durations.codeLoadingTime = stopWatch.elapsedTime;

//===============================================
// loading ends here

// These persist between activations:
let activatedServiceContainer: IServiceContainer | undefined;

/////////////////////////////
// public functions

export async function activate(context: IExtensionContext): Promise<IExtensionApi> {
    const [ready, api] = await activationErrorsTracked(async () => {
        return activateMaybeDeferred(context, stopWatch, durations);
    });

    // Send the "success" telemetry only if activation did not fail.
    // Otherwise Telemetry is send via the error handler.
    ready
        .catch(err => {
            traceError('deferred activation failed', err);
            throw err; // re-throw
        })
        .then(() => {
            durations.totalActivateTime = stopWatch.elapsedTime;
        })
        .then(() => sendSuccessTelemetry(durations, activatedServiceContainer!))
        // Run in the background.
        .ignoreErrors();

    return api;
}

export function deactivate(): Thenable<void> {
    // Make sure to shutdown anybody who needs it.
    if (activatedServiceContainer) {
        const registry = activatedServiceContainer.get<IAsyncDisposableRegistry>(IAsyncDisposableRegistry);
        if (registry) {
            return registry.dispose();
        }
    }

    return Promise.resolve();
}

/////////////////////////////
// activation helpers

async function activateMaybeDeferred(
    context: IExtensionContext,
    startupStopWatch: StopWatch,
    startupDurations: Record<string, number>
): Promise<[Promise<void>, IExtensionApi]> {
    const [activated, started, api] = startActivation(context, startupStopWatch, startupDurations);

    const blocked = await isBlocked(context);
    if (blocked === false) {
        await activated;
    } else if (blocked) {
        async function runInBackground() {
            if (await promptUnblock()) {
                try {
                    await activated;
                } catch (ex) {
                    await handleError(ex, startupDurations);
                }
            }
        }
        // Do not await.
        runInBackground().ignoreErrors();
    } else {
        async function runInBackground() {
            if ((await promptBlock()) === false) {
                try {
                    await activated;
                } catch (ex) {
                    await handleError(ex, startupDurations);
                }
            }
        }
        // Do not await.
        runInBackground().ignoreErrors();
    }
    return [started, api];
}

function startActivation(
    context: IExtensionContext,
    startupStopWatch: StopWatch,
    startupDurations: Record<string, number>
): [Promise<void>, Promise<void>, IExtensionApi] {
    const activated = createDeferred<void>();
    displayProgress(activated.promise);
    try {
        startupDurations.startActivateTime = startupStopWatch.elapsedTime;

        const [serviceManager, serviceContainer] = initializeGlobals(context);
        activatedServiceContainer = serviceContainer;
        initializeComponents(context, serviceManager, serviceContainer);

        const started = createDeferred<void>();
        async function activateExtension() {
            try {
                const [promise, _activated] = await activateComponents(context, serviceManager, serviceContainer);
                // tslint:disable-next-line:no-unused-expression
                _activated; // This quiets the compiler.
                // Propagate the non-blocking activation promise.
                promise.then(() => started.resolve(), started.reject);
                startupDurations.endActivateTime = startupStopWatch.elapsedTime;
            } finally {
                activated.resolve();
            }
        }
        return [
            activateExtension(),
            started.promise,
            // We can create the API object at this point, but not
            // all of it is guaranteed to work until the extension
            // has fully started.
            buildApi(started.promise, serviceManager, serviceContainer)
        ];
    } catch (err) {
        activated.resolve();
        throw err; // re-throw
    }
}

// tslint:disable-next-line:no-any
function displayProgress(promise: Promise<any>) {
    const progressOptions: ProgressOptions = { location: ProgressLocation.Window, title: Common.loadingExtension() };
    window.withProgress(progressOptions, () => promise);
}

async function activationErrorsTracked(activateExtension: () => Promise<[Promise<void>, IExtensionApi]>) {
    try {
        return activateExtension();
    } catch (ex) {
        // We want to completely handle the error
        // before notifying VS Code.
        await handleError(ex, durations);
        throw ex; // re-raise
    }
}

/////////////////////////////
// error handling

async function handleError(ex: Error, startupDurations: Record<string, number>) {
    notifyUser(
        "Extension activation failed, run the 'Developer: Toggle Developer Tools' command for more information."
    );
    traceError('extension activation failed', ex);
    await sendErrorTelemetry(ex, startupDurations, activatedServiceContainer);
}

interface IAppShell {
    showErrorMessage(string: string): Promise<void>;
}

function notifyUser(msg: string) {
    try {
        // tslint:disable-next-line:no-any
        let appShell: IAppShell = (window as any) as IAppShell;
        if (activatedServiceContainer) {
            // tslint:disable-next-line:no-any
            appShell = (activatedServiceContainer.get<IApplicationShell>(IApplicationShell) as any) as IAppShell;
        }
        appShell.showErrorMessage(msg).ignoreErrors();
    } catch (ex) {
        traceError('failed to notify user', ex);
    }
}
