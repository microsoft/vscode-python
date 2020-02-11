import { inject, injectable } from 'inversify';
import { compare } from 'semver';
import { ConfigurationTarget } from 'vscode';
import { IDocumentManager, IWorkspaceService } from '../common/application/types';
import { traceError } from '../common/logger';
import { InterpreterInfomation, IPythonExecutionFactory } from '../common/process/types';
import { IPersistentStateFactory, Resource } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { IInterpreterHelper, InterpreterType, PythonInterpreter, WorkspacePythonPath } from './contracts';
import { InterpeterHashProviderFactory } from './locators/services/hashProviderFactory';
import { IInterpreterHashProviderFactory } from './locators/types';

const EXPITY_DURATION = 24 * 60 * 60 * 1000;
type CachedPythonInterpreter = Partial<PythonInterpreter> & { fileHash: string };

export function getFirstNonEmptyLineFromMultilineString(stdout: string) {
    if (!stdout) {
        return '';
    }
    const lines = stdout
        .split(/\r?\n/g)
        .map(line => line.trim())
        .filter(line => line.length > 0);
    return lines.length > 0 ? lines[0] : '';
}

@injectable()
export class InterpreterHelper implements IInterpreterHelper {
    private readonly persistentFactory: IPersistentStateFactory;
    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(InterpeterHashProviderFactory) private readonly hashProviderFactory: IInterpreterHashProviderFactory
    ) {
        this.persistentFactory = this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
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
        const fileHash = await this.hashProviderFactory
            .create({ pythonPath })
            .then(provider => provider.getInterpreterHash(pythonPath))
            .catch(ex => {
                traceError(`Failed to create File hash for interpreter ${pythonPath}`, ex);
                return '';
            });
        const store = this.persistentFactory.createGlobalPersistentState<CachedPythonInterpreter>(
            `${pythonPath}.v3`,
            undefined,
            EXPITY_DURATION
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
                .catch<InterpreterInfomation | undefined>(() => undefined);
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
        return pythonPath === 'python' || pythonPath === '/usr/bin/python';
    }
    public getInterpreterTypeDisplayName(interpreterType: InterpreterType) {
        switch (interpreterType) {
            case InterpreterType.Conda: {
                return 'conda';
            }
            case InterpreterType.Pipenv: {
                return 'pipenv';
            }
            case InterpreterType.Pyenv: {
                return 'pyenv';
            }
            case InterpreterType.Venv: {
                return 'venv';
            }
            case InterpreterType.VirtualEnv: {
                return 'virtualenv';
            }
            default: {
                return '';
            }
        }
    }
    public getBestInterpreter(interpreters?: PythonInterpreter[]): PythonInterpreter | undefined {
        if (!Array.isArray(interpreters) || interpreters.length === 0) {
            return;
        }
        if (interpreters.length === 1) {
            return interpreters[0];
        }
        const sorted = interpreters.slice();
        sorted.sort((a, b) => (a.version && b.version ? compare(a.version.raw, b.version.raw) : 0));
        return sorted[sorted.length - 1];
    }
}
