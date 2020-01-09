// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-invalid-template-strings no-suspicious-comment

import { injectable } from 'inversify';
import * as path from 'path';
import { CancellationToken, DebugConfiguration, Uri, WorkspaceFolder } from 'vscode';
import { IDocumentManager, IWorkspaceService } from '../../../../common/application/types';
import { PYTHON_LANGUAGE } from '../../../../common/constants';
import { IPlatformService } from '../../../../common/platform/types';
import { IConfigurationService } from '../../../../common/types';
import { SystemVariables } from '../../../../common/variables/systemVariables';
import { sendTelemetryEvent } from '../../../../telemetry';
import { EventName } from '../../../../telemetry/constants';
import { DebuggerTelemetry } from '../../../../telemetry/types';
import { AttachRequestArguments, DebugOptions, LaunchRequestArguments, PathMapping } from '../../../types';
import { PythonPathSource } from '../../types';
import { IDebugConfigurationResolver } from '../types';

@injectable()
export abstract class BaseConfigurationResolver<T extends DebugConfiguration> implements IDebugConfigurationResolver<T> {
    protected pythonPathSource: PythonPathSource = PythonPathSource.launchJson;
    constructor(
        protected readonly workspaceService: IWorkspaceService,
        protected readonly documentManager: IDocumentManager,
        protected readonly platformService: IPlatformService,
        protected readonly configurationService: IConfigurationService
    ) {}
    public abstract resolveDebugConfiguration(folder: WorkspaceFolder | undefined, debugConfiguration: DebugConfiguration, token?: CancellationToken): Promise<T | undefined>;
    protected getWorkspaceFolder(folder: WorkspaceFolder | undefined): Uri | undefined {
        if (folder) {
            return folder.uri;
        }
        const program = this.getProgram();
        if (!Array.isArray(this.workspaceService.workspaceFolders) || this.workspaceService.workspaceFolders.length === 0) {
            return program ? Uri.file(path.dirname(program)) : undefined;
        }
        if (this.workspaceService.workspaceFolders.length === 1) {
            return this.workspaceService.workspaceFolders[0].uri;
        }
        if (program) {
            const workspaceFolder = this.workspaceService.getWorkspaceFolder(Uri.file(program));
            if (workspaceFolder) {
                return workspaceFolder.uri;
            }
        }
    }
    protected getProgram(): string | undefined {
        const editor = this.documentManager.activeTextEditor;
        if (editor && editor.document.languageId === PYTHON_LANGUAGE) {
            return editor.document.fileName;
        }
    }
    protected resolveAndUpdatePaths(workspaceFolder: Uri | undefined, debugConfiguration: LaunchRequestArguments): void {
        this.resolveAndUpdateEnvFilePath(workspaceFolder, debugConfiguration);
        this.resolveAndUpdatePythonPath(workspaceFolder, debugConfiguration);
    }
    protected resolveAndUpdateEnvFilePath(workspaceFolder: Uri | undefined, debugConfiguration: LaunchRequestArguments): void {
        if (!debugConfiguration) {
            return;
        }
        if (debugConfiguration.envFile && (workspaceFolder || debugConfiguration.cwd)) {
            const systemVariables = new SystemVariables(undefined, (workspaceFolder ? workspaceFolder.fsPath : undefined) || debugConfiguration.cwd);
            debugConfiguration.envFile = systemVariables.resolveAny(debugConfiguration.envFile);
        }
    }
    protected resolveAndUpdatePythonPath(workspaceFolder: Uri | undefined, debugConfiguration: LaunchRequestArguments): void {
        if (!debugConfiguration) {
            return;
        }
        if (debugConfiguration.pythonPath === '${config:python.pythonPath}' || !debugConfiguration.pythonPath) {
            const pythonPath = this.configurationService.getSettings(workspaceFolder).pythonPath;
            debugConfiguration.pythonPath = pythonPath;
            this.pythonPathSource = PythonPathSource.settingsJson;
        } else {
            this.pythonPathSource = PythonPathSource.launchJson;
        }
    }
    protected debugOption(debugOptions: DebugOptions[], debugOption: DebugOptions) {
        if (debugOptions.indexOf(debugOption) >= 0) {
            return;
        }
        debugOptions.push(debugOption);
    }
    protected isLocalHost(hostName?: string) {
        const LocalHosts = ['localhost', '127.0.0.1', '::1'];
        return hostName && LocalHosts.indexOf(hostName.toLowerCase()) >= 0 ? true : false;
    }
    protected fixUpPathMappings(pathMappings: PathMapping[], defaultLocalRoot?: string, defaultRemoteRoot?: string): PathMapping[] {
        if (!defaultLocalRoot) {
            return [];
        }
        if (!defaultRemoteRoot) {
            defaultRemoteRoot = defaultLocalRoot;
        }

        if (pathMappings.length === 0) {
            pathMappings = [
                {
                    localRoot: defaultLocalRoot,
                    remoteRoot: defaultRemoteRoot
                }
            ];
        } else {
            // Expand ${workspaceFolder} variable first if necessary.
            const systemVariables = new SystemVariables(undefined, defaultLocalRoot);
            pathMappings = pathMappings.map(({ localRoot: mappedLocalRoot, remoteRoot }) => ({
                localRoot: systemVariables.resolveAny(mappedLocalRoot),
                // TODO: Apply to remoteRoot too?
                remoteRoot
            }));
        }

        // If on Windows, lowercase the drive letter for path mappings.
        // TODO: Apply even if no localRoot?
        if (this.platformService.isWindows) {
            // TODO: Apply to remoteRoot too?
            pathMappings = pathMappings.map(({ localRoot: windowsLocalRoot, remoteRoot }) => {
                let localRoot = windowsLocalRoot;
                if (windowsLocalRoot.match(/^[A-Z]:/)) {
                    localRoot = `${windowsLocalRoot[0].toLowerCase()}${windowsLocalRoot.substr(1)}`;
                }
                return { localRoot, remoteRoot };
            });
        }

        return pathMappings;
    }
    protected isDebuggingFlask(debugConfiguration: Partial<LaunchRequestArguments & AttachRequestArguments>) {
        return debugConfiguration.module && debugConfiguration.module.toUpperCase() === 'FLASK' ? true : false;
    }
    protected sendTelemetry(trigger: 'launch' | 'attach' | 'test', debugConfiguration: Partial<LaunchRequestArguments & AttachRequestArguments>) {
        const name = debugConfiguration.name || '';
        const moduleName = debugConfiguration.module || '';
        const telemetryProps: DebuggerTelemetry = {
            trigger,
            console: debugConfiguration.console,
            hasEnvVars: typeof debugConfiguration.env === 'object' && Object.keys(debugConfiguration.env).length > 0,
            django: !!debugConfiguration.django,
            flask: this.isDebuggingFlask(debugConfiguration),
            hasArgs: Array.isArray(debugConfiguration.args) && debugConfiguration.args.length > 0,
            isLocalhost: this.isLocalHost(debugConfiguration.host),
            isModule: moduleName.length > 0,
            isSudo: !!debugConfiguration.sudo,
            jinja: !!debugConfiguration.jinja,
            pyramid: !!debugConfiguration.pyramid,
            stopOnEntry: !!debugConfiguration.stopOnEntry,
            showReturnValue: !!debugConfiguration.showReturnValue,
            subProcess: !!debugConfiguration.subProcess,
            watson: name.toLowerCase().indexOf('watson') >= 0,
            pyspark: name.toLowerCase().indexOf('pyspark') >= 0,
            gevent: name.toLowerCase().indexOf('gevent') >= 0,
            scrapy: moduleName.toLowerCase() === 'scrapy'
        };
        sendTelemetryEvent(EventName.DEBUGGER, undefined, telemetryProps);
    }
}
