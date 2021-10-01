import { inject, injectable } from 'inversify';
import { Disposable, Event, EventEmitter, Uri } from 'vscode';
import '../common/extensions';
import { IDocumentManager, IWorkspaceService } from '../common/application/types';
import { DeprecatePythonPath } from '../common/experiments/groups';
import { traceError } from '../common/logger';
import { IPythonExecutionFactory } from '../common/process/types';
import {
    IConfigurationService,
    IDisposableRegistry,
    IExperimentService,
    IInterpreterPathService,
} from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { PythonEnvironment } from '../pythonEnvironments/info';
import {
    IComponentAdapter,
    IInterpreterDisplay,
    IInterpreterService,
    PythonEnvironmentsChangedEvent,
} from './contracts';
import { PythonLocatorQuery } from '../pythonEnvironments/base/locator';

type StoredPythonEnvironment = PythonEnvironment & { store?: boolean };

@injectable()
export class InterpreterService implements Disposable, IInterpreterService {
    public async hasInterpreters(
        filter: (e: PythonEnvironment) => Promise<boolean> = async () => true,
    ): Promise<boolean> {
        return this.pyenvs.hasInterpreters(filter);
    }

    public get onRefreshStart(): Event<void> {
        return this.pyenvs.onRefreshStart;
    }

    public triggerRefresh(query?: PythonLocatorQuery): Promise<void> {
        return this.pyenvs.triggerRefresh(query);
    }

    public get refreshPromise(): Promise<void> | undefined {
        return this.pyenvs.refreshPromise;
    }

    public get onDidChangeInterpreter(): Event<void> {
        return this.didChangeInterpreterEmitter.event;
    }

    public onDidChangeInterpreters: Event<PythonEnvironmentsChangedEvent>;

    public get onDidChangeInterpreterInformation(): Event<PythonEnvironment> {
        return this.didChangeInterpreterInformation.event;
    }

    public get onDidChangeInterpreterConfiguration(): Event<Uri | undefined> {
        return this.didChangeInterpreterConfigurationEmitter.event;
    }

    public _pythonPathSetting = '';

    private readonly didChangeInterpreterConfigurationEmitter = new EventEmitter<Uri | undefined>();

    private readonly configService: IConfigurationService;

    private readonly interpreterPathService: IInterpreterPathService;

    private readonly experimentsManager: IExperimentService;

    private readonly didChangeInterpreterEmitter = new EventEmitter<void>();

    private readonly didChangeInterpreterInformation = new EventEmitter<PythonEnvironment>();

    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IComponentAdapter) private readonly pyenvs: IComponentAdapter,
    ) {
        this.configService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        this.interpreterPathService = this.serviceContainer.get<IInterpreterPathService>(IInterpreterPathService);
        this.experimentsManager = this.serviceContainer.get<IExperimentService>(IExperimentService);
        this.onDidChangeInterpreters = pyenvs.onChanged;
    }

    public async refresh(resource?: Uri): Promise<void> {
        const interpreterDisplay = this.serviceContainer.get<IInterpreterDisplay>(IInterpreterDisplay);
        return interpreterDisplay.refresh(resource);
    }

    public initialize(): void {
        const disposables = this.serviceContainer.get<Disposable[]>(IDisposableRegistry);
        const documentManager = this.serviceContainer.get<IDocumentManager>(IDocumentManager);
        disposables.push(
            documentManager.onDidChangeActiveTextEditor((e) =>
                e && e.document ? this.refresh(e.document.uri) : undefined,
            ),
        );
        const workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        const pySettings = this.configService.getSettings();
        this._pythonPathSetting = pySettings.pythonPath;
        if (this.experimentsManager.inExperimentSync(DeprecatePythonPath.experiment)) {
            disposables.push(
                this.interpreterPathService.onDidChange((i) => {
                    this._onConfigChanged(i.uri);
                }),
            );
        } else {
            const workspacesUris: (Uri | undefined)[] = workspaceService.hasWorkspaceFolders
                ? workspaceService.workspaceFolders!.map((workspace) => workspace.uri)
                : [undefined];
            const disposable = workspaceService.onDidChangeConfiguration((e) => {
                const workspaceUriIndex = workspacesUris.findIndex((uri) =>
                    e.affectsConfiguration('python.pythonPath', uri),
                );
                const workspaceUri = workspaceUriIndex === -1 ? undefined : workspacesUris[workspaceUriIndex];
                this._onConfigChanged(workspaceUri);
            });
            disposables.push(disposable);
        }
    }

    public getInterpreters(resource?: Uri): PythonEnvironment[] {
        return this.pyenvs.getInterpreters(resource);
    }

    public async getAllInterpreters(resource?: Uri): Promise<PythonEnvironment[]> {
        await this.refreshPromise;
        return this.getInterpreters(resource);
    }

    public dispose(): void {
        this.didChangeInterpreterEmitter.dispose();
        this.didChangeInterpreterInformation.dispose();
    }

    public async getActiveInterpreter(resource?: Uri): Promise<PythonEnvironment | undefined> {
        // During shutdown we might not be able to get items out of the service container.
        const pythonExecutionFactory = this.serviceContainer.tryGet<IPythonExecutionFactory>(IPythonExecutionFactory);
        const pythonExecutionService = pythonExecutionFactory
            ? await pythonExecutionFactory.create({ resource })
            : undefined;
        const fullyQualifiedPath = pythonExecutionService
            ? await pythonExecutionService.getExecutablePath().catch(() => undefined)
            : undefined;
        // Python path is invalid or python isn't installed.
        if (!fullyQualifiedPath) {
            return undefined;
        }

        return this.getInterpreterDetails(fullyQualifiedPath);
    }

    public async getInterpreterDetails(pythonPath: string): Promise<StoredPythonEnvironment | undefined> {
        return this.pyenvs.getInterpreterDetails(pythonPath);
    }

    public _onConfigChanged = (resource?: Uri): void => {
        this.didChangeInterpreterConfigurationEmitter.fire(resource);
        // Check if we actually changed our python path
        const pySettings = this.configService.getSettings(resource);
        if (this._pythonPathSetting === '' || this._pythonPathSetting !== pySettings.pythonPath) {
            this._pythonPathSetting = pySettings.pythonPath;
            this.didChangeInterpreterEmitter.fire();
            const interpreterDisplay = this.serviceContainer.get<IInterpreterDisplay>(IInterpreterDisplay);
            interpreterDisplay.refresh().catch((ex) => traceError('Python Extension: display.refresh', ex));
        }
    };
}
