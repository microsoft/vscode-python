// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable } from 'inversify';
import { IExtensionSingleActivationService } from '../types';
import { traceVerbose } from '../../logging';
import { IJupyterExtensionDependencyManager } from '../../common/application/types';
import { IServiceContainer } from '../../ioc/types';
import { sleep } from '../../common/utils/async';
import { JupyterExtensionIntegration } from '../../jupyter/jupyterIntegration';

@injectable()
export class LspNotebooksExperiment implements IExtensionSingleActivationService {
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: true, virtualWorkspace: true };

    private isJupyterInstalled = false;

    constructor(
        @inject(IServiceContainer) private readonly serviceContainer: IServiceContainer,
        @inject(IJupyterExtensionDependencyManager) jupyterDependencyManager: IJupyterExtensionDependencyManager,
    ) {
        this.isJupyterInstalled = jupyterDependencyManager.isJupyterExtensionInstalled;
    }

    // eslint-disable-next-line class-methods-use-this
    public activate(): Promise<void> {
        return Promise.resolve();
    }

    public async onJupyterInstalled(): Promise<void> {
        if (this.isJupyterInstalled) {
            return;
        }

        await this.waitForJupyterToRegisterPythonPathFunction();

        this.isJupyterInstalled = true;
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
}
