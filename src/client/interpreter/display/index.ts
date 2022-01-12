import { inject, injectable } from 'inversify';
import { Disposable, LanguageStatusItem, LanguageStatusSeverity, StatusBarAlignment, StatusBarItem, Uri } from 'vscode';
import { IExtensionSingleActivationService } from '../../activation/types';
import { IApplicationShell, IWorkspaceService } from '../../common/application/types';
import { Commands, PYTHON_LANGUAGE } from '../../common/constants';
import { InterpreterStatusBarPosition } from '../../common/experiments/groups';
import '../../common/extensions';
import { IDisposableRegistry, IExperimentService, IPathUtils, Resource } from '../../common/types';
import { InterpreterQuickPickList, Interpreters } from '../../common/utils/localize';
import { IServiceContainer } from '../../ioc/types';
import { traceLog } from '../../logging';
import { PythonEnvironment } from '../../pythonEnvironments/info';
import {
    IInterpreterDisplay,
    IInterpreterHelper,
    IInterpreterService,
    IInterpreterStatusbarVisibilityFilter,
} from '../contracts';

/**
 * Based on https://github.com/microsoft/vscode-python/issues/18040#issuecomment-992567670.
 * This is to ensure the item appears right after the Python language status item.
 */
const STATUS_BAR_ITEM_PRIORITY = 100.09999;
@injectable()
export class InterpreterDisplay implements IInterpreterDisplay, IExtensionSingleActivationService {
    public supportedWorkspaceTypes: { untrustedWorkspace: boolean; virtualWorkspace: boolean } = {
        untrustedWorkspace: false,
        virtualWorkspace: true,
    };
    private statusBar: StatusBarItem | undefined;
    private languageStatus: LanguageStatusItem | undefined;
    private readonly helper: IInterpreterHelper;
    private readonly workspaceService: IWorkspaceService;
    private readonly pathUtils: IPathUtils;
    private readonly interpreterService: IInterpreterService;
    private currentlySelectedInterpreterPath?: string;
    private currentlySelectedWorkspaceFolder: Resource;
    private interpreterPath: string | undefined;
    private statusBarCanBeDisplayed?: boolean;
    private visibilityFilters: IInterpreterStatusbarVisibilityFilter[] = [];
    private disposableRegistry: Disposable[];
    private experiments: IExperimentService;

    constructor(@inject(IServiceContainer) private readonly serviceContainer: IServiceContainer) {
        this.helper = serviceContainer.get<IInterpreterHelper>(IInterpreterHelper);
        this.workspaceService = serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        this.pathUtils = serviceContainer.get<IPathUtils>(IPathUtils);
        this.interpreterService = serviceContainer.get<IInterpreterService>(IInterpreterService);

        this.disposableRegistry = serviceContainer.get<Disposable[]>(IDisposableRegistry);

        this.interpreterService.onDidChangeInterpreterInformation(
            this.onDidChangeInterpreterInformation,
            this,
            this.disposableRegistry,
        );
        this.experiments = this.serviceContainer.get<IExperimentService>(IExperimentService);
    }

    public async activate(): Promise<void> {
        const application = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
        if (this.experiments.inExperimentSync(InterpreterStatusBarPosition.Unpinned)) {
            this.languageStatus = application.createLanguageStatusItem('python.selectedInterpreter', {
                language: PYTHON_LANGUAGE,
            });
            this.languageStatus.severity = LanguageStatusSeverity.Information;
            this.languageStatus.command = {
                title: InterpreterQuickPickList.browsePath.openButtonLabel(),
                command: Commands.Set_Interpreter,
            };
            this.disposableRegistry.push(this.languageStatus);
        } else {
            let [alignment, priority] = [StatusBarAlignment.Left, 100];
            if (this.experiments.inExperimentSync(InterpreterStatusBarPosition.Pinned)) {
                [alignment, priority] = [StatusBarAlignment.Right, STATUS_BAR_ITEM_PRIORITY];
            }
            this.statusBar = application.createStatusBarItem(alignment, priority);
            this.statusBar.command = Commands.Set_Interpreter;
            this.disposableRegistry.push(this.statusBar);
        }
    }

