// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IExtensionSingleActivationService } from '../../activation/types';
import { IServiceManager } from '../../ioc/types';
import { NotebookContentProvider } from './contentProvider';
import { NotebookExecutionProvider } from './executionProvider';
import { NotebookIntegration } from './integration';
import { NotebookKernel } from './notebookKernel';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<NotebookKernel>(NotebookKernel, NotebookKernel);
    serviceManager.addSingleton<NotebookExecutionProvider>(NotebookExecutionProvider, NotebookExecutionProvider);
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        NotebookIntegration
    );
    serviceManager.add<NotebookContentProvider>(NotebookContentProvider, NotebookContentProvider);
}
