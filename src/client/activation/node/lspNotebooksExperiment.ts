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

    private pylanceExtensionChangeHandler: Disposable | undefined;

    private isJupyterInstalled = false;

    private isInExperiment = false;

    constructor(
        @inject(IServiceContainer) private readonly serviceContainer: IServiceContainer,
        @inject(IConfigurationService) private readonly configurationService: IConfigurationService,
        @inject(IJupyterExtensionDependencyManager) jupyterDependencyManager: IJupyterExtensionDependencyManager,
    ) {
        if (!LspNotebooksExperiment.isPylanceInstalled()) {
            this.pylanceExtensionChangeHandler = extensions.onDidChange(this.pylanceExtensionsChangeHandler.bind(this));
        }

        this.isJupyterInstalled = jupyterDependencyManager.isJupyterExtensionInstalled;
    }

    public async activate(): Promise<void> {
        this.updateExperimentSupport();
    }

    public async onJupyterInstalled(): Promise<void> {
        if (this.isJupyterInstalled) {
            return;
        }

        if (LspNotebooksExperiment.jupyterSupportsNotebooksExperiment()) {
            await this.waitForJupyterToRegisterPythonPathFunction();
            this.updateExperimentSupport();
        }

        this.isJupyterInstalled = true;
    }

    public isInNotebooksExperiment(): boolean {
        return this.isInExperiment;
    }

    private updateExperimentSupport(): void {
        const wasInExperiment = this.isInExperiment;
        const isInTreatmentGroup = this.configurationService.getSettings().pylanceLspNotebooksEnabled;

        if (
            isInTreatmentGroup &&
            LspNotebooksExperiment.jupyterSupportsNotebooksExperiment() &&
            LspNotebooksExperiment.pylanceSupportsNotebooksExperiment()
        ) {
            this.isInExperiment = true;
            sendTelemetryEvent(EventName.PYTHON_EXPERIMENTS_LSP_NOTEBOOKS);
        }

        // Our "in experiment" status can only change from false to true. That's possible if Pylance
        // or Jupyter is installed after Python is activated. A true to false transition would require
        // either Pylance or Jupyter to be uninstalled or downgraded after Python activated, and that
        // would require VS Code to be reloaded before the new extension version could be used.
        if (wasInExperiment === false && this.isInExperiment === true) {
            const watcher = this.serviceContainer.get<ILanguageServerWatcher>(ILanguageServerWatcher);
            if (watcher) {
                watcher.restartLanguageServers();
            }
        }

        traceLog(`LspNotebooksExperiment: activate: isInNotebooksExperiment = ${this.isInExperiment}`);
    }

    private static jupyterSupportsNotebooksExperiment(): boolean {
        const jupyterVersion = extensions.getExtension(JUPYTER_EXTENSION_ID)?.packageJSON.version;
        return jupyterVersion && semver.satisfies(jupyterVersion, '>=2022.4.100');
    }

    private static pylanceSupportsNotebooksExperiment(): boolean {
        const pylanceVersion = extensions.getExtension(PYLANCE_EXTENSION_ID)?.packageJSON.version;
        return pylanceVersion && semver.satisfies(pylanceVersion, '>=2022.5.1-pre.1 || 9999.0.0-dev');
    }

    private async waitForJupyterToRegisterPythonPathFunction(): Promise<void> {
        if (!this.isInExperiment) {
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

    private static isPylanceInstalled(): boolean {
        return !!extensions.getExtension(PYLANCE_EXTENSION_ID);
    }

    private async pylanceExtensionsChangeHandler(): Promise<void> {
        if (LspNotebooksExperiment.isPylanceInstalled() && this.pylanceExtensionChangeHandler) {
            this.pylanceExtensionChangeHandler.dispose();
            this.pylanceExtensionChangeHandler = undefined;

            this.updateExperimentSupport();
        }
    }
}
