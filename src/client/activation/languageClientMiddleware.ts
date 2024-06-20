// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IJupyterExtensionDependencyManager } from '../common/application/types';
import { IDisposableRegistry, IExtensions } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { sendTelemetryEvent } from '../telemetry';
import { createHidingMiddleware } from './hidingMiddleware';

import { LanguageClientMiddlewareBase } from './languageClientMiddlewareBase';
import { LanguageServerType } from './types';

export class LanguageClientMiddleware extends LanguageClientMiddlewareBase {
    public constructor(serviceContainer: IServiceContainer, serverType: LanguageServerType, serverVersion?: string) {
        super(serviceContainer, serverType, sendTelemetryEvent, serverVersion);
    }

    /**
     * Creates the HidingMiddleware if needed and sets up code to do so if needed after
     * Jupyter is installed.
     *
     * This method should be called from the constructor of derived classes. It is separated
     * from the constructor to allow derived classes to initialize before it is called.
     */
    protected setupHidingMiddleware(serviceContainer: IServiceContainer) {
        const jupyterDependencyManager = serviceContainer.get<IJupyterExtensionDependencyManager>(
            IJupyterExtensionDependencyManager,
        );
        const disposables = serviceContainer.get<IDisposableRegistry>(IDisposableRegistry) || [];
        const extensions = serviceContainer.get<IExtensions>(IExtensions);

        // Enable notebook support if jupyter support is installed
        if (this.shouldCreateHidingMiddleware(jupyterDependencyManager)) {
            this.notebookAddon = createHidingMiddleware();
        }

        disposables.push(
            extensions?.onDidChange(async () => {
                await this.onExtensionChange(jupyterDependencyManager);
            }),
        );
    }

    protected shouldCreateHidingMiddleware(jupyterDependencyManager: IJupyterExtensionDependencyManager): boolean {
        return jupyterDependencyManager && jupyterDependencyManager.isJupyterExtensionInstalled;
    }

    protected async onExtensionChange(jupyterDependencyManager: IJupyterExtensionDependencyManager): Promise<void> {
        if (jupyterDependencyManager) {
            if (this.notebookAddon && !this.shouldCreateHidingMiddleware(jupyterDependencyManager)) {
                this.notebookAddon = undefined;
            } else if (!this.notebookAddon && this.shouldCreateHidingMiddleware(jupyterDependencyManager)) {
                this.notebookAddon = createHidingMiddleware();
            }
        }
    }
}
