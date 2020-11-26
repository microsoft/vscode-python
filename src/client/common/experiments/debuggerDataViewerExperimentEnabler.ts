import { inject, injectable } from 'inversify';
import { IExtensionSingleActivationService } from '../../activation/types';
import { ICommandManager } from '../../common/application/types';
import { ContextKey } from '../../common/contextKey';
import { traceError } from '../../common/logger';
import { IExperimentService } from '../../common/types';

@injectable()
export class DebuggerDataViewerExperimentEnabler implements IExtensionSingleActivationService {
    constructor(
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IExperimentService) private readonly experimentService: IExperimentService
    ) {}
    public async activate() {
        this.activateInternal().catch(traceError.bind('Failed to activate debuggerDataViewerExperimentEnabler'));
    }
    private async activateInternal() {
        // This context key controls the visibility of the 'View Variable in Data Viewer'
        // context menu item from the variable window context menu during a debugging session
        const isDataViewerExperimentEnabled = new ContextKey(
            'python.isDebuggerDataViewerExperimentEnabled',
            this.commandManager
        );
        await isDataViewerExperimentEnabled.set(await this.experimentService.inExperiment('debuggerDataViewer'));
    }
}
