// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Event, EventEmitter } from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';
import { createPromiseFromCancellation } from '../../../common/cancellation';
import '../../../common/extensions';
import { noop } from '../../../common/utils/misc';
import { IInterpreterService, PythonInterpreter } from '../../../interpreter/contracts';
import { sendTelemetryEvent } from '../../../telemetry';
import { Telemetry } from '../../constants';
import { JupyterInstallError } from '../jupyterInstallError';
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
    private getInitialInterpreterPromise: Promise<PythonInterpreter | undefined> | undefined;
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
        // because _selectedInterpreter can be changed by other function and at other times, this promise
        // is cached to only run once
        await this.setInitialInterpreter(token);

        return this._selectedInterpreter;
    }

    // To be run one initial time. Check our saved locations and then current interpreter to try to start off
    // with a valid jupyter interpreter
    public async setInitialInterpreter(token?: CancellationToken): Promise<PythonInterpreter | undefined> {
        if (!this.getInitialInterpreterPromise) {
            this.getInitialInterpreterPromise = this.getInitialInterpreterImpl(token).then((result) => {
                // Set ourselves as a valid interpreter if we found something
                if (result) {
                    this.changeSelectedInterpreterProperty(result);
                }
                return result;
            });
        }

        return this.getInitialInterpreterPromise;
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
                await this.setAsSelectedInterpreter(interpreter);
                return interpreter;
            }
            case JupyterInterpreterDependencyResponse.cancel:
                sendTelemetryEvent(Telemetry.SelectJupyterInterpreter, undefined, { result: 'installationCancelled' });
                return;
            default:
                return this.selectInterpreter(token);
        }
    }

    // Install jupyter dependencies in the current jupyter selected interpreter
    // If there is no jupyter selected interpreter, prompt for install into the
    // current active interpreter and set as active if successful
    public async installMissingDependencies(err?: JupyterInstallError): Promise<void> {
        const jupyterInterpreter = await this.getSelectedInterpreter();
        let interpreter = jupyterInterpreter;
        if (!interpreter) {
            // Use current interpreter.
            interpreter = await this.interpreterService.getActiveInterpreter(undefined);
            if (!interpreter) {
                // Unlikely scenario, user hasn't selected python, python extension will fall over.
                // Get user to select something.
                await this.selectInterpreter();
                return;
            }
        }

        const response = await this.interpreterConfiguration.installMissingDependencies(interpreter, err);
        if (response === JupyterInterpreterDependencyResponse.selectAnotherInterpreter) {
            await this.selectInterpreter();
        } else if (response === JupyterInterpreterDependencyResponse.ok) {
            // We might have installed jupyter in a new active interpreter here, if we did and the install
            // went ok we also want to select that interpreter as our jupyter selected interperter
            // so that on next launch we use it correctly
            if (interpreter !== jupyterInterpreter) {
                await this.setAsSelectedInterpreter(interpreter);
            }
        }
    }

    // Set the specified interpreter as our current selected interpreter. Public so can
    // be set by the test code.
    public async setAsSelectedInterpreter(interpreter: PythonInterpreter): Promise<void> {
        // Make sure that our initial set has happened before we allow a set so that
        // calculation of the initial interpreter doesn't clobber the existing one
        await this.setInitialInterpreter();
        this.changeSelectedInterpreterProperty(interpreter);
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

    private changeSelectedInterpreterProperty(interpreter: PythonInterpreter) {
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
        try {
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
                if (await this.interpreterConfiguration.areDependenciesInstalled(interpreter, token)) {
                    return interpreter;
                }
            }
        } catch (_err) {
            // For any errors we are ok with just returning undefined for an invalid interpreter
            noop();
        }
        return undefined;
    }

    private async getInitialInterpreterImpl(token?: CancellationToken): Promise<PythonInterpreter | undefined> {
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
                // If the current active interpreter has everything installed already just use that
                if (await this.interpreterConfiguration.areDependenciesInstalled(currentInterpreter, token)) {
                    interpreter = currentInterpreter;
                }
            }
        }

        return interpreter;
    }
}
