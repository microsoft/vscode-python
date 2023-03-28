// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// eslint-disable-next-line max-classes-per-file
import { inject, injectable } from 'inversify';
import { DiagnosticSeverity, l10n } from 'vscode';
import '../../../common/extensions';
import * as path from 'path';
import { IDisposableRegistry, IInterpreterPathService, Resource } from '../../../common/types';
import { IInterpreterService } from '../../../interpreter/contracts';
import { IServiceContainer } from '../../../ioc/types';
import { BaseDiagnostic, BaseDiagnosticsService } from '../base';
import { IDiagnosticsCommandFactory } from '../commands/types';
import { DiagnosticCodes } from '../constants';
import { DiagnosticCommandPromptHandlerServiceId, MessageCommandPrompt } from '../promptHandler';
import {
    DiagnosticScope,
    IDiagnostic,
    IDiagnosticCommand,
    IDiagnosticHandlerService,
    IDiagnosticMessageOnCloseHandler,
} from '../types';
import { Common } from '../../../common/utils/localize';
import { Commands } from '../../../common/constants';
import { ICommandManager, IWorkspaceService } from '../../../common/application/types';
import { sendTelemetryEvent } from '../../../telemetry';
import { EventName } from '../../../telemetry/constants';
import { IExtensionSingleActivationService } from '../../../activation/types';
import { cache } from '../../../common/utils/decorators';
import { noop } from '../../../common/utils/misc';
import { IPythonExecutionFactory } from '../../../common/process/types';
import { getOSType, OSType } from '../../../common/utils/platform';
import { IFileSystem } from '../../../common/platform/types';
import { traceError } from '../../../logging';

const messages = {
    [DiagnosticCodes.NoPythonInterpretersDiagnostic]: l10n.t(
        'No Python interpreter is selected. Please select a Python interpreter to enable features such as IntelliSense, linting, and debugging.',
    ),
    [DiagnosticCodes.InvalidPythonInterpreterDiagnostic]: l10n.t(
        'An Invalid Python interpreter is selected{0}, please try changing it to enable features such as IntelliSense, linting, and debugging. See output for more details regarding why the interpreter is invalid.',
    ),
    [DiagnosticCodes.InvalidComspecDiagnostic]: l10n.t(
        "The environment variable 'Comspec' seems to be set to an invalid value. Please correct it to carry valid path to Command Prompt to enable features such as IntelliSense, linting, and debugging. See instructions which might help.",
    ),
};

export class InvalidPythonInterpreterDiagnostic extends BaseDiagnostic {
    constructor(
        code: DiagnosticCodes.NoPythonInterpretersDiagnostic | DiagnosticCodes.InvalidPythonInterpreterDiagnostic,
        resource: Resource,
        workspaceService: IWorkspaceService,
        scope = DiagnosticScope.WorkspaceFolder,
    ) {
        let formatArg = '';
        if (
            workspaceService.workspaceFile &&
            workspaceService.workspaceFolders &&
            workspaceService.workspaceFolders?.length > 1
        ) {
            // Specify folder name in case of multiroot scenarios
            const folder = workspaceService.getWorkspaceFolder(resource);
            if (folder) {
                formatArg = ` ${l10n.t('for workspace')} ${path.basename(folder.uri.fsPath)}`;
            }
        }
        super(code, messages[code].format(formatArg), DiagnosticSeverity.Error, scope, resource, undefined, 'always');
    }
}

export class DefaultShellDiagnostic extends BaseDiagnostic {
    constructor(code: DiagnosticCodes.InvalidComspecDiagnostic, resource: Resource, scope = DiagnosticScope.Global) {
        super(code, messages[code], DiagnosticSeverity.Error, scope, resource, undefined, 'always');
    }
}

export const InvalidPythonInterpreterServiceId = 'InvalidPythonInterpreterServiceId';

