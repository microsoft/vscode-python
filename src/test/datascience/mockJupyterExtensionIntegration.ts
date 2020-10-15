import { ILanguageServerCache } from '../../client/activation/types';
import { IExtensions, IInstaller } from '../../client/common/types';
import { JupyterExtensionIntegration } from '../../client/datascience/api/jupyterIntegration';
import { IEnvironmentActivationService } from '../../client/interpreter/activation/types';
import { IInterpreterSelector } from '../../client/interpreter/configuration/types';
import { IInterpreterService } from '../../client/interpreter/contracts';
import { IWindowsStoreInterpreter } from '../../client/interpreter/locators/types';

export class MockJupyterExtensionIntegration extends JupyterExtensionIntegration {
    constructor(
        extensions: IExtensions,
        interpreterService: IInterpreterService,
        interpreterSelector: IInterpreterSelector,
        windowsStoreInterpreter: IWindowsStoreInterpreter,
        installer: IInstaller,
        envActivation: IEnvironmentActivationService,
        languageServerCache: ILanguageServerCache
    ) {
        super(
            extensions,
            interpreterService,
            interpreterSelector,
            windowsStoreInterpreter,
            installer,
            envActivation,
            languageServerCache
        );
    }
}
