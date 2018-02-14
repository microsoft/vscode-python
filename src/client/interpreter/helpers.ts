import { inject, injectable } from 'inversify';
import { ConfigurationTarget } from 'vscode';
import { IDocumentManager, IWorkspaceService } from '../common/application/types';
import { IServiceContainer } from '../ioc/types';
import { IInterpreterHelper, WorkspacePythonPath } from './contracts';

export function getFirstNonEmptyLineFromMultilineString(stdout: string) {
    if (!stdout) {
        return '';
    }
    const lines = stdout.split(/\r?\n/g).map(line => line.trim()).filter(line => line.length > 0);
    return lines.length > 0 ? lines[0] : '';
}

@injectable()
export class InterpreterHelper implements IInterpreterHelper {
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
    }
    public getActiveWorkspaceUri(): WorkspacePythonPath | undefined {
        const workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        const documentManager = this.serviceContainer.get<IDocumentManager>(IDocumentManager);

        if (!Array.isArray(workspaceService.workspaceFolders) || workspaceService.workspaceFolders.length === 0) {
            return;
        }
        if (workspaceService.workspaceFolders.length === 1) {
            return { folderUri: workspaceService.workspaceFolders[0].uri, configTarget: ConfigurationTarget.Workspace };
        }
        if (documentManager.activeTextEditor) {
            const workspaceFolder = workspaceService.getWorkspaceFolder(documentManager.activeTextEditor.document.uri);
            if (workspaceFolder) {
                return { configTarget: ConfigurationTarget.WorkspaceFolder, folderUri: workspaceFolder.uri };
            }
        }
    }
}
