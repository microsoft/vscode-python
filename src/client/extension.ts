'use strict';

// This line should always be right on top.

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

const durations = {} as IStartupDurations;
import { StopWatch } from './common/utils/stopWatch';
// Do not move this line of code (used to measure extension load times).
const stopWatch = new StopWatch();

//===============================================
// loading starts here

import { ProgressLocation, ProgressOptions, window } from 'vscode';

import { buildApi, IExtensionApi } from './api';
import { IApplicationShell, IWorkspaceService } from './common/application/types';
import { traceError } from './common/logger';
import { IAsyncDisposableRegistry, IExperimentService, IExtensionContext } from './common/types';
import { createDeferred } from './common/utils/async';
import { Common } from './common/utils/localize';
import { activateComponents } from './extensionActivation';
import { initializeStandard, initializeComponents, initializeGlobals } from './extensionInit';
import { IServiceContainer } from './ioc/types';
import { sendErrorTelemetry, sendStartupTelemetry } from './startupTelemetry';
import { IStartupDurations } from './types';
import { runAfterActivation } from './common/utils/runAfterActivation';
import { IInterpreterService } from './interpreter/contracts';

durations.codeLoadingTime = stopWatch.elapsedTime;

//===============================================
// loading ends here

// These persist between activations:
let activatedServiceContainer: IServiceContainer | undefined;

/////////////////////////////
// public functions

export async function activate(context: IExtensionContext): Promise<IExtensionApi> {
    let api: IExtensionApi;
    let ready: Promise<void>;
    let serviceContainer: IServiceContainer;
    try {
        [api, ready, serviceContainer] = await activateUnsafe(context, stopWatch, durations);
    } catch (ex) {
        // We want to completely handle the error
        // before notifying VS Code.
        await handleError(ex, durations);
        throw ex; // re-raise
    }
    // Send the "success" telemetry only if activation did not fail.
    // Otherwise Telemetry is send via the error handler.
    sendStartupTelemetry(ready, durations, stopWatch, serviceContainer)
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

async function activateUnsafe(
    context: IExtensionContext,
    startupStopWatch: StopWatch,
    startupDurations: IStartupDurations,
): Promise<[IExtensionApi, Promise<void>, IServiceContainer]> {
    const activationDeferred = createDeferred<void>();
    displayProgress(activationDeferred.promise);
    startupDurations.startActivateTime = startupStopWatch.elapsedTime;

    //===============================================
    // activation starts here

    // First we initialize.
    const ext = initializeGlobals(context);
    activatedServiceContainer = ext.legacyIOC.serviceContainer;
    // Note standard utils especially experiment and platform code are fundamental to the extension
    // and should be available before we activate anything else.Hence register them first.
    initializeStandard(ext);
    // We need to activate experiments before initializing components as objects are created or not created based on experiments.
    const experimentService = activatedServiceContainer.get<IExperimentService>(IExperimentService);
    // This guarantees that all experiment information has loaded & all telemetry will contain experiment info.
    await experimentService.activate();
    const components = await initializeComponents(ext);

    // Then we finish activating.
    const componentsActivated = await activateComponents(ext, components);
    const nonBlocking = componentsActivated.map((r) => r.fullyReady);
    const activationPromise = (async () => {
        await Promise.all(nonBlocking);
    })();

    //===============================================
    // activation ends here

    startupDurations.totalActivateTime = startupStopWatch.elapsedTime - startupDurations.startActivateTime;
    activationDeferred.resolve();

    setTimeout(async () => {
        if (activatedServiceContainer) {
            const interpreterManager = activatedServiceContainer.get<IInterpreterService>(IInterpreterService);
            const workspaceService = activatedServiceContainer.get<IWorkspaceService>(IWorkspaceService);
            const workspaces = workspaceService.workspaceFolders ?? [];
            await interpreterManager
                .refresh(workspaces.length > 0 ? workspaces[0].uri : undefined)
                .catch((ex) => traceError('Python Extension: interpreterManager.refresh', ex));
        }

        runAfterActivation();
    });

    const api = buildApi(activationPromise, ext.legacyIOC.serviceManager, ext.legacyIOC.serviceContainer);
    return [api, activationPromise, ext.legacyIOC.serviceContainer];
}

function displayProgress(promise: Promise<any>) {
    const progressOptions: ProgressOptions = { location: ProgressLocation.Window, title: Common.loadingExtension() };
    window.withProgress(progressOptions, () => promise);
}

/////////////////////////////
// error handling

async function handleError(ex: Error, startupDurations: IStartupDurations) {
    notifyUser(
        "Extension activation failed, run the 'Developer: Toggle Developer Tools' command for more information.",
    );
    traceError('extension activation failed', ex);
    await sendErrorTelemetry(ex, startupDurations, activatedServiceContainer);
}

interface IAppShell {
    showErrorMessage(string: string): Promise<void>;
}

function notifyUser(msg: string) {
    try {
        let appShell: IAppShell = (window as any) as IAppShell;
        if (activatedServiceContainer) {
            appShell = (activatedServiceContainer.get<IApplicationShell>(IApplicationShell) as any) as IAppShell;
        }
        appShell.showErrorMessage(msg).ignoreErrors();
    } catch (ex) {
        traceError('failed to notify user', ex);
    }
}
