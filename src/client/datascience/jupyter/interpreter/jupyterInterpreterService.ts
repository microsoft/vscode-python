// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Event, EventEmitter } from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';
import { createPromiseFromCancellation } from '../../../common/cancellation';
import '../../../common/extensions';
import { traceInfo } from '../../../common/logger';
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
    private _selectedInterpreterPath?: string;
    private _onDidChangeInterpreter = new EventEmitter<PythonInterpreter>();
    private validateSavedInterpreterPromise: Promise<boolean> | undefined;
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
    public async validateSavedInterpreter(): Promise<boolean> {
        if (!this.validateSavedInterpreterPromise) {
            this.validateSavedInterpreterPromise = this.validateSavedInterpreterImpl();
        }

        return this.validateSavedInterpreterPromise;
    }
    /**
     * Gets the selected interpreter configured to run Jupyter.
     *
     * @param {CancellationToken} [token]
     * @returns {(Promise<PythonInterpreter | undefined>)}
     * @memberof JupyterInterpreterService
     */
    public async getSelectedInterpreter(token?: CancellationToken): Promise<PythonInterpreter | undefined> {
        if (this._selectedInterpreter) {
            return this._selectedInterpreter;
        }

        const resolveToUndefinedWhenCancelled = createPromiseFromCancellation({
            cancelAction: 'resolve',
            defaultValue: undefined,
            token
        });
        // For backwards compatiblity check if we have a cached interpreter (older version of extension).
        // If that interpreter has everything we need then use that.
        let interpreter = await Promise.race([
            this.getInterpreterFromChangeOfOlderVersionOfExtension(),
            resolveToUndefinedWhenCancelled
        ]);
        if (interpreter) {
            return interpreter;
        }

        let pythonPath = this._selectedInterpreterPath;

        if (!pythonPath && this.interpreterSelectionState.selectedPythonPath) {
            // On activate we kick off a check to see if the saved interpreter is still valid
            // make sure that has completed before we actually use it as a valid interpreter
            if (await this.validateSavedInterpreter()) {
                pythonPath = this.interpreterSelectionState.selectedPythonPath;
            }
        }

        // If nothing saved, then check our current interpreter to see if we can use it
        if (!pythonPath) {
            // Check if current interpreter has all of the required dependencies.
            // If yes, then use that.
            interpreter = await this.interpreterService.getActiveInterpreter(undefined);
            if (!interpreter) {
                return;
            }
            // Use this interpreter going forward.
            if (await this.interpreterConfiguration.areDependenciesInstalled(interpreter)) {
                this.setAsSelectedInterpreter(interpreter);
                return interpreter;
            }
            return;
        }

        const interpreterDetails = await Promise.race([
            this.interpreterService.getInterpreterDetails(pythonPath, undefined),
            resolveToUndefinedWhenCancelled
        ]);
        if (interpreterDetails) {
            this._selectedInterpreter = interpreterDetails;
        }
        return interpreterDetails;
    }

    // Verify if a saved global interpreter is still valid for use
    // If not, then clear it out
    public async checkSavedInterpreter(): Promise<void> {
        if (!this.interpreterSelectionState.selectedPythonPath) {
            // None set yet, so no need to check
            return;
        }

        try {
            const interpreterDetails = await this.interpreterService.getInterpreterDetails(
                this.interpreterSelectionState.selectedPythonPath,
                undefined
            );

            if (interpreterDetails) {
                if (await this.interpreterConfiguration.areDependenciesInstalled(interpreterDetails, undefined)) {
                    // Our saved interpreter was found and has dependencies installed
                    return;
                }
            }
        } catch (_err) {
            traceInfo('Saved Jupyter interpreter invalid');
        }

        // At this point we failed some aspect of our checks regarding our saved interpreter, so clear it out
        this._selectedInterpreter = undefined;
        this.interpreterSelectionState.updateSelectedPythonPath(undefined);
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
    private async getInterpreterFromChangeOfOlderVersionOfExtension(): Promise<PythonInterpreter | undefined> {
        const pythonPath = this.oldVersionCacheStateStore.getCachedInterpreterPath();
        if (!pythonPath) {
            return;
        }
        try {
            const interpreter = await this.interpreterService.getInterpreterDetails(pythonPath, undefined);
            if (!interpreter) {
                return;
            }
            if (await this.interpreterConfiguration.areDependenciesInstalled(interpreter)) {
                this.setAsSelectedInterpreter(interpreter);
                return interpreter;
            }
            // If dependencies are not installed, then ignore it. lets continue with the current logic.
        } finally {
            // Don't perform this check again, just clear the cache.
            this.oldVersionCacheStateStore.clearCache().ignoreErrors();
        }
    }
    private setAsSelectedInterpreter(interpreter: PythonInterpreter): void {
        this._selectedInterpreter = interpreter;
        this._onDidChangeInterpreter.fire(interpreter);
        this.interpreterSelectionState.updateSelectedPythonPath((this._selectedInterpreterPath = interpreter.path));
        sendTelemetryEvent(Telemetry.SelectJupyterInterpreter, undefined, { result: 'selected' });
    }

    private async validateSavedInterpreterImpl(): Promise<boolean> {
        if (!this.interpreterSelectionState.selectedPythonPath) {
            // None set yet, so no need to check
            return false;
        }

        try {
            const interpreterDetails = await this.interpreterService.getInterpreterDetails(
                this.interpreterSelectionState.selectedPythonPath,
                undefined
            );

            if (interpreterDetails) {
                if (await this.interpreterConfiguration.areDependenciesInstalled(interpreterDetails, undefined)) {
                    // Our saved interpreter was found and has dependencies installed
                    return true;
                }
            }
        } catch (_err) {
            traceInfo('Saved Jupyter interpreter invalid');
        }

        // At this point we failed some aspect of our checks regarding our saved interpreter, so clear it out
        this._selectedInterpreter = undefined;
        this.interpreterSelectionState.updateSelectedPythonPath(undefined);
        return false;
    }
}
