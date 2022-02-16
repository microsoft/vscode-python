import { injectable, inject } from 'inversify';
import * as vscode from 'vscode';
import { IExtensionSingleActivationService } from '../../../activation/types';
import { Commands } from '../../constants';
import { ICommandManager, IWorkspaceService } from '../types';
import { sendTelemetryEvent } from '../../../telemetry';
import { EventName } from '../../../telemetry/constants';

@injectable()
export class CreatePythonFileCommandHandler implements IExtensionSingleActivationService {
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: true, virtualWorkspace: true };

    constructor(
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
    ) {}

    public async activate(): Promise<void> {
        if (!this.workspaceService.getConfiguration('python').get<boolean>('createNewFileEnabled')) {
            return;
        }
        this.commandManager.registerCommand(Commands.CreateNewFile, this.createPythonFile, this);
    }

    // eslint-disable-next-line class-methods-use-this
    public async createPythonFile(): Promise<void> {
        const newFile = await vscode.workspace.openTextDocument({ language: 'python' });
        vscode.window.showTextDocument(newFile);
        sendTelemetryEvent(EventName.CREATE_NEW_FILE_COMMAND);
    }
}
