// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IExtensionSingleActivationService } from '../../activation/types';
import { IServiceManager } from '../../ioc/types';
import { NotebookContentProvider } from './contentProvider';
import { NotebookExecutionService } from './executionService';
import { NotebookIntegration } from './integration';
import { IPyWidgetNotebookOutputRenderer } from './ipyWidgetRenderer';
import { KernelProvider } from './kernelProvider';
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
    serviceManager.addSingleton<NotebookOutputRenderer>(NotebookOutputRenderer, NotebookOutputRenderer);
    serviceManager.addSingleton<IPyWidgetNotebookOutputRenderer>(
        IPyWidgetNotebookOutputRenderer,
        IPyWidgetNotebookOutputRenderer
    );
    serviceManager.addSingleton<NotebookSurveyBanner>(NotebookSurveyBanner, NotebookSurveyBanner);
    serviceManager.addSingleton<KernelProvider>(KernelProvider, KernelProvider);
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        NotebookSurveyDataLogger
    );
}
