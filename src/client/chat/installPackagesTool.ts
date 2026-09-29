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
    Uri,
} from 'vscode';
import { PythonExtension } from '../api/types';
import { IServiceContainer } from '../ioc/types';
import {
    getEnvDisplayName,
    getEnvTypeForTelemetry,
    getToolResponseIfNotebook,
    getPythonToolResponse,
    getPythonToolTelemetry,
    getPythonToolResourcePath,
    IResourceReference,
    invokePythonTool,
    invokePythonToolCompatibility,
    PYTHON_TOOLS_UNAVAILABLE,
    isCancellationError,
    isCondaEnv,
    raceCancellationError,
    usePythonToolsRoute,
} from './utils';
import { IModuleInstaller } from '../common/installer/types';
import { ModuleInstallerType } from '../pythonEnvironments/info';
import { IDiscoveryAPI } from '../pythonEnvironments/base/locator';
import { getEnvExtApi, useEnvExtension } from '../envExt/api.internal';
import { ErrorWithTelemetrySafeReason } from '../common/errors/errorUtils';
import { BaseTool } from './baseTool';

export interface IInstallPackageArgs extends IResourceReference {
    packageList: string[];
}

export class InstallPackagesTool extends BaseTool<IInstallPackageArgs>
    implements LanguageModelTool<IInstallPackageArgs> {
    public static readonly toolName = 'install_python_packages';
    constructor(
        private readonly api: PythonExtension['environments'],
        private readonly serviceContainer: IServiceContainer,
        private readonly discovery: IDiscoveryAPI,
    ) {
        super(InstallPackagesTool.toolName);
    }

    async invokeImpl(
        options: LanguageModelToolInvocationOptions<IInstallPackageArgs>,
        resourcePath: Uri | undefined,
        token: CancellationToken,
    ): Promise<LanguageModelToolResult> {
        const packageCount = options.input.packageList.length;
        const packagePlurality = packageCount === 1 ? 'package' : 'packages';
        this.extraTelemetryProperties.packageCount = String(packageCount);
        const notebookResponse = getToolResponseIfNotebook(resourcePath);
        if (notebookResponse) {
            return notebookResponse;
        }

        if (useEnvExtension()) {
            const successMessage =
                packageCount === 1
                    ? l10n.t('Successfully installed package: {0}', options.input.packageList[0])
                    : l10n.t('Successfully installed packages: {0}', options.input.packageList.join(', '));
            const workspaceScoped = usePythonToolsRoute();
            const target = getPythonToolResourcePath(options.input.resourcePath, resourcePath);
            const result = await invokePythonTool(
                (api) => api.installPackages({ resourcePath: target, packages: options.input.packageList }, token),
                token,
            );
            if (result !== PYTHON_TOOLS_UNAVAILABLE) {
                Object.assign(this.extraTelemetryProperties, getPythonToolTelemetry(result?.environment));
                return getPythonToolResponse(result, successMessage);
            }
            if (!workspaceScoped) {
                return this.invokePreviousEnvsFlow(options, resourcePath, successMessage, token);
            }
            return invokePythonToolCompatibility(target, token, (resource) =>
                this.invokePreviousEnvsFlow(options, resource, successMessage, token),
            );
        }

        try {
            // environment
            const envPath = this.api.getActiveEnvironmentPath(resourcePath);
            const environment = await raceCancellationError(this.api.resolveEnvironment(envPath), token);
            if (!environment || !environment.version) {
                throw new ErrorWithTelemetrySafeReason(
                    'No environment found for the provided resource path: ' + resourcePath?.fsPath,
                    'noEnvFound',
                );
            }
            this.extraTelemetryProperties.envType = getEnvTypeForTelemetry(environment);
            const isConda = isCondaEnv(environment);
            const installers = this.serviceContainer.getAll<IModuleInstaller>(IModuleInstaller);
            const installerType = isConda ? ModuleInstallerType.Conda : ModuleInstallerType.Pip;
            this.extraTelemetryProperties.installerType = isConda ? 'conda' : 'pip';
            const installer = installers.find((i) => i.type === installerType);
            if (!installer) {
                throw new ErrorWithTelemetrySafeReason(
                    `No installer found for the environment type: ${installerType}`,
                    'noInstallerFound',
                );
            }
            if (!installer.isSupported(resourcePath)) {
                throw new ErrorWithTelemetrySafeReason(
                    `Installer ${installerType} not supported for the environment type: ${installerType}`,
                    'installerNotSupported',
                );
            }
            for (const packageName of options.input.packageList) {
                await installer.installModule(packageName, resourcePath, token, undefined, {
                    installAsProcess: true,
                    hideProgress: true,
                });
            }
            // format and return
            const resultMessage = `Successfully installed ${packagePlurality}: ${options.input.packageList.join(', ')}`;
            return new LanguageModelToolResult([new LanguageModelTextPart(resultMessage)]);
        } catch (error) {
            if (isCancellationError(error)) {
                throw error;
            }
            const errorMessage = `An error occurred while installing ${packagePlurality}: ${error}`;
            return new LanguageModelToolResult([new LanguageModelTextPart(errorMessage)]);
        }
    }

    /** Runs the previous integration after capability absence, including its no-workspace behavior. */
    private async invokePreviousEnvsFlow(
        options: LanguageModelToolInvocationOptions<IInstallPackageArgs>,
        resource: Uri | undefined,
        successMessage: string,
        token: CancellationToken,
    ): Promise<LanguageModelToolResult> {
        const api = await getEnvExtApi();
        const env = await api.getEnvironment(resource);
        if (!env) {
            return new LanguageModelToolResult([
                new LanguageModelTextPart(
                    l10n.t('Packages not installed. No environment found for: {0}', resource?.fsPath ?? ''),
                ),
            ]);
        }
        Object.assign(this.extraTelemetryProperties, getPythonToolTelemetry(env));
        if (token.isCancellationRequested) {
            throw new CancellationError();
        }
        await raceCancellationError(api.managePackages(env, { install: options.input.packageList }), token);
        return new LanguageModelToolResult([new LanguageModelTextPart(successMessage)]);
    }

    async prepareInvocationImpl(
        options: LanguageModelToolInvocationPrepareOptions<IInstallPackageArgs>,
        resourcePath: Uri | undefined,
        token: CancellationToken,
    ): Promise<PreparedToolInvocation> {
        const packageCount = options.input.packageList.length;
        if (getToolResponseIfNotebook(resourcePath)) {
            return {};
        }

        if (useEnvExtension()) {
            const packages = [...options.input.packageList].sort().join(', ');
            const target = getPythonToolResourcePath(options.input.resourcePath, resourcePath);
            return {
                confirmationMessages: {
                    title:
                        packageCount === 1
                            ? l10n.t("Install Python package '{0}'?", options.input.packageList[0])
                            : l10n.t('Install Python packages?'),
                    message: target
                        ? l10n.t(
                              'The following packages will be installed in the selected Python environment for {0}: {1}. With a compatible Python Environments tools API, an isolated environment is required; global Python and Conda base are never modified, and no extension pickers are shown.',
                              target,
                              packages,
                          )
                        : l10n.t(
                              'The following packages will be installed: {0}. With a compatible Python Environments tools API, an open workspace and a selected isolated environment are required; global Python and Conda base are never modified, and no extension pickers are shown.',
                              packages,
                          ),
                },
                invocationMessage: target
                    ? l10n.t('Installing Python packages for {0}: {1}', target, packages)
                    : l10n.t('Installing Python packages: {0}', packages),
            };
        }

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