    public async refresh(resource?: Uri) {
        // Use the workspace Uri if available
        if (resource && this.workspaceService.getWorkspaceFolder(resource)) {
            resource = this.workspaceService.getWorkspaceFolder(resource)!.uri;
        }
        if (!resource) {
            const wkspc = this.helper.getActiveWorkspaceUri(resource);
            resource = wkspc ? wkspc.folderUri : undefined;
        }
        await this.updateDisplay(resource);
    }
    public registerVisibilityFilter(filter: IInterpreterStatusbarVisibilityFilter) {
        const disposableRegistry = this.serviceContainer.get<Disposable[]>(IDisposableRegistry);
        this.visibilityFilters.push(filter);
        if (filter.changed) {
            filter.changed(this.updateVisibility, this, disposableRegistry);
        }
    }
    private onDidChangeInterpreterInformation(info: PythonEnvironment) {
        if (!this.currentlySelectedInterpreterPath || this.currentlySelectedInterpreterPath === info.path) {
            this.updateDisplay(this.currentlySelectedWorkspaceFolder).ignoreErrors();
        }
    }
    private async updateDisplay(workspaceFolder?: Uri) {
        const interpreter = await this.interpreterService.getActiveInterpreter(workspaceFolder);
        this.currentlySelectedWorkspaceFolder = workspaceFolder;
        if (this.statusBar) {
            if (interpreter) {
                this.statusBar.color = '';
                this.statusBar.tooltip = this.pathUtils.getDisplayName(interpreter.path, workspaceFolder?.fsPath);
                if (this.interpreterPath !== interpreter.path) {
                    traceLog(
                        Interpreters.pythonInterpreterPath().format(
                            this.pathUtils.getDisplayName(interpreter.path, workspaceFolder?.fsPath),
                        ),
                    );
                    this.interpreterPath = interpreter.path;
                }
                let text = interpreter.displayName!;
                if (this.experiments.inExperimentSync(InterpreterStatusBarPosition.Pinned)) {
                    text = text.startsWith('Python') ? text.substring('Python'.length).trim() : text;
                }
                this.statusBar.text = text;
                this.currentlySelectedInterpreterPath = interpreter.path;
            } else {
                this.statusBar.tooltip = '';
                this.statusBar.color = '';
                this.statusBar.text = '$(alert) Select Python Interpreter';
                this.currentlySelectedInterpreterPath = undefined;
            }
        } else if (this.languageStatus) {
            if (interpreter) {
                this.languageStatus.detail = this.pathUtils.getDisplayName(interpreter.path, workspaceFolder?.fsPath);
                if (this.interpreterPath !== interpreter.path) {
                    traceLog(
                        Interpreters.pythonInterpreterPath().format(
                            this.pathUtils.getDisplayName(interpreter.path, workspaceFolder?.fsPath),
                        ),
                    );
                    this.interpreterPath = interpreter.path;
                }
                let text = interpreter.displayName!;
                text = text.startsWith('Python') ? text.substring('Python'.length).trim() : text;
                this.languageStatus.text = text;
                this.currentlySelectedInterpreterPath = interpreter.path;
            } else {
                this.languageStatus.text = '$(alert) No Interpreter Selected';
                this.languageStatus.detail = undefined;
                this.currentlySelectedInterpreterPath = undefined;
            }
        }
        this.statusBarCanBeDisplayed = true;
        this.updateVisibility();
    }
    private updateVisibility() {
        if (!this.statusBar || !this.statusBarCanBeDisplayed) {
            return;
        }
        if (this.visibilityFilters.length === 0 || this.visibilityFilters.every((filter) => !filter.hidden)) {
            this.statusBar.show();
        } else {
            this.statusBar.hide();
        }
    }
}
