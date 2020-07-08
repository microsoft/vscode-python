import { inject, injectable } from 'inversify';
import { ConfigurationTarget, Uri } from 'vscode';
import { IDocumentManager, IWorkspaceService } from '../common/application/types';
import { traceError } from '../common/logger';
import { FileSystemPaths } from '../common/platform/fs-paths';
import { IFileSystem } from '../common/platform/types';
import { IPythonExecutionFactory } from '../common/process/types';
import { IPersistentStateFactory, Resource } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { isMacDefaultPythonPath } from '../pythonEnvironments/discovery';
import { InterpreterHashProvider } from '../pythonEnvironments/discovery/locators/services/hashProvider';
import { InterpeterHashProviderFactory } from '../pythonEnvironments/discovery/locators/services/hashProviderFactory';
import { WindowsStoreInterpreter } from '../pythonEnvironments/discovery/locators/services/windowsStoreInterpreter';
import {
    getInterpreterTypeName,
    InterpreterInformation,
    InterpreterType,
    PythonInterpreter,
    sortInterpreters
} from '../pythonEnvironments/info';
import { IInterpreterHelper } from './contracts';
import { IInterpreterHashProviderFactory } from './locators/types';

const EXPIRY_DURATION = 24 * 60 * 60 * 1000;
type CachedPythonInterpreter = Partial<PythonInterpreter> & { fileHash: string };

export type WorkspacePythonPath = {
    folderUri: Uri;
    configTarget: ConfigurationTarget.Workspace | ConfigurationTarget.WorkspaceFolder;
};

export function getFirstNonEmptyLineFromMultilineString(stdout: string) {
    if (!stdout) {
        return '';
    }
    const lines = stdout
        .split(/\r?\n/g)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    return lines.length > 0 ? lines[0] : '';
}

export function isInterpreterLocatedInWorkspace(interpreter: PythonInterpreter, activeWorkspaceUri: Uri) {
    const fileSystemPaths = FileSystemPaths.withDefaults();
    const interpreterPath = fileSystemPaths.normCase(interpreter.path);
    const resourcePath = fileSystemPaths.normCase(activeWorkspaceUri.fsPath);
    return interpreterPath.startsWith(resourcePath);
}

@injectable()
export class InterpreterHelper implements IInterpreterHelper {
    public _hashProviderFactory: IInterpreterHashProviderFactory;
    private readonly persistentFactory: IPersistentStateFactory;
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        const fs: IFileSystem = this.serviceContainer.get<IFileSystem>(IFileSystem);
        const executionFactory: IPythonExecutionFactory = this.serviceContainer.get<IPythonExecutionFactory>(
            IPythonExecutionFactory
        );
        this.persistentFactory = this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
        this._hashProviderFactory = new InterpeterHashProviderFactory(
            new WindowsStoreInterpreter(executionFactory, this.persistentFactory, fs),
            new InterpreterHashProvider(fs)
        );
    }
    public getActiveWorkspaceUri(resource: Resource): WorkspacePythonPath | undefined {
        const workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        if (!workspaceService.hasWorkspaceFolders) {
            return;
        }
        if (Array.isArray(workspaceService.workspaceFolders) && workspaceService.workspaceFolders.length === 1) {
            return { folderUri: workspaceService.workspaceFolders[0].uri, configTarget: ConfigurationTarget.Workspace };
        }

        if (resource) {
            const workspaceFolder = workspaceService.getWorkspaceFolder(resource);
            if (workspaceFolder) {
                return { configTarget: ConfigurationTarget.WorkspaceFolder, folderUri: workspaceFolder.uri };
            }
        }
        const documentManager = this.serviceContainer.get<IDocumentManager>(IDocumentManager);

        if (documentManager.activeTextEditor) {
            const workspaceFolder = workspaceService.getWorkspaceFolder(documentManager.activeTextEditor.document.uri);
            if (workspaceFolder) {
                return { configTarget: ConfigurationTarget.WorkspaceFolder, folderUri: workspaceFolder.uri };
            }
        }
    }
    public async getInterpreterInformation(pythonPath: string): Promise<undefined | Partial<PythonInterpreter>> {
        const fileHash = await this._hashProviderFactory
            .create(pythonPath)
            .then((provider) => provider.getInterpreterHash(pythonPath))
            .catch((ex) => {
                traceError(`Failed to create File hash for interpreter ${pythonPath}`, ex);
                return '';
            });
        const store = this.persistentFactory.createGlobalPersistentState<CachedPythonInterpreter>(
            `${pythonPath}.v3`,
            undefined,
            EXPIRY_DURATION
        );
        if (store.value && fileHash && store.value.fileHash === fileHash) {
            return store.value;
        }
        const processService = await this.serviceContainer
            .get<IPythonExecutionFactory>(IPythonExecutionFactory)
            .create({ pythonPath });

        try {
            const info = await processService
                .getInterpreterInformation()
                .catch<InterpreterInformation | undefined>(() => undefined);
            if (!info) {
                return;
            }
            const details = {
                ...info,
                fileHash
            };
            await store.updateValue(details);
            return details;
        } catch (ex) {
            traceError(`Failed to get interpreter information for '${pythonPath}'`, ex);
            return;
        }
    }
    public isMacDefaultPythonPath(pythonPath: string) {
        return isMacDefaultPythonPath(pythonPath);
    }
    public getInterpreterTypeDisplayName(interpreterType: InterpreterType) {
        return getInterpreterTypeName(interpreterType);
    }
    public getBestInterpreter(interpreters?: PythonInterpreter[]): PythonInterpreter | undefined {
        if (!Array.isArray(interpreters) || interpreters.length === 0) {
            return;
        }
        const sorted = sortInterpreters(interpreters);
        return sorted[sorted.length - 1];
    }
}
