// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Disposable, Event, EventEmitter, Uri } from 'vscode';
import { IDisposable } from '../../../../common/types';
import { ILocator, BasicEnvInfo, IPythonEnvsIterator } from '../../locator';
import { PythonEnvsChangedEvent } from '../../watcher';
import { PythonVersion } from '../../info';
import { Conda } from '../../../common/environmentManagers/conda';
import { traceError } from '../../../../logging';
import type { KnownEnvironmentTools } from '../../../../api/types';
import { setPyEnvBinary } from '../../../common/environmentManagers/pyenv';
import { NativeGlobalPythonFinder, createNativeGlobalPythonFinder } from '../common/nativePythonFinder';
import { disposeAll } from '../../../../common/utils/resourceLifecycle';
import { Architecture } from '../../../../common/utils/platform';

function toolToKnownEnvironmentTool(tool: string): KnownEnvironmentTools {
    switch (tool.toLowerCase()) {
        case 'conda':
            return 'Conda';
        case 'poetry':
            return 'Poetry';
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
            major: typeof major === 'number' ? major : -1,
            minor: typeof minor === 'number' ? minor : -1,
            micro: typeof micro === 'number' ? micro : -1,
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

    private readonly finder: NativeGlobalPythonFinder;

    constructor() {
        this.onChanged = this.onChangedEmitter.event;
        this.finder = createNativeGlobalPythonFinder();
        this.disposables.push(this.onChangedEmitter, this.finder);
    }

    public readonly onChanged: Event<PythonEnvsChangedEvent>;

    public async dispose(): Promise<void> {
        this.disposables.forEach((d) => d.dispose());
        return Promise.resolve();
    }

    public async *iterEnvs(): IPythonEnvsIterator<BasicEnvInfo> {
        const disposables: IDisposable[] = [];
        const disposable = new Disposable(() => disposeAll(disposables));
        this.disposables.push(disposable);
        for await (const data of this.finder.refresh()) {
            if (data.manager) {
                switch (toolToKnownEnvironmentTool(data.manager.tool)) {
                    case 'Conda': {
                        Conda.setConda(data.manager.executable);
                        break;
                    }
                    case 'Pyenv': {
                        setPyEnvBinary(data.manager.executable);
                        break;
                    }
                    default: {
                        break;
                    }
                }
            }
            if (data.executable) {
                const arch = (data.arch || '').toLowerCase();
                const env: BasicEnvInfo = {
                    kind: this.finder.categoryToKind(data.kind),
                    executablePath: data.executable ? data.executable : '',
                    envPath: data.prefix ? data.prefix : undefined,
                    version: data.version ? parseVersion(data.version) : undefined,
                    name: data.name ? data.name : '',
                    displayName: data.displayName ? data.displayName : '',
                    searchLocation: data.project ? Uri.file(data.project) : undefined,
                    identifiedUsingNativeLocator: true,
                    arch:
                        // eslint-disable-next-line no-nested-ternary
                        arch === 'x64' ? Architecture.x64 : arch === 'x86' ? Architecture.x86 : undefined,
                };
                yield env;
            }
        }
    }
}
