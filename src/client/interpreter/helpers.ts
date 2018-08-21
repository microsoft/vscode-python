import { inject, injectable } from 'inversify';
import { ConfigurationTarget } from 'vscode';
import { IDocumentManager, IWorkspaceService } from '../common/application/types';
import { IFileSystem } from '../common/platform/types';
import { InterpreterInfomation, IPythonExecutionFactory } from '../common/process/types';
import { IPersistentStateFactory } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { IInterpreterHelper, PythonInterpreter, WorkspacePythonPath } from './contracts';

const EXPITY_DURATION = 24 * 60 * 60 * 1000;
type CachedPythonInterpreter = Partial<PythonInterpreter> & { fileHash: string };

export function getFirstNonEmptyLineFromMultilineString(stdout: string) {
    if (!stdout) {
        return '';
    }
    const lines = stdout.split(/\r?\n/g).map(line => line.trim()).filter(line => line.length > 0);
    return lines.length > 0 ? lines[0] : '';
}

@injectable()
export class InterpreterHelper implements IInterpreterHelper {
    private readonly fs: IFileSystem;
    private readonly persistentFactory: IPersistentStateFactory;
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.persistentFactory = this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
        this.fs = this.serviceContainer.get<IFileSystem>(IFileSystem);
    }
    public getActiveWorkspaceUri(): WorkspacePythonPath | undefined {
        const workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        const documentManager = this.serviceContainer.get<IDocumentManager>(IDocumentManager);

        if (!workspaceService.hasWorkspaceFolders) {
            return;
        }
        if (Array.isArray(workspaceService.workspaceFolders) && workspaceService.workspaceFolders.length === 1) {
            return { folderUri: workspaceService.workspaceFolders[0].uri, configTarget: ConfigurationTarget.Workspace };
        }
        if (documentManager.activeTextEditor) {
            const workspaceFolder = workspaceService.getWorkspaceFolder(documentManager.activeTextEditor.document.uri);
            if (workspaceFolder) {
                return { configTarget: ConfigurationTarget.WorkspaceFolder, folderUri: workspaceFolder.uri };
            }
        }
    }
    public async getInterpreterInformation(pythonPath: string): Promise<undefined | Partial<PythonInterpreter>> {
        let fileHash = await this.fs.getFileHash(pythonPath).catch(() => '');
        fileHash = fileHash ? fileHash : '';
        const store = this.persistentFactory.createGlobalPersistentState<CachedPythonInterpreter>(pythonPath, undefined, EXPITY_DURATION);
        if (store.value && (!fileHash || store.value.fileHash === fileHash)) {
            return store.value;
        }
        const processService = await this.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory).create({ pythonPath });

        try {
            const info = await processService.getInterpreterInformation().catch<InterpreterInfomation | undefined>(() => undefined);
            if (!info) {
                return;
            }
            const details = {
                ...(info),
                fileHash
            };
            await store.updateValue(details);
            return details;
        } catch (ex) {
            console.error(`Failed to get interpreter information for '${pythonPath}'`, ex);
            return {};
        }
    }
    public isMacDefaultPythonPath(pythonPath: string) {
        return pythonPath === 'python' || pythonPath === '/usr/bin/python';
    }
}
