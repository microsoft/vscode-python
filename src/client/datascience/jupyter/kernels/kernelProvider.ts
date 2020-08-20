// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as fastDeepEqual from 'fast-deep-equal';
import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IApplicationShell, ICommandManager } from '../../../common/application/types';
import { traceInfo, traceWarning } from '../../../common/logger';
import { IAsyncDisposableRegistry, IConfigurationService, IDisposableRegistry } from '../../../common/types';
import { IInterpreterService } from '../../../interpreter/contracts';
import { INotebookContentProvider } from '../../notebook/types';
import { IDataScienceErrorHandler, INotebookEditorProvider, INotebookProvider } from '../../types';
import { Kernel } from './kernel';
import { KernelSelector } from './kernelSelector';
import { IKernel, IKernelProvider, IKernelSelectionUsage, KernelOptions } from './types';

@injectable()
export class KernelProvider implements IKernelProvider {
    private readonly kernelsByUri = new Map<string, { options: KernelOptions; kernel: IKernel }>();
    constructor(
        @inject(IAsyncDisposableRegistry) private asyncDisposables: IAsyncDisposableRegistry,
        @inject(IDisposableRegistry) private disposables: IDisposableRegistry,
        @inject(INotebookProvider) private notebookProvider: INotebookProvider,
        @inject(IConfigurationService) private configService: IConfigurationService,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IDataScienceErrorHandler) private readonly errorHandler: IDataScienceErrorHandler,
        @inject(INotebookContentProvider) private readonly contentProvider: INotebookContentProvider,
        @inject(INotebookEditorProvider) private readonly editorProvider: INotebookEditorProvider,

        @inject(KernelSelector) private readonly kernelSelectionUsage: IKernelSelectionUsage,
        @inject(IApplicationShell) private readonly appShell: IApplicationShell
    ) {}
    public get(uri: Uri): IKernel | undefined {
        return this.kernelsByUri.get(uri.toString())?.kernel;
    }
    public getOrCreate(uri: Uri, options: KernelOptions): IKernel | undefined {
        const existingKernelInfo = this.kernelsByUri.get(uri.toString());
        if (existingKernelInfo && fastDeepEqual(existingKernelInfo.options.metadata, options.metadata)) {
            return existingKernelInfo.kernel;
        }

        this.disposeOldKernel(uri);

        const waitForIdleTimeout = this.configService.getSettings(uri).datascience.jupyterLaunchTimeout;
        const kernel = new Kernel(
            uri,
            options.metadata,
            this.notebookProvider,
            this.disposables,
            waitForIdleTimeout,
            this.commandManager,
            this.interpreterService,
            this.errorHandler,
            this.contentProvider,
            this.editorProvider,
            this,
            this.kernelSelectionUsage,
            this.appShell
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
                // If the same kernel is associated with this document & it was disposed, then delete it.
                if (this.kernelsByUri.get(uri.toString())?.kernel === kernel) {
                    this.kernelsByUri.delete(uri.toString());
                    traceInfo(
                        `Kernel got disposed, hence there is no longer a kernel associated with ${uri.toString()}`,
                        kernel
                    );
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
