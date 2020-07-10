// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IExtensionSingleActivationService } from '../../activation/types';
import { IServiceManager } from '../../ioc/types';
import { CellEditSyncService } from './cellEditSyncService';
import { NotebookContentProvider } from './contentProvider';
import { NotebookExecutionService } from './executionService';
import { NotebookIntegration } from './integration';
import { NotebookKernel } from './notebookKernel';
import { NotebookTrustHandler } from './notebookTrustHandler';
import { NotebookOutputRenderer } from './renderer';
import { NotebookSurveyBanner, NotebookSurveyDataLogger } from './survey';
import { INotebookContentProvider, INotebookExecutionService } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<INotebookContentProvider>(INotebookContentProvider, NotebookContentProvider);
    serviceManager.addSingleton<INotebookExecutionService>(INotebookExecutionService, NotebookExecutionService);
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        NotebookIntegration
    );
    serviceManager.addSingleton<NotebookIntegration>(NotebookIntegration, NotebookIntegration);
    serviceManager.addSingleton<NotebookKernel>(NotebookKernel, NotebookKernel);
    serviceManager.addSingleton<NotebookOutputRenderer>(NotebookOutputRenderer, NotebookOutputRenderer);
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        CellEditSyncService
    );
    serviceManager.addSingleton<NotebookSurveyBanner>(NotebookSurveyBanner, NotebookSurveyBanner);
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        NotebookSurveyDataLogger
    );
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        NotebookTrustHandler
    );
}
