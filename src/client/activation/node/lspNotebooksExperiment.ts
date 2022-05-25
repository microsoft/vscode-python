// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable } from 'inversify';
import * as semver from 'semver';
import { Disposable, extensions } from 'vscode';
import { IConfigurationService } from '../../common/types';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { JUPYTER_EXTENSION_ID, PYLANCE_EXTENSION_ID } from '../../common/constants';
import { IExtensionSingleActivationService, LanguageServerType } from '../types';
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

    private isInExperiment: boolean | undefined;

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
        return this.isInExperiment ?? false;
    }

    private updateExperimentSupport(): void {
        const wasInExperiment = this.isInExperiment;
        const isInTreatmentGroup = this.configurationService.getSettings().pylanceLspNotebooksEnabled;
        const languageServerType = this.configurationService.getSettings().languageServer;

        this.isInExperiment = false;
        if (languageServerType !== LanguageServerType.Node) {
            traceLog(`LSP Notebooks experiment is disabled -- not using Pylance`);
        } else if (!LspNotebooksExperiment.isJupyterInstalled()) {
            traceLog(`LSP Notebooks experiment is disabled -- Jupyter disabled or not installed`);
        } else if (!LspNotebooksExperiment.jupyterSupportsNotebooksExperiment()) {
            traceLog(`LSP Notebooks experiment is disabled -- Jupyter does not support experiment`);
        } else if (!LspNotebooksExperiment.isPylanceInstalled()) {
            traceLog(`LSP Notebooks experiment is disabled -- Pylance disabled or not installed`);
        } else if (!LspNotebooksExperiment.pylanceSupportsNotebooksExperiment()) {
            traceLog(`LSP Notebooks experiment is disabled -- Pylance does not support experiment`);
        } else if (!isInTreatmentGroup) {
            traceLog(`LSP Notebooks experiment is disabled -- not in treatment group`);
            // to avoid scorecard SRMs, we're also triggering the telemetry for users who meet
            // the criteria to experience LSP notebooks, but may be in the control group.
            sendTelemetryEvent(EventName.PYTHON_EXPERIMENTS_LSP_NOTEBOOKS);
        } else {
            this.isInExperiment = true;
            traceLog(`LSP Notebooks experiment is enabled`);
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
    }

    private static jupyterSupportsNotebooksExperiment(): boolean {
        const jupyterVersion = extensions.getExtension(JUPYTER_EXTENSION_ID)?.packageJSON.version;
        return (
            jupyterVersion && (semver.gt(jupyterVersion, '2022.5.1001411044') || semver.patch(jupyterVersion) === 100)
        );
    }

    private static pylanceSupportsNotebooksExperiment(): boolean {
        const pylanceVersion = extensions.getExtension(PYLANCE_EXTENSION_ID)?.packageJSON.version;
        return (
            pylanceVersion &&
            (semver.gte(pylanceVersion, '2022.5.3-pre.1') || semver.prerelease(pylanceVersion)?.includes('dev'))
        );
    }

    private async waitForJupyterToRegisterPythonPathFunction(): Promise<void> {
        const jupyterExtensionIntegration = this.serviceContainer.get<JupyterExtensionIntegration>(
            JupyterExtensionIntegration,
        );

        let success = false;
        for (let tryCount = 0; tryCount < 20; tryCount += 1) {
            const jupyterPythonPathFunction = jupyterExtensionIntegration.getJupyterPythonPathFunction();
            if (jupyterPythonPathFunction) {
                traceVerbose(`Jupyter called registerJupyterPythonPathFunction`);
                success = true;
                break;
            }

            await sleep(500);
        }

        if (!success) {
            traceVerbose(`Timed out waiting for Jupyter to call registerJupyterPythonPathFunction`);
        }
    }

    private static isPylanceInstalled(): boolean {
        return !!extensions.getExtension(PYLANCE_EXTENSION_ID);
    }

    private static isJupyterInstalled(): boolean {
        return !!extensions.getExtension(JUPYTER_EXTENSION_ID);
    }

    private async pylanceExtensionsChangeHandler(): Promise<void> {
        if (LspNotebooksExperiment.isPylanceInstalled() && this.pylanceExtensionChangeHandler) {
            this.pylanceExtensionChangeHandler.dispose();
            this.pylanceExtensionChangeHandler = undefined;

            this.updateExperimentSupport();
        }
    }
}
