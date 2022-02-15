import { injectable, inject } from 'inversify';
import { IExtensionSingleActivationService } from '../../../activation/types';
import { Commands } from '../../constants';
import { ICommandManager } from '../types';
import * as vscode from 'vscode';

@injectable()
export class CreatePythonFileCommandHandler implements IExtensionSingleActivationService {
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: true, virtualWorkspace: true };

    constructor(@inject(ICommandManager) private readonly commandManager: ICommandManager) {}

    public async activate(): Promise<void> {
        this.commandManager.registerCommand(Commands.CreateNewFile, this.createPythonFile, this);
    }

    public async createPythonFile(): Promise<void> {
        const newFile = await vscode.workspace.openTextDocument({ language: 'python' });
        vscode.window.showTextDocument(newFile);
    }
}
