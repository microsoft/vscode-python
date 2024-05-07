import { Event, EventEmitter } from 'vscode';
import * as ch from 'child_process';
import * as path from 'path';
import * as rpc from 'vscode-jsonrpc/node';
import { EXTENSION_ROOT_DIR } from '../../../../constants';
import { isWindows } from '../../../../common/platform/platformService';
import { IDisposable } from '../../../../common/types';
import { ILocator, BasicEnvInfo, IPythonEnvsIterator } from '../../locator';
import { PythonEnvsChangedEvent } from '../../watcher';
import { createDeferred } from '../../../../common/utils/async';
import { PythonEnvKind, PythonVersion } from '../../info';
import { Conda } from '../../../common/environmentManagers/conda';
import { traceError } from '../../../../logging';
import type { KnownEnvironmentTools } from '../../../../api/types';
import { setPyEnvBinary } from '../../../common/environmentManagers/pyenv';

const NATIVE_LOCATOR = isWindows()
    ? path.join(EXTENSION_ROOT_DIR, 'native_locator', 'bin', 'python-finder.exe')
    : path.join(EXTENSION_ROOT_DIR, 'native_locator', 'bin', 'python-finder');

interface NativeEnvInfo {
    name: string;
    pythonExecutablePath: string[];
    category: string;
    version?: string;
    activatedRun?: string[];
    envPath?: string;
}

interface EnvManager {
    tool: string;
    executablePath: string[];
    version?: string;
}

function categoryToKind(category: string): PythonEnvKind {
    switch (category.toLowerCase()) {
        case 'conda':
            return PythonEnvKind.Conda;
        case 'system':
            return PythonEnvKind.System;
        case 'pyenv':
            return PythonEnvKind.Pyenv;
        case 'windowsstore':
            return PythonEnvKind.MicrosoftStore;
        default: {
            traceError(`Unknown Python Environment category '${category}' from Native Locator.`);
            return PythonEnvKind.Unknown;
        }
    }
}
function toolToKnownEnvironmentTool(tool: string): KnownEnvironmentTools {
    switch (tool.toLowerCase()) {
        case 'conda':
            return 'Conda';
        case 'pyenv':
            return 'Pyenv';
        default: {
            traceError(`Unknown Python Tool '${tool}' from Native Locator.`);
            return 'Unknown';
        }
    }
}

function parseVersion(version?: string): PythonVersion | undefined {
    if (!version) {
        return undefined;
    }

    try {
        const [major, minor, micro] = version.split('.').map((v) => parseInt(v, 10));
        return {
            major,
            minor,
            micro,
            sysVersion: version,
        };
    } catch {
        return undefined;
    }
}

export class NativeLocator implements ILocator<BasicEnvInfo>, IDisposable {
    public readonly providerId: string = 'native-locator';

    private readonly onChangedEmitter = new EventEmitter<PythonEnvsChangedEvent>();

    private readonly disposables: IDisposable[] = [];

    constructor() {
        this.onChanged = this.onChangedEmitter.event;
        this.disposables.push(this.onChangedEmitter);
    }

    public readonly onChanged: Event<PythonEnvsChangedEvent>;

    public async dispose(): Promise<void> {
        this.disposables.forEach((d) => d.dispose());
        return Promise.resolve();
    }

    public iterEnvs(): IPythonEnvsIterator<BasicEnvInfo> {
        const proc = ch.spawn(NATIVE_LOCATOR, [], { stdio: 'pipe' });
        const envs: BasicEnvInfo[] = [];
        const deferred = createDeferred<void>();
        const connection = rpc.createMessageConnection(
            new rpc.StreamMessageReader(proc.stdout),
            new rpc.StreamMessageWriter(proc.stdin),
        );
        this.disposables.push(connection);
        connection.onNotification('pythonEnvironment', (data: NativeEnvInfo) => {
            envs.push({
                kind: categoryToKind(data.category),
                executablePath: data.pythonExecutablePath[0],
                envPath: data.envPath,
                version: parseVersion(data.version),
                name: data.name === '' ? undefined : data.name,
            });
        });
        connection.onNotification('envManager', (data: EnvManager) => {
            switch (toolToKnownEnvironmentTool(data.tool)) {
                case 'Conda': {
                    Conda.setConda(data.executablePath[0]);
                    break;
                }
                case 'Pyenv': {
                    setPyEnvBinary(data.executablePath[0]);
                    break;
                }
                default: {
                    break;
                }
            }
        });
        connection.onNotification('exit', () => {
            deferred.resolve();
        });
        connection.listen();

        const iterator = async function* (): IPythonEnvsIterator<BasicEnvInfo> {
            await deferred.promise;
            yield* envs;
        };
        return iterator();
    }
}
