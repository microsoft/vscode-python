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

/**
 * Facilitates locating Python interpreters.
 */
@injectable()
export class PythonInterpreterLocatorService implements IInterpreterLocatorService {
    private readonly disposables: Disposable[] = [];
    private readonly platform: IPlatformService;
    private readonly interpreterLocatorHelper: IInterpreterLocatorHelper;

    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer
    ) {
        serviceContainer.get<Disposable[]>(IDisposableRegistry).push(this);
        this.platform = serviceContainer.get<IPlatformService>(IPlatformService);
        this.interpreterLocatorHelper = serviceContainer.get<IInterpreterLocatorHelper>(IInterpreterLocatorHelper);
    }

    /**
     * Release any held resources.
     *
     * Called by VS Code to indicate it is done with the resource.
     */
    public dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
    }

    /**
     * Return the list of known Python interpreters.
     *
     * The optional resource arg may control where locators look for
     * interpreters.
     */
    public async getInterpreters(resource?: Uri): Promise<PythonInterpreter[]> {
        const locators = this.getLocators();
        const promises = locators.map(async provider => provider.getInterpreters(resource));
        const listOfInterpreters = await Promise.all(promises);

        const items = _.flatten(listOfInterpreters)
            .filter(item => !!item)
            .map(item => item!);
        return this.interpreterLocatorHelper.mergeInterpreters(items);
    }

    /**
     * Return the list of applicable interpreter locators.
     *
     * The locators are pulled from the registry.
     */
    private getLocators(): IInterpreterLocatorService[] {
        // The order of the services is important.
        // The order is important because the data sources at the bottom of the list do not contain all,
        //  the information about the interpreters (e.g. type, environment name, etc).
        // This way, the items returned from the top of the list will win, when we combine the items returned.
        const keys: [string, string][] = [
            [WINDOWS_REGISTRY_SERVICE, 'win'],
            [CONDA_ENV_SERVICE, ''],
            [CONDA_ENV_FILE_SERVICE, ''],
            [PIPENV_SERVICE, ''],
            [GLOBAL_VIRTUAL_ENV_SERVICE, ''],
            [WORKSPACE_VIRTUAL_ENV_SERVICE, ''],
            [KNOWN_PATH_SERVICE, '-win'],
            [CURRENT_PATH_SERVICE, '']
        ];
        return getLocators(keys, this.platform, (key) => {
            return this.serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, key);
        });
    }
}

type PlatformName = string;

function getLocators(
    keys: [string, PlatformName][],
    platform: IPlatformService,
    getService: (string) => IInterpreterLocatorService
): IInterpreterLocatorService[] {
    const locators: IInterpreterLocatorService[] = [];
    for (const [key, platformName] of keys) {
        if (!platform.info.matchPlatform(platformName)) {
            continue;
        }
        const locator = getService(key);
        locators.push(locator);
    }
    return locators;
}
