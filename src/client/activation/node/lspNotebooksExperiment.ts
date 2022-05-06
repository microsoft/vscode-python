// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable } from 'inversify';
import * as semver from 'semver';
import { Disposable, extensions } from 'vscode';
import { IConfigurationService } from '../../common/types';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { JUPYTER_EXTENSION_ID, PYLANCE_EXTENSION_ID } from '../../common/constants';
import { IExtensionSingleActivationService } from '../types';
import { traceLog, traceVerbose } from '../../logging';
import { IJupyterExtensionDependencyManager } from '../../common/application/types';
import { ILanguageServerWatcher } from '../../languageServer/types';
import { IServiceContainer } from '../../ioc/types';
import { sleep } from '../../common/utils/async';
import { JupyterExtensionIntegration } from '../../jupyter/jupyterIntegration';

@injectable()
export class LspNotebooksExperiment implements IExtensionSingleActivationService {
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: true, virtualWorkspace: true };

    private _pylanceExtensionChangeHandler: Disposable | undefined;

    private _isJupyterInstalled = false;

    private _isInNotebooksExperiment = false;

    constructor(
        @inject(IServiceContainer) private readonly serviceContainer: IServiceContainer,
        @inject(IConfigurationService) private readonly configurationService: IConfigurationService,
        @inject(IJupyterExtensionDependencyManager) jupyterDependencyManager: IJupyterExtensionDependencyManager,
    ) {
        if (!LspNotebooksExperiment._isPylanceInstalled()) {
            this._pylanceExtensionChangeHandler = extensions.onDidChange(
                this._pylanceExtensionsChangeHandler.bind(this),
            );
        }

        this._isJupyterInstalled = jupyterDependencyManager.isJupyterExtensionInstalled;
    }

    public async activate(): Promise<void> {
        this._updateExperimentSupport();
    }

    public async onJupyterInstalled(): Promise<void> {
        if (this._isJupyterInstalled) {
            return;
        }

        if (LspNotebooksExperiment._jupyterSupportsNotebooksExperiment()) {
            await this._waitForJupyterToRegisterPythonPathFunction();
            this._updateExperimentSupport();
        }

        this._isJupyterInstalled = true;
    }

    public isInNotebooksExperiment(): boolean {
        return this._isInNotebooksExperiment;
    }

    private _updateExperimentSupport(): void {
        const wasInExperiment = this._isInNotebooksExperiment;

        const isInTreatmentGroup = this.configurationService.getSettings().pylanceLspNotebooksEnabled;

        if (
            isInTreatmentGroup &&
            LspNotebooksExperiment._jupyterSupportsNotebooksExperiment() &&
            LspNotebooksExperiment._pylanceSupportsNotebooksExperiment()
        ) {
            this._isInNotebooksExperiment = true;
            sendTelemetryEvent(EventName.PYTHON_EXPERIMENTS_LSP_NOTEBOOKS);
        }

        // Our "in experiment" status can only change from false to true. That's possible if Pylance
        // or Jupyter is installed after Python is activated. A true to false transition would require
        // either Pylance or Jupyter to be uninstalled or downgraded after Python activated, and that
        // would require VS Code to be reloaded before the new extension version could be used.
        if (wasInExperiment === false && this._isInNotebooksExperiment === true) {
            const watcher = this.serviceContainer.get<ILanguageServerWatcher>(ILanguageServerWatcher);
            if (watcher) {
                watcher.restartLanguageServers();
            }
        }

        traceLog(`LspNotebooksExperiment: activate: isInNotebooksExperiment = ${this._isInNotebooksExperiment}`);
    }

    private static _jupyterSupportsNotebooksExperiment(): boolean {
        const jupyterVersion = extensions.getExtension(JUPYTER_EXTENSION_ID)?.packageJSON.version;
        return jupyterVersion !== undefined && semver.satisfies(jupyterVersion, '>=2022.4.100');
    }

    private static _pylanceSupportsNotebooksExperiment(): boolean {
        const pylanceVersion = extensions.getExtension(PYLANCE_EXTENSION_ID)?.packageJSON.version;
        return pylanceVersion !== undefined && semver.satisfies(pylanceVersion, '>=2022.5.1-pre.1 || 9999.0.0-dev');
    }

    private async _waitForJupyterToRegisterPythonPathFunction(): Promise<void> {
        if (!this._isInNotebooksExperiment) {
            return;
        }

        const jupyterExtensionIntegration = this.serviceContainer.get<JupyterExtensionIntegration>(
            JupyterExtensionIntegration,
        );

        let success = false;
        for (let tryCount = 0; tryCount < 20; tryCount += 1) {
            const jupyterPythonPathFunction = jupyterExtensionIntegration.getJupyterPythonPathFunction();
            if (jupyterPythonPathFunction) {
                traceVerbose(`Jupyter has called registration method...`);
                success = true;
                break;
            }

            traceVerbose(`Waiting for Jupyter to call registration method...`);
            await sleep(500);
        }

        if (!success) {
            traceVerbose(`Timed out waiting for Jupyter to call registration method...`);
        }
    }

    private static _isPylanceInstalled(): boolean {
        return !!extensions.getExtension(PYLANCE_EXTENSION_ID);
    }

    private async _pylanceExtensionsChangeHandler(): Promise<void> {
        if (LspNotebooksExperiment._isPylanceInstalled() && this._pylanceExtensionChangeHandler) {
            this._pylanceExtensionChangeHandler.dispose();
            this._pylanceExtensionChangeHandler = undefined;

            this._updateExperimentSupport();
        }
    }
}
