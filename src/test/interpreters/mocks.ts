import { injectable } from 'inversify';
import { IRegistry, RegistryHive } from '../../client/common/platform/types';
import { IPersistentState } from '../../client/common/types';
import { Architecture } from '../../client/common/utils/platform';
import { IInterpreterVersionService } from '../../client/interpreter/contracts';

@injectable()
export class MockRegistry implements IRegistry {
    constructor(
        private keys: { key: string; hive: RegistryHive; arch?: Architecture; values: string[] }[],
        private values: { key: string; hive: RegistryHive; arch?: Architecture; value: string; name?: string }[]
    ) {}
    public async getKeys(key: string, hive: RegistryHive, arch?: Architecture): Promise<string[]> {
        const items = this.keys.find((item) => {
            if (typeof item.arch === 'number') {
                return item.key === key && item.hive === hive && item.arch === arch;
            }
            return item.key === key && item.hive === hive;
        });

        return items ? Promise.resolve(items.values) : Promise.resolve([]);
    }
    public async getValue(
        key: string,
        hive: RegistryHive,
        arch?: Architecture,
        name?: string
    ): Promise<string | undefined | null> {
        const items = this.values.find((item) => {
            if (item.key !== key || item.hive !== hive) {
                return false;
            }
            if (typeof item.arch === 'number' && item.arch !== arch) {
                return false;
            }
            if (name && item.name !== name) {
                return false;
            }
            return true;
        });

        return items ? Promise.resolve(items.value) : Promise.resolve(null);
    }
}

// tslint:disable-next-line:max-classes-per-file
@injectable()
export class MockInterpreterVersionProvider implements IInterpreterVersionService {
    constructor(
        private displayName: string,
        private useDefaultDisplayName: boolean = false,
        private pipVersionPromise?: Promise<string>
    ) {}
    public async getVersion(_pythonPath: string, defaultDisplayName: string): Promise<string> {
        return this.useDefaultDisplayName ? Promise.resolve(defaultDisplayName) : Promise.resolve(this.displayName);
    }
    public async getPipVersion(_pythonPath: string): Promise<string> {
        // tslint:disable-next-line:no-non-null-assertion
        return this.pipVersionPromise!;
    }
    // tslint:disable-next-line:no-empty
    public dispose() {}
}

// tslint:disable-next-line:no-any max-classes-per-file
export class MockState implements IPersistentState<any> {
    // tslint:disable-next-line:no-any
    constructor(public data: any) {}
    // tslint:disable-next-line:no-any
    get value(): any {
        return this.data;
    }
    // tslint:disable-next-line:no-any
    public async updateValue(data: any): Promise<void> {
        this.data = data;
    }
}
