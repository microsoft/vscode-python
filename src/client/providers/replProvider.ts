import { Disposable } from 'vscode';
import { IActiveResourceService, ICommandManager } from '../common/application/types';
import { Commands } from '../common/constants';
import { IServiceContainer } from '../ioc/types';
import { captureTelemetry } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { ICodeExecutionService } from '../terminals/types';

export class ReplProvider implements Disposable {
    private readonly disposables: Disposable[] = [];
    private activeResourceService: IActiveResourceService;
    constructor(private serviceContainer: IServiceContainer) {
        this.activeResourceService = this.serviceContainer.get<IActiveResourceService>(IActiveResourceService);
        this.registerCommand();
    }
    public dispose() {
        this.disposables.forEach((disposable) => disposable.dispose());
    }
    private registerCommand() {
        const commandManager = this.serviceContainer.get<ICommandManager>(ICommandManager);
        const disposable = commandManager.registerCommand(Commands.Start_REPL, this.commandHandler, this);
        this.disposables.push(disposable);
    }
    @captureTelemetry(EventName.REPL)
    private async commandHandler() {
        const resource = this.activeResourceService.getActiveResource();
        const replProvider = this.serviceContainer.get<ICodeExecutionService>(ICodeExecutionService, 'repl');
        await replProvider.initializeRepl(resource);
    }
}
