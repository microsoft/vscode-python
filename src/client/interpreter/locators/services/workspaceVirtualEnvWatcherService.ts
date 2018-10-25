// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import * as path from 'path';
import { Disposable, Event, EventEmitter, FileSystemWatcher, Uri } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import { Logger, traceVerbose } from '../../../common/logger';
import { IPlatformService } from '../../../common/platform/types';
import { IDisposableRegistry } from '../../../common/types';
import { debounce } from '../../../common/utils/decorators';
import { IInterpreterWatcher, IVirtualEnvironmentsSearchPathProvider } from '../../contracts';

@injectable()
export class WorkspaceVirtualEnvWatcherService implements IInterpreterWatcher {
    private readonly didCreate = new EventEmitter<void>();
    private fsWatchers: FileSystemWatcher[] = [];
    constructor(@inject(IDisposableRegistry) private readonly disposableRegistry: Disposable[],
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IVirtualEnvironmentsSearchPathProvider) @named('workspace') private readonly workspaceVirtualEnvPathProvider: IVirtualEnvironmentsSearchPathProvider,
        @inject(IPlatformService) private readonly platformService: IPlatformService) {
    }
    public get onDidCreate(): Event<void> {
        return this.didCreate.event;
    }
    @traceVerbose('Register Intepreter Watcher')
    public async register(resource: Uri | undefined): Promise<void> {
        if (this.fsWatchers.length > 0) {
            return;
        }
        const pathsToWatch = await this.workspaceVirtualEnvPathProvider.getSearchPaths(resource);
        const patterns: string[] = [];
        if (this.platformService.isWindows) {
            patterns.push(...[
                path.join('**', '*python*.exe'),
                path.join('**', '*Python*.exe'),
                path.join('**', 'Scripts', 'activate.*'),
                path.join('**', 'Scripts', 'Activate.*')
            ]);
        } else {
            patterns.push(...[
                path.join('**', '*python*'),
                path.join('*', 'bin', 'activate*')
            ]);
        }

        for (const rootDir of pathsToWatch) {
            for (const pattern of patterns) {
                Logger.verbose(`Create file systemwatcher with pattern ${pattern}, for ${rootDir}`);

                const fsWatcher = this.workspaceService.createFileSystemWatcher(pattern);
                fsWatcher.onDidCreate(e => this.createHandler(e, pathsToWatch), this, this.disposableRegistry);

                this.disposableRegistry.push(fsWatcher);
                this.fsWatchers.push(fsWatcher);
            }
        }
    }
    @debounce(2000)
    @traceVerbose('Intepreter Watcher change handler')
    protected createHandler(e: Uri, pathsToCheck: string[]) {
        const hasMatch = pathsToCheck.some(pathToCheck => e.fsPath.startsWith(pathToCheck));
        if (!hasMatch) {
            return;
        }
        Logger.verbose(`Invoked ${e.fsPath}`);
        // Notifiy within a second
        this.didCreate.fire();
        // On Windows, creation of environments are slow, hence lets notify again after 10 seconds.
        setTimeout(() => this.didCreate.fire(), 10000);
    }
}
