// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Disposable, Terminal } from 'vscode';
import { IActiveResourceService, ICommandManager } from '../common/application/types';
import { Commands } from '../common/constants';
import { ITerminalActivator, ITerminalServiceFactory } from '../common/terminal/types';
import { IConfigurationService } from '../common/types';
import { swallowExceptions } from '../common/utils/decorators';
import { IServiceContainer } from '../ioc/types';
import { captureTelemetry, sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';

export class TerminalProvider implements Disposable {
    private disposables: Disposable[] = [];
    private activeResourceService: IActiveResourceService;
    constructor(private serviceContainer: IServiceContainer) {
        this.registerCommands();
        this.activeResourceService = this.serviceContainer.get<IActiveResourceService>(IActiveResourceService);
    }

    @swallowExceptions('Failed to initialize terminal provider')
    public async initialize(currentTerminal: Terminal | undefined) {
        const configuration = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        const pythonSettings = configuration.getSettings(this.activeResourceService.getActiveResource());

        if (pythonSettings.terminal.activateEnvInCurrentTerminal) {
            if (currentTerminal) {
                const terminalActivator = this.serviceContainer.get<ITerminalActivator>(ITerminalActivator);
                await terminalActivator.activateEnvironmentInTerminal(currentTerminal, undefined, true);
            }
            sendTelemetryEvent(EventName.ACTIVATE_ENV_IN_CURRENT_TERMINAL, undefined, { isTerminalVisible: currentTerminal ? true : false });
        }
    }
    public dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
    }
    private registerCommands() {
        const commandManager = this.serviceContainer.get<ICommandManager>(ICommandManager);
        const disposable = commandManager.registerCommand(Commands.Create_Terminal, this.onCreateTerminal, this);

        this.disposables.push(disposable);
    }
    @captureTelemetry(EventName.TERMINAL_CREATE, { triggeredBy: 'commandpalette' })
    private async onCreateTerminal() {
        const terminalService = this.serviceContainer.get<ITerminalServiceFactory>(ITerminalServiceFactory);
        const activeResource = this.activeResourceService.getActiveResource();
        await terminalService.createTerminalService(activeResource, 'Python').show(false);
    }
}
