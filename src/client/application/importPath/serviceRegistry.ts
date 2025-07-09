import { IServiceManager } from '../../ioc/types';
import { IExtensionSingleActivationService } from '../../activation/types';
import { CopyImportPathCommand } from './copyImportPathCommand';

export function registerTypes(serviceManager: IServiceManager): void {
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        CopyImportPathCommand,
    );
}
