import { inject, injectable } from 'inversify';
import * as path from 'path';
import { Uri } from 'vscode';
import { createDeferred, Deferred } from '../../../common/helpers';
import { IFileSystem } from '../../../common/platform/types';
import { ILogger, IPersistentStateFactory } from '../../../common/types';
import { IServiceContainer } from '../../../ioc/types';
import {
    ICondaService,
    IInterpreterLocatorService,
    IInterpreterVersionService,
    InterpreterType,
    PythonInterpreter
} from '../../contracts';
import { AnacondaCompanyName, AnacondaCompanyNames, AnacondaDisplayName } from './conda';

@injectable()
export abstract class CacheableLocatorService implements IInterpreterLocatorService {
    private getInterpretersPromise: Deferred<PythonInterpreter[]>;
    constructor(private readonly name: string,
        private readonly cacheEnabled: boolean,
        protected readonly serviceContainer: IServiceContainer) {
    }
    public abstract dispose();
    public async getInterpreters(resource?: Uri): Promise<PythonInterpreter[]> {
        if (!this.getInterpretersPromise) {
            this.getInterpretersPromise = createDeferred<PythonInterpreter[]>();
            this.getInterpretersImplementation(resource)
                .then(items => {
                    if (this.cacheEnabled) {
                        this.cacheInterpreters(items);
                    }
                    this.getInterpretersPromise.resolve(items);
                })
                .catch(ex => this.getInterpretersPromise.reject(ex));
        }
        if (this.getInterpretersPromise.completed) {
            return this.getInterpretersPromise.promise;
        } else {
            return this.getCachedInterpreters();
        }
    }

    protected abstract getInterpretersImplementation(resource?: Uri): Promise<PythonInterpreter[]>;

    private getCachedInterpreters() {
        const persistentFactory = this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
        const globalPersistence = persistentFactory.createGlobalPersistentState<PythonInterpreter[]>(this.name, []);
        return globalPersistence.value.map(item => {
            return {
                ...item,
                cachedEntry: true
            };
        });
    }
    private cacheInterpreters(interpreters: PythonInterpreter[]) {
        const persistentFactory = this.serviceContainer.get<IPersistentStateFactory>(IPersistentStateFactory);
        const globalPersistence = persistentFactory.createGlobalPersistentState<PythonInterpreter[]>(this.name, []);
        globalPersistence.value = interpreters;
    }
}
