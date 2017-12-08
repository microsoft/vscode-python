import { EventEmitter } from 'events';
import { Uri } from 'vscode';
import { createDeferred, Deferred } from '../../client/common/helpers';
import { IModuleInstaller } from '../../client/common/installer/types';

export class MockModuleInstaller extends EventEmitter implements IModuleInstaller {
    constructor(public readonly displayName: string, private supported: boolean) {
        super();
    }
    public async installModule(name: string): Promise<void> {
        this.emit('installModule', name);
    }
    public async isSupported(resource?: Uri): Promise<boolean> {
        return this.supported;
    }
}
