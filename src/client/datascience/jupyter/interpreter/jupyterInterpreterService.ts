// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Event, EventEmitter } from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';
import { createPromiseFromCancellation } from '../../../common/cancellation';
import '../../../common/extensions';
import { IInterpreterService, PythonInterpreter } from '../../../interpreter/contracts';
import { sendTelemetryEvent } from '../../../telemetry';
import { Telemetry } from '../../constants';
import {
    JupyterInterpreterDependencyResponse,
    JupyterInterpreterDependencyService
} from './jupyterInterpreterDependencyService';
import { JupyterInterpreterOldCacheStateStore } from './jupyterInterpreterOldCacheStateStore';
import { JupyterInterpreterSelector } from './jupyterInterpreterSelector';
import { JupyterInterpreterStateStore } from './jupyterInterpreterStateStore';

@injectable()
export class JupyterInterpreterService {
    private _selectedInterpreter?: PythonInterpreter;
    private _onDidChangeInterpreter = new EventEmitter<PythonInterpreter>();
    private setInitialInterpreterPromise: Promise<PythonInterpreter | undefined> | undefined;
    public get onDidChangeInterpreter(): Event<PythonInterpreter> {
        return this._onDidChangeInterpreter.event;
    }

    constructor(
        @inject(JupyterInterpreterOldCacheStateStore)
        private readonly oldVersionCacheStateStore: JupyterInterpreterOldCacheStateStore,
        @inject(JupyterInterpreterStateStore) private readonly interpreterSelectionState: JupyterInterpreterStateStore,
        @inject(JupyterInterpreterSelector) private readonly jupyterInterpreterSelector: JupyterInterpreterSelector,
        @inject(JupyterInterpreterDependencyService)
        private readonly interpreterConfiguration: JupyterInterpreterDependencyService,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService
    ) {}
    /**
     * Gets the selected interpreter configured to run Jupyter.
     *
     * @param {CancellationToken} [token]
     * @returns {(Promise<PythonInterpreter | undefined>)}
     * @memberof JupyterInterpreterService
     */
    public async getSelectedInterpreter(token?: CancellationToken): Promise<PythonInterpreter | undefined> {
        // Before we return _selected interpreter make sure that we have run our initial set interpreter once
        await this.setInitialInterpreter(token);

        return this._selectedInterpreter;
    }

    // To be run one initial time. Check our saved locations and then current interpreter to try to start off
    // with a valid jupyter interpreter
    public async setInitialInterpreter(token?: CancellationToken): Promise<PythonInterpreter | undefined> {
        if (!this.setInitialInterpreterPromise) {
            this.setInitialInterpreterPromise = this.setInitialInterpreterImpl(token);
        }

        return this.setInitialInterpreterPromise;
    }

    /**
     * Selects and interpreter to run jupyter server.
     * Validates and configures the interpreter.
     * Once completed, the interpreter is stored in settings, else user can select another interpreter.
     *
     * @param {CancellationToken} [token]
     * @returns {(Promise<PythonInterpreter | undefined>)}
     * @memberof JupyterInterpreterService
     */
    public async selectInterpreter(token?: CancellationToken): Promise<PythonInterpreter | undefined> {
        const resolveToUndefinedWhenCancelled = createPromiseFromCancellation({
            cancelAction: 'resolve',
            defaultValue: undefined,
            token
        });
        const interpreter = await Promise.race([
            this.jupyterInterpreterSelector.selectInterpreter(),
            resolveToUndefinedWhenCancelled
        ]);
        if (!interpreter) {
            sendTelemetryEvent(Telemetry.SelectJupyterInterpreter, undefined, { result: 'notSelected' });
            return;
        }

        const result = await this.interpreterConfiguration.installMissingDependencies(interpreter, undefined, token);
        switch (result) {
            case JupyterInterpreterDependencyResponse.ok: {
                this.setAsSelectedInterpreter(interpreter);
                return interpreter;
            }
            case JupyterInterpreterDependencyResponse.cancel:
                sendTelemetryEvent(Telemetry.SelectJupyterInterpreter, undefined, { result: 'installationCancelled' });
                return;
            default:
                return this.selectInterpreter(token);
        }
    }

    // Check the location that we stored jupyter launch path in the old version
    // if it's there, return it and clear the location
    private getInterpreterFromChangeOfOlderVersionOfExtension(): string | undefined {
        const pythonPath = this.oldVersionCacheStateStore.getCachedInterpreterPath();
        if (!pythonPath) {
            return;
        }

        // Clear the cache to not check again
        this.oldVersionCacheStateStore.clearCache().ignoreErrors();
        return pythonPath;
    }

    // Set the specified interpreter as our current selected interpreter
    private setAsSelectedInterpreter(interpreter: PythonInterpreter): void {
        this._selectedInterpreter = interpreter;
        this._onDidChangeInterpreter.fire(interpreter);
        this.interpreterSelectionState.updateSelectedPythonPath(interpreter.path);
        sendTelemetryEvent(Telemetry.SelectJupyterInterpreter, undefined, { result: 'selected' });
    }

    // For a given python path check if it can run jupyter for us
    // if so, return the interpreter
    private async validateInterpreterPath(
        pythonPath: string,
        token?: CancellationToken
    ): Promise<PythonInterpreter | undefined> {
        const resolveToUndefinedWhenCancelled = createPromiseFromCancellation({
            cancelAction: 'resolve',
            defaultValue: undefined,
            token
        });

        // First see if we can get interpreter details
        const interpreter = await Promise.race([
            this.interpreterService.getInterpreterDetails(pythonPath, undefined),
            resolveToUndefinedWhenCancelled
        ]);
        if (interpreter) {
            // Then check that dependencies are installed
            if (await this.interpreterConfiguration.areDependenciesInstalled(interpreter)) {
                return interpreter;
            }
        }
        return undefined;
    }

    private async setInitialInterpreterImpl(token?: CancellationToken): Promise<PythonInterpreter | undefined> {
        let interpreter: PythonInterpreter | undefined;

        // Check the old version location first, we will clear it if we find it here
        const oldVersionPythonPath = this.getInterpreterFromChangeOfOlderVersionOfExtension();
        if (oldVersionPythonPath) {
            interpreter = await this.validateInterpreterPath(oldVersionPythonPath, token);
        }

        // Next check the saved global path
        if (!interpreter && this.interpreterSelectionState.selectedPythonPath) {
            interpreter = await this.validateInterpreterPath(this.interpreterSelectionState.selectedPythonPath, token);

            // If we had a global path, but it's not valid, trash it
            if (!interpreter) {
                this.interpreterSelectionState.updateSelectedPythonPath(undefined);
            }
        }

        // Nothing saved found, so check our current interpreter
        if (!interpreter) {
            const currentInterpreter = await this.interpreterService.getActiveInterpreter(undefined);

            if (currentInterpreter) {
                // Ask and give a chance to install dependencies in current interpreter
                if (await this.interpreterConfiguration.areDependenciesInstalled(currentInterpreter)) {
                    interpreter = currentInterpreter;
                }
            }
        }

        // Set ourselves as a valid interpreter
        if (interpreter) {
            this.setAsSelectedInterpreter(interpreter);
        }

        return interpreter;
    }
}
