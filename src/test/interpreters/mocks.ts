import { Architecture, IRegistry, RegistryHive } from '../../client/common/platform/types';
import { IProcessService } from '../../client/common/process/types';
import { IInterpreterLocatorService, IInterpreterVersionService, InterpreterType, PythonInterpreter } from '../../client/interpreter/contracts';
import { CondaLocatorService } from '../../client/interpreter/locators/services/condaLocator';
import { IVirtualEnvironmentIdentifier } from '../../client/interpreter/virtualEnvs/types';

export class MockProvider implements IInterpreterLocatorService {
    constructor(private suggestions: PythonInterpreter[]) {
    }
    public async getInterpreters(): Promise<PythonInterpreter[]> {
        return Promise.resolve(this.suggestions);
    }
    // tslint:disable-next-line:no-empty
    public dispose() { }
}

export class MockRegistry implements IRegistry {
    constructor(private keys: { key: string, hive: RegistryHive, arch?: Architecture, values: string[] }[],
        private values: { key: string, hive: RegistryHive, arch?: Architecture, value: string, name?: string }[]) {
    }
    public async getKeys(key: string, hive: RegistryHive, arch?: Architecture): Promise<string[]> {
        const items = this.keys.find(item => {
            if (typeof item.arch === 'number') {
                return item.key === key && item.hive === hive && item.arch === arch;
            }
            return item.key === key && item.hive === hive;
        });

        return items ? Promise.resolve(items.values) : Promise.resolve([]);
    }
    public async getValue(key: string, hive: RegistryHive, arch?: Architecture, name?: string): Promise<string | undefined | null> {
        const items = this.values.find(item => {
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

export class MockVirtualEnv implements IVirtualEnvironmentIdentifier {
    constructor(private isDetected: boolean, public name: string, public type: InterpreterType.VirtualEnv | InterpreterType.VEnv = InterpreterType.VirtualEnv) {
    }
    public async detect(pythonPath: string): Promise<boolean> {
        return Promise.resolve(this.isDetected);
    }
}

// tslint:disable-next-line:max-classes-per-file
export class MockInterpreterVersionProvider implements IInterpreterVersionService {
    constructor(private displayName: string, private useDefaultDisplayName: boolean = false,
        private pipVersionPromise?: Promise<string>) { }
    public async getVersion(pythonPath: string, defaultDisplayName: string): Promise<string> {
        return this.useDefaultDisplayName ? Promise.resolve(defaultDisplayName) : Promise.resolve(this.displayName);
    }
    public async getPipVersion(pythonPath: string): Promise<string> {
        // tslint:disable-next-line:no-non-null-assertion
        return this.pipVersionPromise!;
    }
    // tslint:disable-next-line:no-empty
    public dispose() { }
}

// tslint:disable-next-line:max-classes-per-file
export class MockCondaLocatorService extends CondaLocatorService {
    constructor(isWindows: boolean, procService: IProcessService, registryLookupForConda?: IInterpreterLocatorService, private isCondaInEnv?: boolean) {
        super(isWindows, procService, registryLookupForConda);
    }
    public async isCondaInCurrentPath() {
        if (typeof this.isCondaInEnv === 'boolean') {
            return this.isCondaInEnv;
        }
        return super.isCondaInCurrentPath();
    }
}
