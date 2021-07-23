/* eslint-disable max-classes-per-file */

import { inject, injectable } from 'inversify';
import { flatten } from 'lodash';
import { Disposable, Event, EventEmitter, Uri } from 'vscode';
import { traceDecorators } from '../../../common/logger';
import { IPlatformService } from '../../../common/platform/types';
import { IDisposableRegistry } from '../../../common/types';
import { createDeferred, Deferred } from '../../../common/utils/async';
import { OSType } from '../../../common/utils/platform';
import {
    CONDA_ENV_FILE_SERVICE,
    CONDA_ENV_SERVICE,
    CURRENT_PATH_SERVICE,
    GetInterpreterOptions,
    GLOBAL_VIRTUAL_ENV_SERVICE,
    IInterpreterLocatorHelper,
    IInterpreterLocatorService,
    KNOWN_PATH_SERVICE,
    PIPENV_SERVICE,
    WINDOWS_REGISTRY_SERVICE,
    WORKSPACE_VIRTUAL_ENV_SERVICE,
} from '../../../interpreter/contracts';
import { IServiceContainer } from '../../../ioc/types';
import { PythonEnvironment } from '../../info';
import { isHiddenInterpreter } from './services/interpreterFilter';

/**
 * Facilitates locating Python interpreters.
 */
@injectable()
export class PythonInterpreterLocatorService implements IInterpreterLocatorService {
    public didTriggerInterpreterSuggestions: boolean;

    private readonly disposables: Disposable[] = [];

    private readonly platform: IPlatformService;

    private readonly interpreterLocatorHelper: IInterpreterLocatorHelper;

    private readonly _hasInterpreters: Deferred<boolean>;

    private readonly onLocatingEmitter: EventEmitter<Promise<PythonEnvironment[]>> = new EventEmitter<
        Promise<PythonEnvironment[]>
    >();

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this._hasInterpreters = createDeferred<boolean>();
        serviceContainer.get<Disposable[]>(IDisposableRegistry).push(this);
        this.platform = serviceContainer.get<IPlatformService>(IPlatformService);
        this.interpreterLocatorHelper = serviceContainer.get<IInterpreterLocatorHelper>(IInterpreterLocatorHelper);
        this.didTriggerInterpreterSuggestions = false;
    }

    /**
     * This class should never emit events when we're locating.
     * The events will be fired by the individual locators retrieved in `getLocators`.
     *
     * @readonly
     * @type {Event<Promise<PythonEnvironment[]>>}
     * @memberof PythonInterpreterLocatorService
     */
    public get onLocating(): Event<Promise<PythonEnvironment[]>> {
        return this.onLocatingEmitter.event;
    }

    public get hasInterpreters(): Promise<boolean> {
        return this._hasInterpreters.completed ? this._hasInterpreters.promise : Promise.resolve(false);
    }

    /**
     * Release any held resources.
     *
     * Called by VS Code to indicate it is done with the resource.
     */
    public dispose(): void {
        this.disposables.forEach((disposable) => disposable.dispose());
    }

    /**
     * Return the list of known Python interpreters.
     *
     * The optional resource arg may control where locators look for
     * interpreters.
     */
    @traceDecorators.verbose('Get Interpreters')
    public async getInterpreters(resource?: Uri, options?: GetInterpreterOptions): Promise<PythonEnvironment[]> {
        const locators = this.getLocators(options);
        const promises = locators.map(async (provider) => provider.getInterpreters(resource));
        locators.forEach((locator) => {
            locator.hasInterpreters
                .then((found) => {
                    if (found) {
                        this._hasInterpreters.resolve(true);
                    }
                })
                .ignoreErrors();
        });
        const listOfInterpreters = await Promise.all(promises);

        const items = flatten(listOfInterpreters)
            .filter((item) => !!item)
            .filter((item) => !isHiddenInterpreter(item));
        this._hasInterpreters.resolve(items.length > 0);
        return this.interpreterLocatorHelper.mergeInterpreters(items);
    }

    /**
     * Return the list of applicable interpreter locators.
     *
     * The locators are pulled from the registry.
     */
    private getLocators(options?: GetInterpreterOptions): IInterpreterLocatorService[] {
        // The order of the services is important.
        // The order is important because the data sources at the bottom of the list do not contain all,
        //  the information about the interpreters (e.g. type, environment name, etc).
        // This way, the items returned from the top of the list will win, when we combine the items returned.
        const keys: [string, OSType | undefined][] = [
            [WINDOWS_REGISTRY_SERVICE, OSType.Windows],
            [CONDA_ENV_SERVICE, undefined],
            [CONDA_ENV_FILE_SERVICE, undefined],
            [PIPENV_SERVICE, undefined],
            [GLOBAL_VIRTUAL_ENV_SERVICE, undefined],
            [WORKSPACE_VIRTUAL_ENV_SERVICE, undefined],
            [KNOWN_PATH_SERVICE, undefined],
            [CURRENT_PATH_SERVICE, undefined],
        ];

        const locators = keys
            .filter((item) => item[1] === undefined || item[1] === this.platform.osType)
            .map((item) => this.serviceContainer.get<IInterpreterLocatorService>(IInterpreterLocatorService, item[0]));

        // Set it to true the first time the user selects an interpreter
        if (!this.didTriggerInterpreterSuggestions && options?.onSuggestion === true) {
            this.didTriggerInterpreterSuggestions = true;
            locators.forEach((locator) => {
                locator.didTriggerInterpreterSuggestions = true;
            });
        }

        return locators;
    }
}
