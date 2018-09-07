import { inject, injectable } from 'inversify';
import { Disposable, StatusBarAlignment, StatusBarItem, Uri } from 'vscode';
import { IApplicationShell, IWorkspaceService } from '../../common/application/types';
import { IFileSystem } from '../../common/platform/types';
import { IConfigurationService, IDisposableRegistry, IPathUtils } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { IInterpreterDisplay, IInterpreterHelper, IInterpreterService, PythonInterpreter } from '../contracts';
import { IVirtualEnvironmentManager } from '../virtualEnvs/types';

// tslint:disable-next-line:completed-docs
@injectable()
export class InterpreterDisplay implements IInterpreterDisplay {
    private readonly statusBar: StatusBarItem;
    private readonly interpreterService: IInterpreterService;
    private readonly virtualEnvMgr: IVirtualEnvironmentManager;
    private readonly fileSystem: IFileSystem;
    private readonly configurationService: IConfigurationService;
    private readonly helper: IInterpreterHelper;
    private readonly workspaceService: IWorkspaceService;
    private readonly pathUtils: IPathUtils;

    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        this.interpreterService = serviceContainer.get<IInterpreterService>(IInterpreterService);
        this.virtualEnvMgr = serviceContainer.get<IVirtualEnvironmentManager>(IVirtualEnvironmentManager);
        this.fileSystem = serviceContainer.get<IFileSystem>(IFileSystem);
        this.configurationService = serviceContainer.get<IConfigurationService>(IConfigurationService);
        this.helper = serviceContainer.get<IInterpreterHelper>(IInterpreterHelper);
        this.workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        this.pathUtils = serviceContainer.get<IPathUtils>(IPathUtils);

        const application = serviceContainer.get<IApplicationShell>(IApplicationShell);
        const disposableRegistry = serviceContainer.get<Disposable[]>(IDisposableRegistry);

        this.statusBar = application.createStatusBarItem(StatusBarAlignment.Left);
        this.statusBar.command = 'python.setInterpreter';
        disposableRegistry.push(this.statusBar);
    }
    public async refresh(resource?: Uri) {
        // Use the workspace Uri if available
        if (resource && this.workspaceService.getWorkspaceFolder(resource)) {
            resource = this.workspaceService.getWorkspaceFolder(resource)!.uri;
        }
        if (!resource) {
            const wkspc = this.helper.getActiveWorkspaceUri();
            resource = wkspc ? wkspc.folderUri : undefined;
        }
        await this.updateDisplay(resource);
    }
    private async updateDisplay(workspaceFolder?: Uri) {
        const interpreters = await this.interpreterService.getInterpreters(workspaceFolder);
        const interpreter = await this.interpreterService.getActiveInterpreter(workspaceFolder);
        const pythonPath = interpreter ? interpreter.path : this.configurationService.getSettings(workspaceFolder).pythonPath;

        this.statusBar.color = '';
        this.statusBar.tooltip = pythonPath;
        if (interpreter) {
            // tslint:disable-next-line:no-non-null-assertion
            this.statusBar.text = interpreter.displayName!;
            this.statusBar.tooltip = this.pathUtils.getDisplayName(pythonPath, workspaceFolder ? workspaceFolder.fsPath : undefined);
            this.statusBar.show();
            return;
        }

        const [interpreterExists, details, virtualEnvName] = await Promise.all([
            this.fileSystem.fileExists(pythonPath),
            this.helper.getInterpreterInformation(pythonPath).catch<Partial<PythonInterpreter> | undefined>(() => undefined),
            this.getVirtualEnvironmentName(pythonPath, workspaceFolder).catch<string>(() => '')
        ]);
        if (details) {
            const displayName = await this.interpreterService.getDisplayName({ ...details, envName: virtualEnvName });
            this.statusBar.text = displayName;
        }

        if (!interpreterExists && !details && interpreters.length > 0) {
            this.statusBar.color = 'yellow';
            this.statusBar.text = '$(alert) Select Python Environment';
        }
        this.statusBar.show();
    }
    private async getVirtualEnvironmentName(pythonPath: string, resource?: Uri): Promise<string> {
        return this.virtualEnvMgr.getEnvironmentName(pythonPath, resource);
    }
}
