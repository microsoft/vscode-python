// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IServiceManager } from '../ioc/types';
import { TerminalAutoActivation } from './activation';
import { CodeExecutionManager } from './codeExecution/codeExecutionManager';
import { DjangoShellCodeExecutionProvider } from './codeExecution/djangoShellCodeExecution';
import { CodeExecutionHelper } from './codeExecution/helper';
import { ReplProvider } from './codeExecution/repl';
import { TerminalCodeExecutionProvider } from './codeExecution/terminalCodeExecution';
import {
    ICodeExecutionHelper,
    ICodeExecutionManager,
    ICodeExecutionService,
    IShellIntegrationService,
    ITerminalAutoActivation,
    ITerminalEnvVarCollectionService,
} from './types';
import { TerminalEnvVarCollectionService } from './envCollectionActivation/service';
import { IExtensionActivationService, IExtensionSingleActivationService } from '../activation/types';
import { TerminalDeactivateLimitationPrompt } from './envCollectionActivation/deactivatePrompt';
import { TerminalIndicatorPrompt } from './envCollectionActivation/indicatorPrompt';
import { ShellIntegrationService } from './envCollectionActivation/shellIntegrationService';

export function registerTypes(serviceManager: IServiceManager): void {
    serviceManager.addSingleton<ICodeExecutionHelper>(ICodeExecutionHelper, CodeExecutionHelper);

    serviceManager.addSingleton<ICodeExecutionManager>(ICodeExecutionManager, CodeExecutionManager);

    serviceManager.addSingleton<ICodeExecutionService>(
        ICodeExecutionService,
        DjangoShellCodeExecutionProvider,
        'djangoShell',
    );
    serviceManager.addSingleton<ICodeExecutionService>(
        ICodeExecutionService,
        TerminalCodeExecutionProvider,
        'standard',
    );
    serviceManager.addSingleton<ICodeExecutionService>(ICodeExecutionService, ReplProvider, 'repl');

    serviceManager.addSingleton<ITerminalAutoActivation>(ITerminalAutoActivation, TerminalAutoActivation);
    serviceManager.addSingleton<ITerminalEnvVarCollectionService>(
        ITerminalEnvVarCollectionService,
        TerminalEnvVarCollectionService,
    );
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        TerminalIndicatorPrompt,
    );
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        TerminalDeactivateLimitationPrompt,
    );
    serviceManager.addSingleton<IShellIntegrationService>(IShellIntegrationService, ShellIntegrationService);
    serviceManager.addBinding(ITerminalEnvVarCollectionService, IExtensionActivationService);
}
