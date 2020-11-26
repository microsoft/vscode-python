// tslint:disable-next-line: no-single-line-block-comment
/* eslint-disable max-classes-per-file */
import { inject, injectable } from 'inversify';
import { flatten } from 'lodash';
import {
    Disposable, Event, EventEmitter, Uri,
} from 'vscode';
import { traceDecorators } from '../../../common/logger';
import { IPlatformService } from '../../../common/platform/types';
import { IDisposableRegistry } from '../../../common/types';
import { createDeferred, Deferred } from '../../../common/utils/async';
import { getURIFilter } from '../../../common/utils/misc';
import { OSType } from '../../../common/utils/platform';
import {
    CONDA_ENV_FILE_SERVICE,
    CONDA_ENV_SERVICE,
    CURRENT_PATH_SERVICE,
    GLOBAL_VIRTUAL_ENV_SERVICE,
    IComponentAdapter,
    IInterpreterLocatorHelper,
    IInterpreterLocatorService,
    KNOWN_PATH_SERVICE,
    PIPENV_SERVICE,
    WINDOWS_REGISTRY_SERVICE,
    WORKSPACE_VIRTUAL_ENV_SERVICE,
} from '../../../interpreter/contracts';
import { IServiceContainer } from '../../../ioc/types';
import { DisableableLocator } from '../../base/disableableLocator';
import { PythonEnvInfo } from '../../base/info';
import {
    IDisposableLocator,
    IPythonEnvsIterator,
    Locator,
    NOOP_ITERATOR,
    PythonLocatorQuery,
} from '../../base/locator';
import {
    combineIterators,
    Locators,
} from '../../base/locators';
import { PythonEnvironment } from '../../info';
import { isHiddenInterpreter } from './services/interpreterFilter';
import { GetInterpreterLocatorOptions } from './types';

/**
 * A wrapper around all locators used by the extension.
 */
export class ExtensionLocators extends Locators {
    constructor(
        // These are expected to be low-level locators (e.g. system).
        nonWorkspace: IDisposableLocator[],
        // This is expected to be a locator wrapping any found in
        // the workspace (i.e. WorkspaceLocators).
        workspace: IDisposableLocator,
    ) {
        super([...nonWorkspace, workspace]);
    }
}

type WorkspaceLocatorFactory = (root: Uri) => IDisposableLocator[];

interface IWorkspaceFolders {
    readonly roots: ReadonlyArray<Uri>;
    readonly onAdded: Event<Uri>;
    readonly onRemoved: Event<Uri>;
}

type RootURI = string;

/**
 * The collection of all workspace-specific locators used by the extension.
 *
 * The factories are used to produce the locators for each workspace folder.
 */
export class WorkspaceLocators extends Locator {
    private readonly locators: Record<RootURI, DisableableLocator> = {};

    private readonly roots: Record<RootURI, Uri> = {};

    constructor(
        // used to produce the per-root locators:
        private readonly factories: WorkspaceLocatorFactory[],
    ) {
        super();
    }

    /**
     * Activate the locator.
     *
     * @param folders - the info used to keep track of the workspace folders
     */
    public activate(folders: IWorkspaceFolders):void {
        folders.roots.forEach((root) => {
            this.addRoot(root);
        });
        folders.onAdded((root: Uri) => this.addRoot(root));
        folders.onRemoved((root: Uri) => this.removeRoot(root));
    }

    public iterEnvs(query?: PythonLocatorQuery): IPythonEnvsIterator {
        if (query?.searchLocations === null) {
            // Workspace envs all have searchLocation, so there's nothing to do.
            return NOOP_ITERATOR;
        }
        const iterators = Object.keys(this.locators).map((key) => {
            if (query?.searchLocations !== undefined) {
                const root = this.roots[key];
                // Match any related search location.
                const filter = getURIFilter(root, { checkParent: true, checkChild: true, checkExact: true });
                // Ignore any requests for global envs.
                if (!query.searchLocations.roots.some(filter)) {
                    // This workspace folder did not match the query, so skip it!
                    return NOOP_ITERATOR;
                }
            }
            // The query matches or was not location-specific.
            const locator = this.locators[key];
            return locator.iterEnvs(query);
        });
        return combineIterators(iterators);
    }

    public async resolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        if (typeof env !== 'string' && env.searchLocation) {
            const rootLocator = this.locators[env.searchLocation.toString()];
            if (rootLocator) {
                return rootLocator.resolveEnv(env);
            }
        }
        // Fall back to checking all the roots.
        // The eslint disable below should be removed after we have a
        // better solution for these. We need asyncFind for this.
        for (const key of Object.keys(this.locators)) {
            // eslint-disable-next-line no-await-in-loop
            const resolved = await this.locators[key].resolveEnv(env);
            if (resolved !== undefined) {
                return resolved;
            }
        }
        return undefined;
    }

    private addRoot(root: Uri) {
        // Drop the old one, if necessary.
        this.removeRoot(root);
        // Create the root's locator, wrapping each factory-generated locator.
        const locators: IDisposableLocator[] = [];
        this.factories.forEach((create) => {
            locators.push(...create(root));
        });
        const locator = new DisableableLocator(new Locators(locators));
        // Cache it.
        const key = root.toString();
        this.locators[key] = locator;
        this.roots[key] = root;
        this.emitter.fire({ searchLocation: root });
        // Hook up the watchers.
        locator.onChanged((e) => {
            if (e.searchLocation === undefined) {
                e.searchLocation = root;
            }
            this.emitter.fire(e);
        });
    }

    private removeRoot(root: Uri) {
        const key = root.toString();
        const locator = this.locators[key];
        if (locator === undefined) {
            return;
        }
        delete this.locators[key];
        delete this.roots[key];
        locator.disable();
        this.emitter.fire({ searchLocation: root });
    }
}

// The parts of IComponentAdapter used here.
interface IComponent {
    hasInterpreters: Promise<boolean | undefined>;
    getInterpreters(resource?: Uri, options?: GetInterpreterLocatorOptions): Promise<PythonEnvironment[] | undefined>;
}

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

    private readonly onLocatingEmitter:EventEmitter<Promise<PythonEnvironment[]>> =
        new EventEmitter<Promise<PythonEnvironment[]>>();

    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IComponentAdapter) private readonly pyenvs: IComponent,
    ) {
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
        return this.pyenvs.hasInterpreters.then((res) => {
            if (res !== undefined) {
                return res;
            }
            return this._hasInterpreters.completed ? this._hasInterpreters.promise : Promise.resolve(false);
        });
    }

    /**
     * Release any held resources.
     *
     * Called by VS Code to indicate it is done with the resource.
     */
    public dispose():void {
        this.disposables.forEach((disposable) => disposable.dispose());
    }

    /**
     * Return the list of known Python interpreters.
     *
     * The optional resource arg may control where locators look for
     * interpreters.
     */
    @traceDecorators.verbose('Get Interpreters')
    public async getInterpreters(resource?: Uri, options?: GetInterpreterLocatorOptions): Promise<PythonEnvironment[]> {
        const envs = await this.pyenvs.getInterpreters(resource, options);
        if (envs !== undefined) {
            return envs;
        }
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
            .map((item) => item!)
            .filter((item) => !isHiddenInterpreter(item));
        this._hasInterpreters.resolve(items.length > 0);
        return this.interpreterLocatorHelper.mergeInterpreters(items);
    }

    /**
     * Return the list of applicable interpreter locators.
     *
     * The locators are pulled from the registry.
     */
    private getLocators(options?: GetInterpreterLocatorOptions): IInterpreterLocatorService[] {
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
