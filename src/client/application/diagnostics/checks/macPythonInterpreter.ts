// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { ConfigurationChangeEvent, DiagnosticSeverity, Uri } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import { DeprecatePythonPath } from '../../../common/experiments/groups';
import '../../../common/extensions';
import { IPlatformService } from '../../../common/platform/types';
import {
    IConfigurationService,
    IDisposableRegistry,
    IExperimentsManager,
    IInterpreterPathService,
    InterpreterConfigurationScope,
    Resource,
} from '../../../common/types';
import { IInterpreterHelper, IInterpreterService } from '../../../interpreter/contracts';
import { IServiceContainer } from '../../../ioc/types';
import { EnvironmentType } from '../../../pythonEnvironments/info';
import { BaseDiagnostic, BaseDiagnosticsService } from '../base';
import { IDiagnosticsCommandFactory } from '../commands/types';
import { DiagnosticCodes } from '../constants';
import { DiagnosticCommandPromptHandlerServiceId, MessageCommandPrompt } from '../promptHandler';
import { DiagnosticScope, IDiagnostic, IDiagnosticCommand, IDiagnosticHandlerService } from '../types';

const messages = {
    [DiagnosticCodes.MacInterpreterSelectedAndHaveOtherInterpretersDiagnostic]:
        'You have selected the macOS system install of Python, which is not recommended for use with the Python extension. Some functionality will be limited, please select a different interpreter.',
    [DiagnosticCodes.MacInterpreterSelectedAndNoOtherInterpretersDiagnostic]:
        'The macOS system install of Python is not recommended, some functionality in the extension will be limited. Install another version of Python for the best experience.',
};

export class InvalidMacPythonInterpreterDiagnostic extends BaseDiagnostic {
    constructor(
        code:
            | DiagnosticCodes.MacInterpreterSelectedAndNoOtherInterpretersDiagnostic
            | DiagnosticCodes.MacInterpreterSelectedAndHaveOtherInterpretersDiagnostic,
        resource: Resource,
    ) {
        super(code, messages[code], DiagnosticSeverity.Error, DiagnosticScope.WorkspaceFolder, resource);
    }
}

export const InvalidMacPythonInterpreterServiceId = 'InvalidMacPythonInterpreterServiceId';

