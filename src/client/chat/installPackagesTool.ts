// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {
    CancellationError,
    CancellationToken,
    l10n,
    LanguageModelTextPart,
    LanguageModelTool,
    LanguageModelToolInvocationOptions,
    LanguageModelToolInvocationPrepareOptions,
    LanguageModelToolResult,
    PreparedToolInvocation,
} from 'vscode';
import { PythonExtension } from '../api/types';
import { IServiceContainer } from '../ioc/types';
import { getEnvDisplayName, raceCancellationError } from './utils';
import { resolveFilePath } from './utils';
import { IModuleInstaller } from '../common/installer/types';
import { ModuleInstallerType } from '../pythonEnvironments/info';
import { IDiscoveryAPI } from '../pythonEnvironments/base/locator';

export interface IInstallPackageArgs {
    resourcePath?: string;
    packageList: string[];
}

export class InstallPackagesTool implements LanguageModelTool<IInstallPackageArgs> {
    public static readonly toolName = 'install_python_package';
    constructor(
        private readonly api: PythonExtension['environments'],
        private readonly serviceContainer: IServiceContainer,
        private readonly discovery: IDiscoveryAPI,
    ) {}
    /**
     * Invokes the tool to get the information about the Python environment.
     * @param options - The invocation options containing the file path.
     * @param token - The cancellation token.
     * @returns The result containing the information about the Python environment or an error message.
     */
    async invoke(
        options: LanguageModelToolInvocationOptions<IInstallPackageArgs>,
        token: CancellationToken,
    ): Promise<LanguageModelToolResult> {
        const resourcePath = resolveFilePath(options.input.resourcePath);
        const packageCount = options.input.packageList.length;
        const packagePlurality = packageCount === 1 ? 'package' : 'packages';

        try {
            // environment
            const envPath = this.api.getActiveEnvironmentPath(resourcePath);
            const environment = await raceCancellationError(this.api.resolveEnvironment(envPath), token);
            if (!environment || !environment.version) {
                throw new Error('No environment found for the provided resource path: ' + resourcePath?.fsPath);
            }
            const isConda = (environment.environment?.type || '').toLowerCase() === 'conda';
            const installers = this.serviceContainer.getAll<IModuleInstaller>(IModuleInstaller);
            const installerType = isConda ? ModuleInstallerType.Conda : ModuleInstallerType.Pip;
            const installer = installers.find((i) => i.type === installerType);
            if (!installer) {
                throw new Error(`No installer found for the environment type: ${installerType}`);
            }
            if (!installer.isSupported(resourcePath)) {
                throw new Error(`Installer ${installerType} not supported for the environment type: ${installerType}`);
            }
            for (const packageName of options.input.packageList) {
                await installer.installModule(packageName, resourcePath, token, undefined, { installAsProcess: true });
            }
            // format and return
            const resultMessage = `Successfully installed ${packagePlurality}: ${options.input.packageList.join(', ')}`;
            return new LanguageModelToolResult([new LanguageModelTextPart(resultMessage)]);
        } catch (error) {
            if (error instanceof CancellationError) {
                throw error;
            }
            const errorMessage = `An error occurred while installing ${packagePlurality}: ${error}`;
            return new LanguageModelToolResult([new LanguageModelTextPart(errorMessage)]);
        }
    }

    async prepareInvocation?(
        options: LanguageModelToolInvocationPrepareOptions<IInstallPackageArgs>,
        token: CancellationToken,
    ): Promise<PreparedToolInvocation> {
        const resourcePath = resolveFilePath(options.input.resourcePath);
        const packageCount = options.input.packageList.length;

        const envName = await raceCancellationError(getEnvDisplayName(this.discovery, resourcePath, this.api), token);
        let title = '';
        let invocationMessage = '';
        const message =
            packageCount === 1
                ? ''
                : l10n.t(`The following packages will be installed: {0}`, options.input.packageList.sort().join(', '));
        if (envName) {
            title =
                packageCount === 1
                    ? l10n.t(`Install {0} in {1}?`, options.input.packageList[0], envName)
                    : l10n.t(`Install packages in {0}?`, envName);
            invocationMessage =
                packageCount === 1
                    ? l10n.t(`Installing {0} in {1}`, options.input.packageList[0], envName)
                    : l10n.t(`Installing packages {0} in {1}`, options.input.packageList.sort().join(', '), envName);
        } else {
            title =
                options.input.packageList.length === 1
                    ? l10n.t(`Install Python package '{0}'?`, options.input.packageList[0])
                    : l10n.t(`Install Python packages?`);
            invocationMessage =
                packageCount === 1
                    ? l10n.t(`Installing Python package '{0}'`, options.input.packageList[0])
                    : l10n.t(`Installing Python packages: {0}`, options.input.packageList.sort().join(', '));
        }

        return {
            confirmationMessages: { title, message },
            invocationMessage,
        };
    }
}
