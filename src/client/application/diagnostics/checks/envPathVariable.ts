// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { DiagnosticSeverity } from 'vscode';
import { IApplicationEnvironment } from '../../../common/application/types';
import '../../../common/extensions';
import { IPlatformService } from '../../../common/platform/types';
import { ICurrentProcess, IPathUtils } from '../../../common/types';
import { IServiceContainer } from '../../../ioc/types';
import { BaseDiagnostic, BaseDiagnosticsService } from '../base';
import { IDiagnosticsCommandFactory } from '../commands/types';
import { DiagnosticCodes } from '../constants';
import { DiagnosticCommandPromptHandlerServiceId, MessageCommandPrompt } from '../promptHandler';
import { DiagnosticScope, IDiagnostic, IDiagnosticHandlerService } from '../types';

const InvalidEnvPathVariableMessage = 'The environment variable \'{0}\' seems to have some paths containing characters (\';\', \'"\' or \';;\').' +
    ' The existence of such characters are known to have caused the {1} extension to not load. If the extension fails to load please modify your paths to remove these characters.';

export class InvalidEnvironmentPathVariableDiagnostic extends BaseDiagnostic {
    constructor(message) {
        super(DiagnosticCodes.InvalidEnvironmentPathVariableDiagnostic,
            message, DiagnosticSeverity.Warning, DiagnosticScope.Global);
    }
}

export const EnvironmentPathVariableDiagnosticsServiceId = 'EnvironmentPathVariableDiagnosticsServiceId';

@injectable()
export class EnvironmentPathVariableDiagnosticsService extends BaseDiagnosticsService {
    protected readonly messageService: IDiagnosticHandlerService<MessageCommandPrompt>;
    private readonly platform: IPlatformService;
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super([DiagnosticCodes.InvalidEnvironmentPathVariableDiagnostic], serviceContainer);
        this.platform = this.serviceContainer.get<IPlatformService>(IPlatformService);
        this.messageService = serviceContainer.get<IDiagnosticHandlerService<MessageCommandPrompt>>(IDiagnosticHandlerService, DiagnosticCommandPromptHandlerServiceId);
    }
    public async diagnose(): Promise<IDiagnostic[]> {
        if (this.platform.isWindows &&
            this.doesPathVariableHaveInvalidEntries()) {
            const env = this.serviceContainer.get<IApplicationEnvironment>(IApplicationEnvironment);
            const message = InvalidEnvPathVariableMessage
                .format(this.platform.pathVariableName, env.extensionName);
            return [new InvalidEnvironmentPathVariableDiagnostic(message)];
        } else {
            return [];
        }
    }
    public async handle(diagnostics: IDiagnostic[]): Promise<void> {
        // This class can only handle one type of diagnostic, hence just use first item in list.
        if (diagnostics.length === 0 || !this.canHandle(diagnostics[0])) {
            return;
        }
        const diagnostic = diagnostics[0];
        if (await this.filterService.shouldIgnoreDiagnostic(diagnostic.code)) {
            return;
        }
        const commandFactory = this.serviceContainer.get<IDiagnosticsCommandFactory>(IDiagnosticsCommandFactory);
        const options = [
            {
                prompt: 'Ignore'
            },
            {
                prompt: 'Always Ignore',
                command: commandFactory.createCommand(diagnostic, { type: 'ignore', options: DiagnosticScope.Global })
            },
            {
                prompt: 'More Info',
                command: commandFactory.createCommand(diagnostic, { type: 'launch', options: 'https://aka.ms/Niq35h' })
            }
        ];

        await this.messageService.handle(diagnostic, { commandPrompts: options });
    }
    private doesPathVariableHaveInvalidEntries() {
        const currentProc = this.serviceContainer.get<ICurrentProcess>(ICurrentProcess);
        const pathValue = currentProc.env[this.platform.pathVariableName];
        const pathSeparator = this.serviceContainer.get<IPathUtils>(IPathUtils).delimiter;
        const paths = pathValue.split(pathSeparator);
        return paths.filter((item, index) => item.indexOf('"') >= 0 || item.indexOf(';') >= 0 || (item.length === 0 && index !== paths.length - 1)).length > 0;
    }
}
