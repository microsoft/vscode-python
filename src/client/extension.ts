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
import { initializeComponents, initializeGlobals } from './extensionInit';
import { IServiceContainer } from './ioc/types';
import { sendErrorTelemetry, sendStartupTelemetryInBackground } from './startupTelemetry';

durations.codeLoadingTime = stopWatch.elapsedTime;

//===============================================
// loading ends here

// These persist between activations:
const activationDeferred = createDeferred<void>();
let activatedServiceContainer: IServiceContainer | undefined;

/////////////////////////////
// public functions

export async function activate(context: IExtensionContext): Promise<IExtensionApi> {
    try {
        return await activateUnsafe(context);
    } catch (ex) {
        // We want to completely handle the error
        // before notifying VS Code.
        await handleError(ex);
        throw ex; // re-raise
    }
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

// tslint:disable-next-line:max-func-body-length
async function activateUnsafe(context: IExtensionContext): Promise<IExtensionApi> {
    displayProgress(activationDeferred.promise);
    durations.startActivateTime = stopWatch.elapsedTime;

    //===============================================
    // activation starts here

    const [serviceManager, serviceContainer] = initializeGlobals(context);
    activatedServiceContainer = serviceContainer;
    initializeComponents(context, serviceManager, serviceContainer);
    const activationPromise = activateComponents(context, serviceManager, serviceContainer);

    //===============================================
    // activation ends here

    durations.endActivateTime = stopWatch.elapsedTime;
    activationDeferred.resolve();

    sendStartupTelemetryInBackground(activationPromise, durations, stopWatch, serviceContainer);

    return buildApi(activationPromise, serviceManager, serviceContainer);
}

// tslint:disable-next-line:no-any
function displayProgress(promise: Promise<any>) {
    const progressOptions: ProgressOptions = { location: ProgressLocation.Window, title: Common.loadingExtension() };
    window.withProgress(progressOptions, () => promise);
}

/////////////////////////////
// error handling

async function handleError(ex: Error) {
    notifyUser(
        "Extension activation failed, run the 'Developer: Toggle Developer Tools' command for more information."
    );
    traceError('extension activation failed', ex);
    await sendErrorTelemetry(ex, durations, activatedServiceContainer);
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
