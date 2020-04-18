import {
    CancellationToken,
    OutputChannel,
    Position,
    ProviderResult,
    RenameProvider,
    TextDocument,
    Uri,
    window,
    workspace,
    WorkspaceEdit
} from 'vscode';
import { STANDARD_OUTPUT_CHANNEL } from '../common/constants';
import { getWorkspaceEditsFromPatch } from '../common/editor';
import { traceError } from '../common/logger';
import { IFileSystem } from '../common/platform/types';
import { IPythonExecutionFactory } from '../common/process/types';
import { IInstaller, IOutputChannel, Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { RefactorProxy } from '../refactor/proxy';
import { captureTelemetry } from '../telemetry';
import { EventName } from '../telemetry/constants';

type RenameResponse = {
    results: [{ diff: string }];
};

export class PythonRenameProvider implements RenameProvider {
    private readonly outputChannel: OutputChannel;
    constructor(private serviceContainer: IServiceContainer) {
        this.outputChannel = serviceContainer.get<OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
    }
    @captureTelemetry(EventName.REFACTOR_RENAME)
    public provideRenameEdits(
        document: TextDocument,
        position: Position,
        newName: string,
        _token: CancellationToken
    ): ProviderResult<WorkspaceEdit> {
        return workspace.saveAll(false).then(() => {
            return this.doRename(document, position, newName);
        });
    }

    private doRename(document: TextDocument, position: Position, newName: string): ProviderResult<WorkspaceEdit> {
        if (document.lineAt(position.line).text.match(/^\s*\/\//)) {
            return;
        }
        if (position.character <= 0) {
            return;
        }

        const range = document.getWordRangeAtPosition(position);
        if (!range || range.isEmpty) {
            return;
        }
        const oldName = document.getText(range);
        if (oldName === newName) {
            return;
        }

        let workspaceFolder = workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder && Array.isArray(workspace.workspaceFolders) && workspace.workspaceFolders.length > 0) {
            workspaceFolder = workspace.workspaceFolders[0];
        }
        const workspaceRoot = workspaceFolder ? workspaceFolder.uri.fsPath : __dirname;

        const proxy = new RefactorProxy(workspaceRoot, async () => {
            const factory = this.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory);
            return factory.create({ resource: Uri.file(workspaceRoot) });
        });
        return proxy
            .rename<RenameResponse>(document, newName, document.uri.fsPath, range)
            .then((response) => {
                const fileDiffs = response.results.map((fileChanges) => fileChanges.diff);
                const fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
                return getWorkspaceEditsFromPatch(fileDiffs, workspaceRoot, fs);
            })
            .catch((reason) => {
                if (reason === 'Not installed') {
                    const installer = this.serviceContainer.get<IInstaller>(IInstaller);
                    installer
                        .promptToInstall(Product.rope, document.uri)
                        .catch((ex) => traceError('Python Extension: promptToInstall', ex));
                    return Promise.reject('');
                } else {
                    window.showErrorMessage(reason);
                    this.outputChannel.appendLine(reason);
                }
                return Promise.reject(reason);
            });
    }
}