@injectable()
export class InvalidMacPythonInterpreterService extends BaseDiagnosticsService {
    protected changeThrottleTimeout = 1000;
    private timeOut?: NodeJS.Timer | number;
    constructor(
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry,
        @inject(IPlatformService) private readonly platform: IPlatformService,
        @inject(IInterpreterHelper) private readonly helper: IInterpreterHelper,
    ) {
        super(
            [
                DiagnosticCodes.MacInterpreterSelectedAndHaveOtherInterpretersDiagnostic,
                DiagnosticCodes.MacInterpreterSelectedAndNoOtherInterpretersDiagnostic,
            ],
            serviceContainer,
            disposableRegistry,
            true,
        );
        this.addPythonPathChangedHandler();
    }
    public dispose() {
        if (this.timeOut) {
            // tslint:disable-next-line: no-any
            clearTimeout(this.timeOut as any);
            this.timeOut = undefined;
        }
    }
    public async diagnose(resource: Resource): Promise<IDiagnostic[]> {
        if (!this.platform.isMac) {
            return [];
        }
        const configurationService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        const settings = configurationService.getSettings(resource);
        if (settings.disableInstallationChecks === true) {
            return [];
        }

        const hasInterpreters = await this.interpreterService.hasInterpreters;
        if (!hasInterpreters) {
            return [];
        }

        const currentInterpreter = await this.interpreterService.getActiveInterpreter(resource);
        if (!currentInterpreter) {
            return [];
        }

        if (!(await this.helper.isMacDefaultPythonPath(settings.pythonPath))) {
            return [];
        }
        if (!currentInterpreter || currentInterpreter.envType !== EnvironmentType.Unknown) {
            return [];
        }

        const interpreters = await this.interpreterService.getInterpreters(resource);
        for (const info of interpreters) {
            if (!(await this.helper.isMacDefaultPythonPath(info.path))) {
                return [
                    new InvalidMacPythonInterpreterDiagnostic(
                        DiagnosticCodes.MacInterpreterSelectedAndHaveOtherInterpretersDiagnostic,
                        resource,
                    ),
                ];
            }
        }
        return [
            new InvalidMacPythonInterpreterDiagnostic(
                DiagnosticCodes.MacInterpreterSelectedAndNoOtherInterpretersDiagnostic,
                resource,
            ),
        ];
    }
    protected async onHandle(diagnostics: IDiagnostic[]): Promise<void> {
        if (diagnostics.length === 0) {
            return;
        }
        const messageService = this.serviceContainer.get<IDiagnosticHandlerService<MessageCommandPrompt>>(
            IDiagnosticHandlerService,
            DiagnosticCommandPromptHandlerServiceId,
        );
        await Promise.all(
            diagnostics.map(async (diagnostic) => {
                const canHandle = await this.canHandle(diagnostic);
                const shouldIgnore = await this.filterService.shouldIgnoreDiagnostic(diagnostic.code);
                if (!canHandle || shouldIgnore) {
                    return;
                }
                const commandPrompts = this.getCommandPrompts(diagnostic);
                return messageService.handle(diagnostic, { commandPrompts, message: diagnostic.message });
            }),
        );
    }
    protected addPythonPathChangedHandler() {
        const workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        const disposables = this.serviceContainer.get<IDisposableRegistry>(IDisposableRegistry);
        const interpreterPathService = this.serviceContainer.get<IInterpreterPathService>(IInterpreterPathService);
        const experiments = this.serviceContainer.get<IExperimentsManager>(IExperimentsManager);
        if (experiments.inExperiment(DeprecatePythonPath.experiment)) {
            disposables.push(interpreterPathService.onDidChange((i) => this.onDidChangeConfiguration(undefined, i)));
        }
        experiments.sendTelemetryIfInExperiment(DeprecatePythonPath.control);
        disposables.push(workspaceService.onDidChangeConfiguration(this.onDidChangeConfiguration.bind(this)));
    }
    protected async onDidChangeConfiguration(
        event?: ConfigurationChangeEvent,
        interpreterConfigurationScope?: InterpreterConfigurationScope,
    ) {
        let workspaceUri: Resource;
        if (event) {
            const workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
            const workspacesUris: (Uri | undefined)[] = workspaceService.hasWorkspaceFolders
                ? workspaceService.workspaceFolders!.map((workspace) => workspace.uri)
                : [undefined];
            const workspaceUriIndex = workspacesUris.findIndex((uri) =>
                event.affectsConfiguration('python.pythonPath', uri),
            );
            if (workspaceUriIndex === -1) {
                return;
            }
            workspaceUri = workspacesUris[workspaceUriIndex];
        } else if (interpreterConfigurationScope) {
            workspaceUri = interpreterConfigurationScope.uri;
        } else {
            throw new Error(
                'One of `interpreterConfigurationScope` or `event` should be defined when calling `onDidChangeConfiguration`.',
            );
        }
        // Lets wait, for more changes, dirty simple throttling.
        if (this.timeOut) {
            // tslint:disable-next-line: no-any
            clearTimeout(this.timeOut as any);
            this.timeOut = undefined;
        }
        this.timeOut = setTimeout(() => {
            this.timeOut = undefined;
            this.diagnose(workspaceUri)
                .then((diagnostics) => this.handle(diagnostics))
                .ignoreErrors();
        }, this.changeThrottleTimeout);
    }
    private getCommandPrompts(diagnostic: IDiagnostic): { prompt: string; command?: IDiagnosticCommand }[] {
        const commandFactory = this.serviceContainer.get<IDiagnosticsCommandFactory>(IDiagnosticsCommandFactory);
        switch (diagnostic.code) {
            case DiagnosticCodes.MacInterpreterSelectedAndHaveOtherInterpretersDiagnostic: {
                return [
                    {
                        prompt: 'Select Python Interpreter',
                        command: commandFactory.createCommand(diagnostic, {
                            type: 'executeVSCCommand',
                            options: 'python.setInterpreter',
                        }),
                    },
                    {
                        prompt: 'Do not show again',
                        command: commandFactory.createCommand(diagnostic, {
                            type: 'ignore',
                            options: DiagnosticScope.Global,
                        }),
                    },
                ];
            }
            case DiagnosticCodes.MacInterpreterSelectedAndNoOtherInterpretersDiagnostic: {
                return [
                    {
                        prompt: 'Learn more',
                        command: commandFactory.createCommand(diagnostic, {
                            type: 'launch',
                            options: 'https://code.visualstudio.com/docs/python/python-tutorial#_prerequisites',
                        }),
                    },
                    {
                        prompt: 'Download',
                        command: commandFactory.createCommand(diagnostic, {
                            type: 'launch',
                            options: 'https://www.python.org/downloads',
                        }),
                    },
                    {
                        prompt: 'Do not show again',
                        command: commandFactory.createCommand(diagnostic, {
                            type: 'ignore',
                            options: DiagnosticScope.Global,
                        }),
                    },
                ];
            }
            default: {
                throw new Error("Invalid diagnostic for 'InvalidMacPythonInterpreterService'");
            }
        }
    }
}
