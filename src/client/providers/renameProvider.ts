import {
    CancellationToken,
    OutputChannel,
    Position,
    ProviderResult,
    RenameProvider,
    TextDocument,
    window,
    workspace,
    WorkspaceEdit
} from 'vscode';
import { EXTENSION_ROOT_DIR, STANDARD_OUTPUT_CHANNEL } from '../common/constants';
import { getWorkspaceEditsFromPatch } from '../common/editor';
import { traceError } from '../common/logger';
import { IFileSystem } from '../common/platform/types';
import { IConfigurationService, IInstaller, IOutputChannel, Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { RefactorProxy } from '../refactor/proxy';
import { captureTelemetry } from '../telemetry';
import { EventName } from '../telemetry/constants';

type RenameResponse = {
    results: [{ diff: string }];
};

export class PythonRenameProvider implements RenameProvider {
    private readonly outputChannel: OutputChannel;
    private readonly configurationService: IConfigurationService;
    constructor(private serviceContainer: IServiceContainer) {
        this.outputChannel = serviceContainer.get<OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
        this.configurationService = serviceContainer.get<IConfigurationService>(IConfigurationService);
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
        const pythonSettings = this.configurationService.getSettings(workspaceFolder ? workspaceFolder.uri : undefined);

        const proxy = new RefactorProxy(EXTENSION_ROOT_DIR, pythonSettings, workspaceRoot, this.serviceContainer);
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
