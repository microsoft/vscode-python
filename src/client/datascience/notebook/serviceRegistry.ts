// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { NotebookContentProvider as VSCNotebookContentProvider } from '../../../../types/vscode-proposed';
import { IExtensionSingleActivationService } from '../../activation/types';
import { IInterpreterStatusbarVisibilityFilter } from '../../interpreter/contracts';
import { IServiceManager } from '../../ioc/types';
import { KernelProvider } from '../jupyter/kernels/kernelProvider';
import { IKernelProvider } from '../jupyter/kernels/types';
import { NotebookContentProvider } from './contentProvider';
import { NotebookCellLanguageService } from './defaultCellLanguageService';
import { NotebookIntegration } from './integration';
import { InterpreterStatusBarVisibility } from './interpreterStatusBarVisbility';
import { VSCodeKernelPickerProvider } from './kernelProvider';
import { NotebookDisposeService } from './notebookDisposeService';
import { NotebookSurveyBanner, NotebookSurveyDataLogger } from './survey';
import { INotebookContentProvider } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<VSCNotebookContentProvider>(INotebookContentProvider, NotebookContentProvider);
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        NotebookIntegration
    );
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        NotebookDisposeService
    );
    serviceManager.addSingleton<NotebookIntegration>(NotebookIntegration, NotebookIntegration);
    serviceManager.addSingleton<IKernelProvider>(IKernelProvider, KernelProvider);
    serviceManager.addSingleton<NotebookSurveyBanner>(NotebookSurveyBanner, NotebookSurveyBanner);
    serviceManager.addSingleton<VSCodeKernelPickerProvider>(VSCodeKernelPickerProvider, VSCodeKernelPickerProvider);
    serviceManager.addSingleton<IInterpreterStatusbarVisibilityFilter>(
        IInterpreterStatusbarVisibilityFilter,
        InterpreterStatusBarVisibility
    );
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        NotebookSurveyDataLogger
    );
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        NotebookCellLanguageService
    );
    serviceManager.addSingleton<NotebookCellLanguageService>(NotebookCellLanguageService, NotebookCellLanguageService);
}
