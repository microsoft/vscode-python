// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ExtensionContext, Uri } from 'vscode';
import * as path from 'path';
import { copy, createDirectory, getConfiguration, onDidChangeConfiguration } from '../common/vscodeApis/workspaceApis';
import { EXTENSION_ROOT_DIR } from '../constants';
import { IInterpreterService } from '../interpreter/contracts';
import { IServiceContainer } from '../ioc/types';
import { getPythonMinorVersion } from '../repl/replUtils';

async function applyPythonStartupSetting(context: ExtensionContext): Promise<void> {
    const config = getConfiguration('python');
    const pythonrcSetting = config.get<boolean>('terminal.shellIntegration.enabled');

    if (pythonrcSetting) {
        const storageUri = context.storageUri || context.globalStorageUri;
        try {
            await createDirectory(storageUri);
        } catch {
            // already exists, most likely
        }
        const destPath = Uri.joinPath(storageUri, 'pythonrc.py');
        const sourcePath = path.join(EXTENSION_ROOT_DIR, 'python_files', 'pythonrc.py');
        await copy(Uri.file(sourcePath), destPath, { overwrite: true });
        context.environmentVariableCollection.replace('PYTHONSTARTUP', destPath.fsPath);
    } else {
        context.environmentVariableCollection.delete('PYTHONSTARTUP');
    }
}

export async function registerPythonStartup(context: ExtensionContext): Promise<void> {
    await applyPythonStartupSetting(context);
    context.subscriptions.push(
        onDidChangeConfiguration(async (e) => {
            if (e.affectsConfiguration('python.terminal.shellIntegration.enabled')) {
                await applyPythonStartupSetting(context);
            }
        }),
    );
}

async function applyBasicReplSetting(context: ExtensionContext, serviceContainer?: IServiceContainer): Promise<void> {
    const config = getConfiguration('python');
    const shellIntegrationEnabled = config.get<boolean>('terminal.shellIntegration.enabled');

    if (shellIntegrationEnabled && serviceContainer) {
        // Only disable PyREPL (set PYTHON_BASIC_REPL=1) when shell integration is enabled
        // and Python version is 3.13 or higher
        try {
            const interpreterService = serviceContainer.get<IInterpreterService>(IInterpreterService);
            const pythonMinorVersion = await getPythonMinorVersion(undefined, interpreterService);

            if ((pythonMinorVersion ?? 0) >= 13) {
                context.environmentVariableCollection.replace('PYTHON_BASIC_REPL', '1');
                return;
            }
        } catch {
            // If we can't get the Python version, don't set PYTHON_BASIC_REPL
        }
    }

    // Remove PYTHON_BASIC_REPL if shell integration is disabled or Python < 3.13
    context.environmentVariableCollection.delete('PYTHON_BASIC_REPL');
}

export async function registerBasicRepl(
    context: ExtensionContext,
    serviceContainer?: IServiceContainer,
): Promise<void> {
    await applyBasicReplSetting(context, serviceContainer);
    context.subscriptions.push(
        onDidChangeConfiguration(async (e) => {
            if (e.affectsConfiguration('python.terminal.shellIntegration.enabled')) {
                await applyBasicReplSetting(context, serviceContainer);
            }
        }),
    );
}