@injectable()
export class InvalidPythonInterpreterService extends BaseDiagnosticsService
    implements IExtensionSingleActivationService {
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: false, virtualWorkspace: true };

    constructor(
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry,
    ) {
        super(
            [
                DiagnosticCodes.NoPythonInterpretersDiagnostic,
                DiagnosticCodes.InvalidPythonInterpreterDiagnostic,
                DiagnosticCodes.InvalidComspecDiagnostic,
            ],
            serviceContainer,
            disposableRegistry,
            false,
        );
    }

    public async activate(): Promise<void> {
        const commandManager = this.serviceContainer.get<ICommandManager>(ICommandManager);
        this.disposableRegistry.push(
            commandManager.registerCommand(Commands.TriggerEnvironmentSelection, (resource: Resource) =>
                this.triggerEnvSelectionIfNecessary(resource),
            ),
        );
        const interpreterService = this.serviceContainer.get<IInterpreterService>(IInterpreterService);
        this.disposableRegistry.push(
            interpreterService.onDidChangeInterpreterConfiguration((e) =>
                commandManager.executeCommand(Commands.TriggerEnvironmentSelection, e).then(noop, noop),
            ),
        );
    }

    // eslint-disable-next-line class-methods-use-this
    public async diagnose(_resource: Resource): Promise<IDiagnostic[]> {
        return [];
    }

    public async _manualDiagnose(resource: Resource): Promise<IDiagnostic[]> {
        const workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        const interpreterService = this.serviceContainer.get<IInterpreterService>(IInterpreterService);
        const currentInterpreter = await interpreterService.getActiveInterpreter(resource);
        if (!currentInterpreter) {
            const diagnostics = await this.diagnoseDefaultShell(resource);
            if (diagnostics.length) {
                return diagnostics;
            }
        }
        const hasInterpreters = await interpreterService.hasInterpreters();
        const interpreterPathService = this.serviceContainer.get<IInterpreterPathService>(IInterpreterPathService);
        const isInterpreterSetToDefault = interpreterPathService.get(resource) === 'python';

        if (!hasInterpreters && isInterpreterSetToDefault) {
            return [
                new InvalidPythonInterpreterDiagnostic(
                    DiagnosticCodes.NoPythonInterpretersDiagnostic,
                    resource,
                    workspaceService,
                    DiagnosticScope.Global,
                ),
            ];
        }

        if (!currentInterpreter) {
            return [
                new InvalidPythonInterpreterDiagnostic(
                    DiagnosticCodes.InvalidPythonInterpreterDiagnostic,
                    resource,
                    workspaceService,
                ),
            ];
        }
        return [];
    }

    public async triggerEnvSelectionIfNecessary(resource: Resource): Promise<boolean> {
        const diagnostics = await this._manualDiagnose(resource);
        if (!diagnostics.length) {
            return true;
        }
        this.handle(diagnostics).ignoreErrors();
        return false;
    }

    @cache(1000, true) // This is to handle throttling of multiple events.
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
                if (!this.canHandle(diagnostic)) {
                    return;
                }
                const commandPrompts = this.getCommandPrompts(diagnostic);
                const onClose = getOnCloseHandler(diagnostic);
                await messageService.handle(diagnostic, { commandPrompts, message: diagnostic.message, onClose });
            }),
        );
    }

    private getCommandPrompts(diagnostic: IDiagnostic): { prompt: string; command?: IDiagnosticCommand }[] {
        const commandFactory = this.serviceContainer.get<IDiagnosticsCommandFactory>(IDiagnosticsCommandFactory);
        if (diagnostic.code === DiagnosticCodes.InvalidComspecDiagnostic) {
            return [
                {
                    prompt: Common.instructions,
                    command: commandFactory.createCommand(diagnostic, {
                        type: 'launch',
                        options: 'https://aka.ms/AAk3djo',
                    }),
                },
            ];
        }
        const prompts = [
            {
                prompt: Common.selectPythonInterpreter,
                command: commandFactory.createCommand(diagnostic, {
                    type: 'executeVSCCommand',
                    options: Commands.Set_Interpreter,
                }),
            },
        ];
        if (diagnostic.code === DiagnosticCodes.InvalidPythonInterpreterDiagnostic) {
            prompts.push({
                prompt: Common.openOutputPanel,
                command: commandFactory.createCommand(diagnostic, {
                    type: 'executeVSCCommand',
                    options: Commands.ViewOutput,
                }),
            });
        }
        return prompts;
    }

    private async diagnoseDefaultShell(resource: Resource): Promise<IDiagnostic[]> {
        if (getOSType() !== OSType.Windows) {
            return [];
        }
        const executionFactory = this.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory);
        const executionService = await executionFactory.create({ resource });
        try {
            await executionService.getExecutablePath({ throwOnError: true });
        } catch (ex) {
            if ((ex as Error).message?.includes('4058')) {
                // ENOENT (-4058) error is thrown by Node when the default shell is invalid.
                if (await this.isComspecInvalid()) {
                    traceError('ComSpec is set to an invalid value', process.env.ComSpec);
                    return [new DefaultShellDiagnostic(DiagnosticCodes.InvalidComspecDiagnostic, resource)];
                }
            }
        }
        return [];
    }

    private async isComspecInvalid() {
        const comSpec = process.env.ComSpec ?? '';
        const fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
        return fs.fileExists(comSpec);
    }
}

function getOnCloseHandler(diagnostic: IDiagnostic): IDiagnosticMessageOnCloseHandler | undefined {
    if (diagnostic.code === DiagnosticCodes.NoPythonInterpretersDiagnostic) {
        return (response?: string) => {
            sendTelemetryEvent(EventName.PYTHON_NOT_INSTALLED_PROMPT, undefined, {
                selection: response ? 'Download' : 'Ignore',
            });
        };
    }
    return undefined;
}
