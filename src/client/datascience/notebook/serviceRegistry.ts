// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IExtensionSingleActivationService } from '../../activation/types';
import { IServiceManager } from '../../ioc/types';
import { NotebookContentProvider } from './contentProvider';
import { NotebookIntegration } from './integration';
import { NotebookEditorProviderActivation } from './notebookEditorProvider';
import { NotebookKernel } from './notebookKernel';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.add<NotebookContentProvider>(NotebookContentProvider, NotebookContentProvider);
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        NotebookIntegration
    );
    serviceManager.addSingleton<NotebookKernel>(NotebookKernel, NotebookKernel);
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        NotebookEditorProviderActivation
    );
}
