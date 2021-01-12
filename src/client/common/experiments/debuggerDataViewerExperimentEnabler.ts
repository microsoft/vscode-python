import { inject, injectable } from 'inversify';
import { IExtensionSingleActivationService } from '../../activation/types';
import { ICommandManager } from '../application/types';
import { ContextKey } from '../contextKey';
import { traceError } from '../logger';
import { IExperimentService } from '../types';

@injectable()
export class DebuggerDataViewerExperimentEnabler implements IExtensionSingleActivationService {
    constructor(
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IExperimentService) private readonly experimentService: IExperimentService,
    ) {}

    public async activate(): Promise<void> {
        this.activateInternal().catch(traceError.bind('Failed to activate debuggerDataViewerExperimentEnabler'));
    }

    private async activateInternal(): Promise<void> {
        // This context key controls the visibility of the 'View Variable in Data Viewer'
        // context menu item from the variable window context menu during a debugging session
        const isDataViewerExperimentEnabled = new ContextKey(
            'python.isDebuggerDataViewerExperimentEnabled',
            this.commandManager,
        );
        await isDataViewerExperimentEnabled.set(await this.experimentService.inExperiment('debuggerDataViewer'));
    }
}
