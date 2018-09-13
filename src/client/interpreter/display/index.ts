import { inject, injectable } from 'inversify';
import { Disposable, StatusBarAlignment, StatusBarItem, Uri } from 'vscode';
import { IApplicationShell, IWorkspaceService } from '../../common/application/types';
import { IDisposableRegistry, IPathUtils } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { IInterpreterDisplay, IInterpreterHelper, IInterpreterService } from '../contracts';

// tslint:disable-next-line:completed-docs
@injectable()
export class InterpreterDisplay implements IInterpreterDisplay {
    private readonly statusBar: StatusBarItem;
    private readonly helper: IInterpreterHelper;
    private readonly workspaceService: IWorkspaceService;
    private readonly pathUtils: IPathUtils;
    private readonly interpreterService: IInterpreterService;

    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        this.helper = serviceContainer.get<IInterpreterHelper>(IInterpreterHelper);
        this.workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        this.pathUtils = serviceContainer.get<IPathUtils>(IPathUtils);
        this.interpreterService = serviceContainer.get<IInterpreterService>(IInterpreterService);

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
        const interpreter = await this.interpreterService.getActiveInterpreter(workspaceFolder);
        if (interpreter) {
            this.statusBar.color = '';
            this.statusBar.tooltip = this.pathUtils.getDisplayName(interpreter.path, workspaceFolder ? workspaceFolder.fsPath : undefined);
            this.statusBar.text = interpreter.displayName!;
        } else {
            this.statusBar.tooltip = '';
            this.statusBar.color = 'yellow';
            this.statusBar.text = '$(alert) Select Python Environment';
        }
        this.statusBar.show();
    }
}
