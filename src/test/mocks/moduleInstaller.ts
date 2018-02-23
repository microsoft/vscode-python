import { EventEmitter } from 'events';
import { Uri } from 'vscode';
import { IModuleInstaller } from '../../client/common/installer/types';

export class MockModuleInstaller extends EventEmitter implements IModuleInstaller {
    constructor(public readonly displayName: string, private supported: boolean) {
        super();
    }
    public get priority(): number {
        return 0;
    }
    public async installModule(name: string, resource?: Uri): Promise<void> {
        this.emit('installModule', name);
    }
    public async isSupported(resource?: Uri): Promise<boolean> {
        return this.supported;
    }
}
