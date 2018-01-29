import { Disposable, Uri } from 'vscode';
import { ICommandManager, IDocumentManager, IWorkspaceService } from '../common/application/types';
import { Commands } from '../common/constants';
import { IServiceContainer } from '../ioc/types';
import { captureTelemetry } from '../telemetry';
import { REPL } from '../telemetry/constants';
import { ICodeExecutionService } from '../terminals/types';

export class ReplProvider implements Disposable {
    private readonly disposables: Disposable[] = [];
    constructor(private serviceContainer: IServiceContainer) {
        this.registerCommand();
    }
    public dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
    }
    private registerCommand() {
        const commandManager = this.serviceContainer.get<ICommandManager>(ICommandManager);
        const disposable = commandManager.registerCommand(Commands.Start_REPL, this.commandHandler, this);
        this.disposables.push(disposable);
    }
    @captureTelemetry(REPL)
    private async commandHandler() {
        const resource = this.getActiveResourceUri();
        const replProvider = this.serviceContainer.get<ICodeExecutionService>(ICodeExecutionService, 'repl');
        await replProvider.initializeRepl(resource);
    }
    private getActiveResourceUri(): Uri | undefined {
        const documentManager = this.serviceContainer.get<IDocumentManager>(IDocumentManager);
        if (documentManager.activeTextEditor && !documentManager.activeTextEditor!.document.isUntitled) {
            return documentManager.activeTextEditor!.document.uri;
        }
        const workspace = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        if (Array.isArray(workspace.workspaceFolders) && workspace.workspaceFolders.length > 0) {
            return workspace.workspaceFolders[0].uri;
        }
    }
}
