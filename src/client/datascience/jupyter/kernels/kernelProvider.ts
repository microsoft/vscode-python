// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { traceWarning } from '../../../common/logger';
import { IAsyncDisposableRegistry, IConfigurationService, IDisposableRegistry } from '../../../common/types';
import { INotebookProvider } from '../../types';
import { Kernel } from './kernel';
import { IKernel, KernelOptions } from './types';

@injectable()
export class KernelProvider {
    private readonly kernelsByUri = new Map<string, { options: KernelOptions; kernel: IKernel }>();
    constructor(
        @inject(IAsyncDisposableRegistry) private asyncDisposables: IAsyncDisposableRegistry,
        @inject(IDisposableRegistry) private disposables: IDisposableRegistry,
        @inject(INotebookProvider) private notebookProvider: INotebookProvider,
        @inject(IConfigurationService) private configService: IConfigurationService
    ) {}
    public get(uri: Uri): IKernel | undefined {
        return this.kernelsByUri.get(uri.toString())?.kernel;
    }
    public getOrCreate(uri: Uri, options: KernelOptions): IKernel | undefined {
        const existingKernelInfo = this.kernelsByUri.get(uri.toString());
        if (
            existingKernelInfo &&
            JSON.stringify(existingKernelInfo.options.metadata) === JSON.stringify(options.metadata)
        ) {
            return existingKernelInfo.kernel;
        }

        this.disposeOldKernel(uri);

        const waitForIdleTimeout =
            options?.waitForIdleTimeout ?? this.configService.getSettings(uri).datascience.jupyterLaunchTimeout;
        const kernel = new Kernel(
            uri,
            options.metadata,
            this.notebookProvider,
            this.disposables,
            waitForIdleTimeout,
            options.launchingFile
        );
        this.asyncDisposables.push(kernel);
        this.kernelsByUri.set(uri.toString(), { options, kernel });
        this.deleteMappingIfKernelIsDisposed(uri, kernel);
        return kernel;
    }
    /**
     * If a kernel has been disposed, then remove the mapping of Uri + Kernel.
     */
    private deleteMappingIfKernelIsDisposed(uri: Uri, kernel: IKernel) {
        kernel.onDisposed(
            () => {
                if (this.get(uri) === kernel) {
                    this.kernelsByUri.delete(uri.toString());
                }
            },
            this,
            this.disposables
        );
    }
    private disposeOldKernel(uri: Uri) {
        this.kernelsByUri
            .get(uri.toString())
            ?.kernel.dispose()
            .catch((ex) => traceWarning('Failed to dispose old kernel', ex)); // NOSONAR.
        this.kernelsByUri.delete(uri.toString());
    }
}

// export class KernelProvider {
