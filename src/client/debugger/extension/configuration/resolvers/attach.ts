// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { CancellationToken, Uri, WorkspaceFolder } from 'vscode';
import { IDocumentManager, IWorkspaceService } from '../../../../common/application/types';
import { DebugAdapterNewPtvsd } from '../../../../common/experimentGroups';
import { IPlatformService } from '../../../../common/platform/types';
import { IConfigurationService, IExperimentsManager } from '../../../../common/types';
import { Diagnostics } from '../../../../common/utils/localize';
import { AttachRequestArguments, DebugOptions, PathMapping } from '../../../types';
import { BaseConfigurationResolver } from './base';

@injectable()
export class AttachConfigurationResolver extends BaseConfigurationResolver<AttachRequestArguments> {
    constructor(
        @inject(IWorkspaceService) workspaceService: IWorkspaceService,
        @inject(IDocumentManager) documentManager: IDocumentManager,
        @inject(IPlatformService) platformService: IPlatformService,
        @inject(IConfigurationService) configurationService: IConfigurationService,
        @inject(IExperimentsManager) private readonly experiments: IExperimentsManager
    ) {
        super(workspaceService, documentManager, platformService, configurationService);
    }
    public async resolveDebugConfiguration(
        folder: WorkspaceFolder | undefined,
        debugConfiguration: AttachRequestArguments,
        _token?: CancellationToken
    ): Promise<AttachRequestArguments | undefined> {
        if (
            !this.experiments.inExperiment(DebugAdapterNewPtvsd.experiment) &&
            debugConfiguration.processId !== undefined
        ) {
            throw Error(Diagnostics.processId());
        }
        const workspaceFolder = this.getWorkspaceFolder(folder);

        await this.provideAttachDefaults(workspaceFolder, debugConfiguration as AttachRequestArguments);

        const dbgConfig = debugConfiguration;
        if (Array.isArray(dbgConfig.debugOptions)) {
            dbgConfig.debugOptions = dbgConfig.debugOptions!.filter(
                (item, pos) => dbgConfig.debugOptions!.indexOf(item) === pos
            );
        }
        return debugConfiguration;
    }
    // tslint:disable-next-line:cyclomatic-complexity
    protected async provideAttachDefaults(
        workspaceFolder: Uri | undefined,
        debugConfiguration: AttachRequestArguments
    ): Promise<void> {
        if (!Array.isArray(debugConfiguration.debugOptions)) {
            debugConfiguration.debugOptions = [];
        }
        if (!(debugConfiguration.connect || debugConfiguration.listen) && !debugConfiguration.host) {
            // Connect and listen cannot be mixed with host property.
            debugConfiguration.host = 'localhost';
        }
        if (debugConfiguration.justMyCode === undefined) {
            // Populate justMyCode using debugStdLib
            debugConfiguration.justMyCode = !debugConfiguration.debugStdLib;
        }
        debugConfiguration.showReturnValue = debugConfiguration.showReturnValue !== false;
        // Pass workspace folder so we can get this when we get debug events firing.
        debugConfiguration.workspaceFolder = workspaceFolder ? workspaceFolder.fsPath : undefined;
        const debugOptions = debugConfiguration.debugOptions!;
        if (!debugConfiguration.justMyCode) {
            this.debugOption(debugOptions, DebugOptions.DebugStdLib);
        }
        if (debugConfiguration.django) {
            this.debugOption(debugOptions, DebugOptions.Django);
        }
        if (debugConfiguration.jinja) {
            this.debugOption(debugOptions, DebugOptions.Jinja);
        }
        if (debugConfiguration.subProcess === true) {
            this.debugOption(debugOptions, DebugOptions.SubProcess);
        }
        if (
            debugConfiguration.pyramid &&
            debugOptions.indexOf(DebugOptions.Jinja) === -1 &&
            debugConfiguration.jinja !== false
        ) {
            this.debugOption(debugOptions, DebugOptions.Jinja);
        }
        if (debugConfiguration.redirectOutput || debugConfiguration.redirectOutput === undefined) {
            this.debugOption(debugOptions, DebugOptions.RedirectOutput);
        }

        // We'll need paths to be fixed only in the case where local and remote hosts are the same
        // I.e. only if hostName === 'localhost' or '127.0.0.1' or ''
        const isLocalHost = this.isLocalHost(debugConfiguration.host);
        if (this.platformService.isWindows && isLocalHost) {
            this.debugOption(debugOptions, DebugOptions.FixFilePathCase);
        }
        if (this.platformService.isWindows) {
            this.debugOption(debugOptions, DebugOptions.WindowsClient);
        } else {
            this.debugOption(debugOptions, DebugOptions.UnixClient);
        }
        if (debugConfiguration.showReturnValue) {
            this.debugOption(debugOptions, DebugOptions.ShowReturnValue);
        }

        debugConfiguration.pathMappings = this.resolvePathMappings(
            debugConfiguration.pathMappings || [],
            debugConfiguration.host,
            debugConfiguration.localRoot,
            debugConfiguration.remoteRoot,
            workspaceFolder
        );
        this.sendTelemetry('attach', debugConfiguration);
    }

    private resolvePathMappings(
        pathMappings: PathMapping[],
        host?: string,
        localRoot?: string,
        remoteRoot?: string,
        workspaceFolder?: Uri
    ) {
        // This is for backwards compatibility.
        if (localRoot && remoteRoot) {
            pathMappings.push({
                localRoot: localRoot,
                remoteRoot: remoteRoot
            });
        }
        // If attaching to local host, then always map local root and remote roots.
        if (this.isLocalHost(host)) {
            pathMappings = this.fixUpPathMappings(pathMappings, workspaceFolder ? workspaceFolder.fsPath : '');
        }
        return pathMappings.length > 0 ? pathMappings : undefined;
    }
}
