// eslint-disable-next-line max-classes-per-file
import { inject, injectable } from 'inversify';
import * as pathUtils from 'path';
import { Disposable, Event, EventEmitter, Uri } from 'vscode';
import '../common/extensions';
import { IDocumentManager } from '../common/application/types';
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
    IInterpreterStatusbarVisibilityFilter,
    PythonEnvironmentsChangedEvent,
} from './contracts';
import { PythonLocatorQuery } from '../pythonEnvironments/base/locator';
import { traceError } from '../logging';
import { PYTHON_LANGUAGE } from '../common/constants';
import { InterpreterStatusBarPosition } from '../common/experiments/groups';
import { reportActiveInterpreterChanged } from '../proposedApi';
import { IPythonExecutionFactory } from '../common/process/types';

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

    private readonly didChangeInterpreterEmitter = new EventEmitter<void>();

    private readonly didChangeInterpreterInformation = new EventEmitter<PythonEnvironment>();

    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IComponentAdapter) private readonly pyenvs: IComponentAdapter,
    ) {
        this.configService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        this.interpreterPathService = this.serviceContainer.get<IInterpreterPathService>(IInterpreterPathService);
        this.onDidChangeInterpreters = pyenvs.onChanged;
    }

    public async refresh(resource?: Uri): Promise<void> {
        const interpreterDisplay = this.serviceContainer.get<IInterpreterDisplay>(IInterpreterDisplay);
        return interpreterDisplay.refresh(resource);
    }

    public initialize(): void {
        const disposables = this.serviceContainer.get<Disposable[]>(IDisposableRegistry);
        const documentManager = this.serviceContainer.get<IDocumentManager>(IDocumentManager);
        const interpreterDisplay = this.serviceContainer.get<IInterpreterDisplay>(IInterpreterDisplay);
        const filter = new (class implements IInterpreterStatusbarVisibilityFilter {
            constructor(private readonly docManager: IDocumentManager) {}

            public readonly interpreterVisibilityEmitter = new EventEmitter<void>();

            public readonly changed = this.interpreterVisibilityEmitter.event;

            get hidden() {
                return this.docManager.activeTextEditor?.document.languageId !== PYTHON_LANGUAGE;
            }
        })(documentManager);
        const experiments = this.serviceContainer.get<IExperimentService>(IExperimentService);
        if (experiments.inExperimentSync(InterpreterStatusBarPosition.Pinned)) {
            interpreterDisplay.registerVisibilityFilter(filter);
        }
        disposables.push(
            this.onDidChangeInterpreters((e): void => {
                const interpreter = e.old ?? e.new;
                if (interpreter) {
                    this.didChangeInterpreterInformation.fire(interpreter);
                }
            }),
        );
        disposables.push(
            documentManager.onDidOpenTextDocument(() => {
                // To handle scenario when language mode is set to "python"
                filter.interpreterVisibilityEmitter.fire();
            }),
            documentManager.onDidChangeActiveTextEditor((e): void => {
                filter.interpreterVisibilityEmitter.fire();
                if (e && e.document) {
                    this.refresh(e.document.uri);
                }
            }),
        );
        const pySettings = this.configService.getSettings();
        this._pythonPathSetting = pySettings.pythonPath;
        disposables.push(
            this.interpreterPathService.onDidChange((i): void => {
                this._onConfigChanged(i.uri);
            }),
        );
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
        let path = this.configService.getSettings(resource).pythonPath;
        if (pathUtils.basename(path) === path) {
            // Value can be `python`, `python3`, `python3.9` etc.
            // During shutdown we might not be able to get items out of the service container.
            const pythonExecutionFactory = this.serviceContainer.tryGet<IPythonExecutionFactory>(
                IPythonExecutionFactory,
            );
            const pythonExecutionService = pythonExecutionFactory
                ? await pythonExecutionFactory.create({ resource })
                : undefined;
            const fullyQualifiedPath = pythonExecutionService
                ? await pythonExecutionService.getExecutablePath().catch((ex) => {
                      traceError(ex);
                  })
                : undefined;
            // Python path is invalid or python isn't installed.
            if (!fullyQualifiedPath) {
                return undefined;
            }
            path = fullyQualifiedPath;
        }
        return this.getInterpreterDetails(path);
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
            reportActiveInterpreterChanged({
                interpreterPath: pySettings.pythonPath === '' ? undefined : pySettings.pythonPath,
                resource,
            });
            const interpreterDisplay = this.serviceContainer.get<IInterpreterDisplay>(IInterpreterDisplay);
            interpreterDisplay.refresh().catch((ex) => traceError('Python Extension: display.refresh', ex));
        }
    };
}
