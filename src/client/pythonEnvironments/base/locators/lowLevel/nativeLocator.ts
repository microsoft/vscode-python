import { Event } from 'vscode';
import * as ch from 'child_process';
import * as path from 'path';
import * as rpc from 'vscode-jsonrpc/node';
import { EXTENSION_ROOT_DIR } from '../../../../constants';
import { isWindows } from '../../../../common/platform/platformService';
import { IDisposable } from '../../../../common/types';
import { ILocator, BasicEnvInfo, IPythonEnvsIterator } from '../../locator';
import { PythonEnvsChangedEvent } from '../../watcher';

const NATIVE_LOCATOR = isWindows()
    ? path.join(EXTENSION_ROOT_DIR, 'native_locator', 'bin', 'python-finder.exe')
    : path.join(EXTENSION_ROOT_DIR, 'native_locator', 'bin', 'python-finder');

export class NativeLocator implements ILocator<BasicEnvInfo>, IDisposable {
    public readonly providerId: string = 'native-locator';

    public readonly onChanged: Event<PythonEnvsChangedEvent>;

    public async dispose(): Promise<void> {}

    // eslint-disable-next-line class-methods-use-this
    public iterEnvs(): IPythonEnvsIterator<BasicEnvInfo> {
        const proc = ch.spawn(NATIVE_LOCATOR, [], { stdio: 'pipe' });
        const connection = rpc.createMessageConnection(
            new rpc.StreamMessageReader(proc.stdout),
            new rpc.StreamMessageWriter(proc.stdin),
        );
        connection.onNotification('pythonEnvironment', (data: unknown) => {
            console.log(data);
        });
        connection.onNotification('envManager', (data: unknown) => {
            console.log(data);
        });
        connection.listen();
        return {
            async *[Symbol.asyncIterator]() {
                yield* [];
            },
        };
    }
}
