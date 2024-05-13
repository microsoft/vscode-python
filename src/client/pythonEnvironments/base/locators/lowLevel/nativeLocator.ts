// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Disposable, Event, EventEmitter } from 'vscode';
import { IDisposable } from '../../../../common/types';
import { ILocator, BasicEnvInfo, IPythonEnvsIterator } from '../../locator';
import { PythonEnvsChangedEvent } from '../../watcher';
import { PythonEnvKind, PythonVersion } from '../../info';
import { Conda } from '../../../common/environmentManagers/conda';
import { traceError } from '../../../../logging';
import type { KnownEnvironmentTools } from '../../../../api/types';
import { setPyEnvBinary } from '../../../common/environmentManagers/pyenv';
import {
    NativeEnvInfo,
    NativeEnvManagerInfo,
    NativeGlobalPythonFinder,
    createNativeGlobalPythonFinder,
} from '../common/nativePythonFinder';
import { disposeAll } from '../../../../common/utils/resourceLifecycle';

function categoryToKind(category: string): PythonEnvKind {
    switch (category.toLowerCase()) {
        case 'conda':
            return PythonEnvKind.Conda;
        case 'system':
        case 'homebrew':
            return PythonEnvKind.System;
        case 'pyenv':
            return PythonEnvKind.Pyenv;
        case 'pipenv':
            return PythonEnvKind.Pipenv;
        case 'pyenvvirtualenv':
            return PythonEnvKind.VirtualEnv;
        case 'virtualenvwrapper':
            return PythonEnvKind.VirtualEnvWrapper;
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

    public iterEnvs(): IPythonEnvsIterator<BasicEnvInfo> {
        const promise = this.finder.startSearch();
        const envs: BasicEnvInfo[] = [];
        const disposables: IDisposable[] = [];
        const disposable = new Disposable(() => disposeAll(disposables));
        this.disposables.push(disposable);
        promise.finally(() => disposable.dispose());
        disposables.push(
            this.finder.onDidFindPythonEnvironment((data: NativeEnvInfo) => {
                // TODO: What if executable is undefined?
                if (data.pythonExecutablePath) {
                    envs.push({
                        kind: categoryToKind(data.category),
                        executablePath: data.pythonExecutablePath,
                        envPath: data.envPath,
                        version: parseVersion(data.version),
                        name: data.name === '' ? undefined : data.name,
                    });
                }
            }),
            this.finder.onDidFindEnvironmentManager((data: NativeEnvManagerInfo) => {
                switch (toolToKnownEnvironmentTool(data.tool)) {
                    case 'Conda': {
                        Conda.setConda(data.executablePath);
                        break;
                    }
                    case 'Pyenv': {
                        setPyEnvBinary(data.executablePath);
                        break;
                    }
                    default: {
                        break;
                    }
                }
            }),
        );

        const iterator = async function* (): IPythonEnvsIterator<BasicEnvInfo> {
            await promise;
            yield* envs;
        };
        return iterator();
    }
}
