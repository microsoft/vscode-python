import { inject, injectable } from 'inversify';
import { ConfigurationTarget, Uri } from 'vscode';
import { IDocumentManager, IWorkspaceService } from '../common/application/types';
import { inDiscoveryExperiment } from '../common/experiments/helpers';
import { traceError } from '../common/logger';
import { FileSystemPaths } from '../common/platform/fs-paths';
import { IPythonExecutionFactory } from '../common/process/types';
import { IExperimentService, IPersistentStateFactory, Resource } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { compareSemVerLikeVersions } from '../pythonEnvironments/base/info/pythonVersion';
import { isMacDefaultPythonPath } from '../pythonEnvironments/discovery';
import { getInterpreterHash } from '../pythonEnvironments/discovery/locators/services/hashProvider';
import {
    EnvironmentType,
    getEnvironmentTypeName,
    InterpreterInformation,
    PythonEnvironment,
} from '../pythonEnvironments/info';
import { IComponentAdapter, IInterpreterHelper, WorkspacePythonPath } from './contracts';

const EXPIRY_DURATION = 24 * 60 * 60 * 1000;
type CachedPythonInterpreter = Partial<PythonEnvironment> & { fileHash: string };

export function isInterpreterLocatedInWorkspace(interpreter: PythonEnvironment, activeWorkspaceUri: Uri): boolean {
    const fileSystemPaths = FileSystemPaths.withDefaults();
    const interpreterPath = fileSystemPaths.normCase(interpreter.path);
    const resourcePath = fileSystemPaths.normCase(activeWorkspaceUri.fsPath);
    return interpreterPath.startsWith(resourcePath);
}

/**
 * Build a version-sorted list from the given one, with lowest first.
 */
function sortInterpreters(interpreters: PythonEnvironment[]): PythonEnvironment[] {
    if (interpreters.length === 0) {
        return [];
    }
    if (interpreters.length === 1) {
        return [interpreters[0]];
    }
    const sorted = interpreters.slice();
    sorted.sort((a, b) => (a.version && b.version ? compareSemVerLikeVersions(a.version, b.version) : 0));
    return sorted;
}

@injectable()
export class InterpreterHelper implements IInterpreterHelper {
    private readonly persistentFactory: IPersistentStateFactory;

    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IComponentAdapter) private readonly pyenvs: IComponentAdapter,
        @inject(IExperimentService) private readonly experimentService: IExperimentService,
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

    public async getInterpreterInformation(pythonPath: string): Promise<undefined | Partial<PythonEnvironment>> {
        if (await inDiscoveryExperiment(this.experimentService)) {
            return this.pyenvs.getInterpreterInformation(pythonPath);
        }

        const fileHash = await getInterpreterHash(pythonPath).catch((ex) => {
            traceError(`Failed to create File hash for interpreter ${pythonPath}`, ex);
            return undefined;
        });

        const store = this.persistentFactory.createGlobalPersistentState<CachedPythonInterpreter>(
            `${pythonPath}.v3`,
            undefined,
            EXPIRY_DURATION,
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

            // If hash value is undefined then don't store it.
            if (!fileHash) {
                return info;
            }

            const details = {
                ...info,
                fileHash,
            };
            await store.updateValue(details);
            return details;
        } catch (ex) {
            traceError(`Failed to get interpreter information for '${pythonPath}'`, ex);
        }
    }

    public async isMacDefaultPythonPath(pythonPath: string): Promise<boolean> {
        if (await inDiscoveryExperiment(this.experimentService)) {
            return this.pyenvs.isMacDefaultPythonPath(pythonPath);
        }

        return isMacDefaultPythonPath(pythonPath);
    }

    public getInterpreterTypeDisplayName(interpreterType: EnvironmentType): string {
        return getEnvironmentTypeName(interpreterType);
    }

    public getBestInterpreter(interpreters?: PythonEnvironment[]): PythonEnvironment | undefined {
        if (!Array.isArray(interpreters) || interpreters.length === 0) {
            return;
        }
        const sorted = sortInterpreters(interpreters);
        return sorted[sorted.length - 1];
    }
}
