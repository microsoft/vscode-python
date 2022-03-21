import { injectable, inject } from 'inversify';
import { IExtensionSingleActivationService } from '../../../activation/types';
import { Commands } from '../../constants';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../types';
import { sendTelemetryEvent } from '../../../telemetry';
import { EventName } from '../../../telemetry/constants';

@injectable()
export class CreatePythonFileCommandHandler implements IExtensionSingleActivationService {
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: true, virtualWorkspace: true };

    constructor(
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
    ) {}

    public async activate(): Promise<void> {
        this.commandManager.registerCommand(Commands.CreateNewFile, this.createPythonFile, this);
    }

    public async createPythonFile(): Promise<void> {
        const newFile = await this.workspaceService.openTextDocument({ language: 'python' });
        this.appShell.showTextDocument(newFile);
        sendTelemetryEvent(EventName.CREATE_NEW_FILE_COMMAND);
    }
}
