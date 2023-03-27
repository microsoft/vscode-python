// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { IExtensionSingleActivationService } from '../activation/types';
import { IServiceManager } from '../ioc/types';
import { CodeActionProviderService } from './codeActionProvider/main';
import { InstallFormatterPrompt } from './prompts/installFormatterPrompt';
import { IInstallFormatterPrompt } from './prompts/types';

export function registerTypes(serviceManager: IServiceManager): void {
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        CodeActionProviderService,
    );
    serviceManager.addSingleton<IInstallFormatterPrompt>(IInstallFormatterPrompt, InstallFormatterPrompt);
}
