import { Memento } from 'vscode';
import { PersistentStateFactory } from '../../client/common/persistentState';
import { IPersistentState, IPersistentStateFactory } from '../../client/common/types';

const PrefixesToStore = ['INTERPRETERS_CACHE'];

// tslint:disable-next-line: no-any
const persistedState = new Map<string, any>();

class TestPersistentState<T> implements IPersistentState<T> {
    constructor(private key: string, defaultValue?: T | undefined) {
        if (defaultValue) {
            persistedState.set(key, defaultValue);
        }
    }
    public get value(): T {
        return persistedState.get(this.key);
    }
    public async updateValue(value: T): Promise<void> {
        persistedState.set(this.key, value);
    }
}

// This class is used to make certain values persist across tests.
export class TestPersistentStateFactory implements IPersistentStateFactory {
    private realStateFactory: PersistentStateFactory;
    constructor(globalState: Memento, localState: Memento) {
        this.realStateFactory = new PersistentStateFactory(globalState, localState);
    }

    public createGlobalPersistentState<T>(
        key: string,
        defaultValue?: T | undefined,
        expiryDurationMs?: number | undefined
    ): IPersistentState<T> {
        if (PrefixesToStore.find((p) => key.startsWith(p))) {
            return new TestPersistentState(key, defaultValue);
        }

        return this.realStateFactory.createGlobalPersistentState(key, defaultValue, expiryDurationMs);
    }
    public createWorkspacePersistentState<T>(
        key: string,
        defaultValue?: T | undefined,
        expiryDurationMs?: number | undefined
    ): IPersistentState<T> {
        if (PrefixesToStore.find((p) => key.startsWith(p))) {
            return new TestPersistentState(key, defaultValue);
        }

        return this.realStateFactory.createWorkspacePersistentState(key, defaultValue, expiryDurationMs);
    }
}
