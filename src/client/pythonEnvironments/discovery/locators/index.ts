/* eslint-disable max-classes-per-file */

import { inject, injectable } from 'inversify';
import { flatten } from 'lodash';
import { Disposable, Event, EventEmitter, Uri } from 'vscode';
import { traceDecorators } from '../../../common/logger';
import { IPlatformService } from '../../../common/platform/types';
import { IDisposableRegistry } from '../../../common/types';
import { createDeferred, Deferred } from '../../../common/utils/async';
import { getURIFilter } from '../../../common/utils/misc';
import { OSType } from '../../../common/utils/platform';
import { Disposables, IDisposable } from '../../../common/utils/resourceLifecycle';
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
import { PythonEnvInfo } from '../../base/info';
import { ILocator, IPythonEnvsIterator, NOOP_ITERATOR, PythonLocatorQuery } from '../../base/locator';
import { combineIterators, Locators } from '../../base/locators';
import { LazyResourceBasedLocator } from '../../base/locators/common/resourceBasedLocator';
import { PythonEnvironment } from '../../info';
import { isHiddenInterpreter } from './services/interpreterFilter';

/**
 * A wrapper around all locators used by the extension.
 */
export class ExtensionLocators extends Locators {
    constructor(
        // These are expected to be low-level locators (e.g. system).
        nonWorkspace: ILocator[],
        // This is expected to be a locator wrapping any found in
        // the workspace (i.e. WorkspaceLocators).
        workspace: ILocator,
    ) {
        super([...nonWorkspace, workspace]);
    }
}

type WorkspaceLocatorFactoryResult = ILocator & Partial<IDisposable>;
type WorkspaceLocatorFactory = (root: Uri) => WorkspaceLocatorFactoryResult[];

type RootURI = string;

export type WatchRootsArgs = {
    initRoot(root: Uri): void;
    addRoot(root: Uri): void;
    removeRoot(root: Uri): void;
};
type WatchRootsFunc = (args: WatchRootsArgs) => IDisposable;

// XXX Factor out RootedLocators and MultiRootedLocators.

/**
 * The collection of all workspace-specific locators used by the extension.
 *
 * The factories are used to produce the locators for each workspace folder.
 */
export class WorkspaceLocators extends LazyResourceBasedLocator {
    private readonly locators: Record<RootURI, [ILocator, IDisposable]> = {};

    private readonly roots: Record<RootURI, Uri> = {};

    constructor(private readonly watchRoots: WatchRootsFunc, private readonly factories: WorkspaceLocatorFactory[]) {
        super();
    }

    public async dispose(): Promise<void> {
        await super.dispose();

        // Clear all the roots.
        const roots = Object.keys(this.roots).map((key) => this.roots[key]);
        roots.forEach((root) => this.removeRoot(root));
    }

    protected doIterEnvs(query?: PythonLocatorQuery): IPythonEnvsIterator {
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
            const [locator] = this.locators[key];
            return locator.iterEnvs(query);
        });
        return combineIterators(iterators);
    }

    protected async doResolveEnv(env: string | PythonEnvInfo): Promise<PythonEnvInfo | undefined> {
        if (typeof env !== 'string' && env.searchLocation) {
            const found = this.locators[env.searchLocation.toString()];
            if (found !== undefined) {
                const [rootLocator] = found;
                return rootLocator.resolveEnv(env);
            }
        }
        // Fall back to checking all the roots.
        // The eslint disable below should be removed after we have a
        // better solution for these. We need asyncFind for this.
        for (const key of Object.keys(this.locators)) {
            const [locator] = this.locators[key];
            // eslint-disable-next-line no-await-in-loop
            const resolved = await locator.resolveEnv(env);
            if (resolved !== undefined) {
                return resolved;
            }
        }
        return undefined;
    }

    protected async initResources(): Promise<void> {
        const disposable = this.watchRoots({
            initRoot: (root: Uri) => this.addRoot(root),
            addRoot: (root: Uri) => {
                // Drop the old one, if necessary.
                this.removeRoot(root);
                this.addRoot(root);
                this.emitter.fire({ searchLocation: root });
            },
            removeRoot: (root: Uri) => {
                this.removeRoot(root);
                this.emitter.fire({ searchLocation: root });
            },
        });
        this.disposables.push(disposable);
    }

    private addRoot(root: Uri): void {
        // Create the root's locator, wrapping each factory-generated locator.
        const locators: ILocator[] = [];
        const disposables = new Disposables();
        this.factories.forEach((create) => {
            create(root).forEach((loc) => {
                locators.push(loc);
                if (loc.dispose !== undefined) {
                    disposables.push(loc as IDisposable);
                }
            });
        });
        const locator = new Locators(locators);
        // Cache it.
        const key = root.toString();
        this.locators[key] = [locator, disposables];
        this.roots[key] = root;
        // Hook up the watchers.
        disposables.push(
            locator.onChanged((e) => {
                if (e.searchLocation === undefined) {
                    e.searchLocation = root;
                }
                this.emitter.fire(e);
            }),
        );
    }

    private removeRoot(root: Uri): void {
        const key = root.toString();
        const found = this.locators[key];
        if (found === undefined) {
            return;
        }
        const [, disposables] = found;
        delete this.locators[key];
        delete this.roots[key];
        disposables.dispose();
    }
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
