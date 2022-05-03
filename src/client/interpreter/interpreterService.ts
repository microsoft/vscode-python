// eslint-disable-next-line max-classes-per-file
import { inject, injectable } from 'inversify';
import * as pathUtils from 'path';
import { Disposable, Event, EventEmitter, ProgressLocation, ProgressOptions, Uri } from 'vscode';
import '../common/extensions';
import { IApplicationShell, IDocumentManager } from '../common/application/types';
import {
    IConfigurationService,
    IDisposableRegistry,
    IInstaller,
    IInterpreterPathService,
    Product,
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
import { traceError, traceLog } from '../logging';
import { Commands, PYTHON_LANGUAGE } from '../common/constants';
import { reportActiveInterpreterChanged } from '../proposedApi';
import { IPythonExecutionFactory } from '../common/process/types';
import { Interpreters } from '../common/utils/localize';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { cache } from '../common/utils/decorators';

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

    public triggerRefresh(query?: PythonLocatorQuery & { clearCache?: boolean }): Promise<void> {
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

    public _pythonPathSetting: string | undefined = '';

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
        await interpreterDisplay.refresh(resource);
        this.ensureEnvironmentContainsPython(this.configService.getSettings(resource).pythonPath).ignoreErrors();
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
                const document = this.docManager.activeTextEditor?.document;
                if (document?.fileName.endsWith('settings.json')) {
                    return false;
                }
                return document?.languageId !== PYTHON_LANGUAGE;
            }
        })(documentManager);
        interpreterDisplay.registerVisibilityFilter(filter);
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
        disposables.push(this.interpreterPathService.onDidChange((i) => this._onConfigChanged(i.uri)));
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
            // Note the following triggers autoselection if no interpreter is explictly
            // selected, i.e the value is `python`.
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

    public async _onConfigChanged(resource?: Uri): Promise<void> {
        this.didChangeInterpreterConfigurationEmitter.fire(resource);
        // Check if we actually changed our python path
        const pySettings = this.configService.getSettings(resource);
        if (this._pythonPathSetting === '' || this._pythonPathSetting !== pySettings.pythonPath) {
            this._pythonPathSetting = pySettings.pythonPath;
            this.didChangeInterpreterEmitter.fire();
            reportActiveInterpreterChanged({
                path: pySettings.pythonPath,
                resource,
            });
            const interpreterDisplay = this.serviceContainer.get<IInterpreterDisplay>(IInterpreterDisplay);
            interpreterDisplay.refresh().catch((ex) => traceError('Python Extension: display.refresh', ex));
            await this.ensureEnvironmentContainsPython(this._pythonPathSetting);
        }
    }

    @cache(-1, true)
    private async ensureEnvironmentContainsPython(pythonPath: string) {
        const installer = this.serviceContainer.get<IInstaller>(IInstaller);
        if (!(await installer.isInstalled(Product.python))) {
            // If Python is not installed into the environment, install it.
            sendTelemetryEvent(EventName.ENVIRONMENT_WITHOUT_PYTHON_SELECTED);
            const shell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
            const progressOptions: ProgressOptions = {
                location: ProgressLocation.Window,
                title: `[${Interpreters.installingPython()}](command:${Commands.ViewOutput})`,
            };
            traceLog('Conda envs without Python are known to not work well; fixing conda environment...');
            const promise = installer.install(Product.python, await this.getInterpreterDetails(pythonPath));
            shell.withProgress(progressOptions, () => promise);
            promise.then(() => this.triggerRefresh({ clearCache: true }).ignoreErrors());
        }
    }
}
