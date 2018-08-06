import { inject, injectable } from 'inversify';
import * as _ from 'lodash';
import { Disposable, Uri } from 'vscode';
import { IPlatformService } from '../../common/platform/types';
import { IDisposableRegistry } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import {
    CONDA_ENV_FILE_SERVICE,
    CONDA_ENV_SERVICE,
    CURRENT_PATH_SERVICE,
    GLOBAL_VIRTUAL_ENV_SERVICE,
    IInterpreterLocatorHelper,
    IInterpreterLocatorService,
    KNOWN_PATH_SERVICE,
    PIPENV_SERVICE,
    PythonInterpreter,
    WINDOWS_REGISTRY_SERVICE,
    WORKSPACE_VIRTUAL_ENV_SERVICE
} from '../contracts';

@injectable()
export class PythonInterpreterLocatorService implements IInterpreterLocatorService {
    private readonly disposables: Disposable[] = [];
    private readonly platform: IPlatformService;
    private readonly interpreterLocatorHelper: IInterpreterLocatorHelper;

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        serviceContainer.get<Disposable[]>(IDisposableRegistry).push(this);
        this.platform = serviceContainer.get<IPlatformService>(IPlatformService);
        this.interpreterLocatorHelper = serviceContainer.get<IInterpreterLocatorHelper>(IInterpreterLocatorHelper);
    }
    public async getInterpreters(resource?: Uri): Promise<PythonInterpreter[]> {
        return this.getInterpretersPerResource(resource);
    }
    public dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
    }
    private async getInterpretersPerResource(resource?: Uri): Promise<PythonInterpreter[]> {
        const locators = this.getLocators();
        const promises = locators.map(async provider => provider.getInterpreters(resource));
        const listOfInterpreters = await Promise.all(promises);

        const items = _.flatten(listOfInterpreters)
            .filter(item => !!item)
            .map(item => item!);
        return this.interpreterLocatorHelper.mergeInterpreters(items);
    }
    private getLocators(): IInterpreterLocatorService[] {
        const locators: IInterpreterLocatorService[] = [];
        // The order of the services is important.
        // The order is important because the data sources at the bottom of the list do not contain all,
        //  the information about the interpreters (e.g. type, environment name, etc).
        // This way, the items returned from the top of the list will win, when we combine the items returned.
        if (this.platform.isWindows) {
            locators.push(this.serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, WINDOWS_REGISTRY_SERVICE));
        }
        locators.push(this.serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, CONDA_ENV_SERVICE));
        locators.push(this.serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, CONDA_ENV_FILE_SERVICE));
        locators.push(this.serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, PIPENV_SERVICE));
        locators.push(this.serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, GLOBAL_VIRTUAL_ENV_SERVICE));
        locators.push(this.serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, WORKSPACE_VIRTUAL_ENV_SERVICE));

        if (!this.platform.isWindows) {
            locators.push(this.serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, KNOWN_PATH_SERVICE));
        }
        locators.push(this.serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, CURRENT_PATH_SERVICE));

        return locators;
    }
}
