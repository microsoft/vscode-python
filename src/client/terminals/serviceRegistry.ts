// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IServiceManager } from '../ioc/types';
import { CodeExecutionManager } from './codeExecution/codeExecutionManager';
import { DjangoShellCodeExecutionProvider } from './codeExecution/djangoShellCodeExecution';
import { CodeExecutionHelper } from './codeExecution/helper';
import { TerminalCodeExecutionProvider } from './codeExecution/terminalCodeExecution';
import { ICodeExecutionHelper, ICodeExecutionManager, ICodeExecutionService } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<ICodeExecutionHelper>(ICodeExecutionHelper, CodeExecutionHelper);
    serviceManager.addSingleton<ICodeExecutionManager>(ICodeExecutionManager, CodeExecutionManager);
    serviceManager.addSingleton<ICodeExecutionService>(ICodeExecutionService, DjangoShellCodeExecutionProvider, 'djangoShell');
    serviceManager.addSingleton<ICodeExecutionService>(ICodeExecutionService, TerminalCodeExecutionProvider, 'standard');
}
