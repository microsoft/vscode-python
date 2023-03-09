// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable } from 'inversify';
import { Disposable, extensions } from 'vscode';
import { IConfigurationService, IDisposableRegistry } from '../../common/types';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { JUPYTER_EXTENSION_ID, PYLANCE_EXTENSION_ID } from '../../common/constants';
import { IExtensionSingleActivationService, LanguageServerType } from '../types';
import { traceLog, traceVerbose } from '../../logging';
import { IJupyterExtensionDependencyManager } from '../../common/application/types';
import { IServiceContainer } from '../../ioc/types';
import { sleep } from '../../common/utils/async';
import { JupyterExtensionIntegration } from '../../jupyter/jupyterIntegration';

@injectable()
export class LspNotebooksExperiment implements IExtensionSingleActivationService {
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: true, virtualWorkspace: true };

    private pylanceExtensionChangeHandler: Disposable | undefined;

    private isJupyterInstalled = false;

    private isUsingPylance: boolean | undefined;

    constructor(
        @inject(IServiceContainer) private readonly serviceContainer: IServiceContainer,
        @inject(IConfigurationService) private readonly configurationService: IConfigurationService,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
        @inject(IJupyterExtensionDependencyManager) jupyterDependencyManager: IJupyterExtensionDependencyManager,
    ) {
        this.isJupyterInstalled = jupyterDependencyManager.isJupyterExtensionInstalled;
    }

    public async activate(): Promise<void> {
        if (!LspNotebooksExperiment.isPylanceInstalled()) {
            this.pylanceExtensionChangeHandler = extensions.onDidChange(this.pylanceExtensionsChangeHandler.bind(this));
            this.disposables.push(this.pylanceExtensionChangeHandler);
        }

        this.updateExperimentSupport();
    }

    public async onJupyterInstalled(): Promise<void> {
        if (this.isJupyterInstalled) {
            return;
        }

        await this.waitForJupyterToRegisterPythonPathFunction();
        this.updateExperimentSupport();

        this.isJupyterInstalled = true;
    }

    private updateExperimentSupport(): void {
        const languageServerType = this.configurationService.getSettings().languageServer;

        this.isUsingPylance = false;
        if (languageServerType !== LanguageServerType.Node) {
            traceLog(`LSP Notebooks is disabled -- not using Pylance`);
        } else if (!LspNotebooksExperiment.isJupyterInstalled()) {
            traceLog(`LSP Notebooks is disabled -- Jupyter disabled or not installed`);
        } else if (!LspNotebooksExperiment.isPylanceInstalled()) {
            traceLog(`LSP Notebooks is disabled -- Pylance disabled or not installed`);
        } else {
            this.isUsingPylance = true;
            traceLog(`LSP Notebooks is enabled`);
            sendTelemetryEvent(EventName.PYTHON_EXPERIMENTS_LSP_NOTEBOOKS);
        }

        if (!this.isUsingPylance) {
            traceLog(`LSP Notebooks interactive window support is disabled -- not using Pylance`);
        } else {
            traceLog(`LSP Notebooks interactive window support is enabled`);
        }
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
