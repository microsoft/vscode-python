// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import '../common/extensions';

import { inject, injectable } from 'inversify';
import { ConfigurationChangeEvent, Disposable, OutputChannel, Uri } from 'vscode';
import { LSNotSupportedDiagnosticServiceId } from '../application/diagnostics/checks/lsNotSupported';
import { IDiagnosticsService } from '../application/diagnostics/types';
import { IApplicationShell, ICommandManager, IWorkspaceService } from '../common/application/types';
import { STANDARD_OUTPUT_CHANNEL } from '../common/constants';
import { traceError } from '../common/logger';
import {
    IConfigurationService,
    IDisposableRegistry,
    IExtensions,
    IOutputChannel,
    IPersistentStateFactory,
    IPythonSettings,
    Resource,
} from '../common/types';
import { swallowExceptions } from '../common/utils/decorators';
import { LanguageService } from '../common/utils/localize';
import { noop } from '../common/utils/misc';
import { IInterpreterService } from '../interpreter/contracts';
import { IServiceContainer } from '../ioc/types';
import { PythonEnvironment } from '../pythonEnvironments/info';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { Commands } from './commands';
import { LanguageServerChangeHandler } from './common/languageServerChangeHandler';
import { RefCountedLanguageServer } from './refCountedLanguageServer';
import {
    IExtensionActivationService,
    ILanguageServerActivator,
    ILanguageServerCache,
    LanguageServerType,
} from './types';
import { StopWatch } from '../common/utils/stopWatch';

const languageServerSetting: keyof IPythonSettings = 'languageServer';
const workspacePathNameForGlobalWorkspaces = '';

interface IActivatedServer {
    key: string;
    server: ILanguageServerActivator;
    jedi: boolean;
}

@injectable()
export class LanguageServerExtensionActivationService
    implements IExtensionActivationService, ILanguageServerCache, Disposable {
    private cache = new Map<string, Promise<RefCountedLanguageServer>>();

    private activatedServer?: IActivatedServer;

    private readonly workspaceService: IWorkspaceService;

    private readonly configurationService: IConfigurationService;

    private readonly output: OutputChannel;

    private readonly interpreterService: IInterpreterService;

    private readonly languageServerChangeHandler: LanguageServerChangeHandler;

    private resource!: Resource;

    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IPersistentStateFactory) private stateFactory: IPersistentStateFactory,
    ) {
        this.workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        this.configurationService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        this.interpreterService = this.serviceContainer.get<IInterpreterService>(IInterpreterService);
        this.output = this.serviceContainer.get<OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);

        const commandManager = this.serviceContainer.get<ICommandManager>(ICommandManager);
        const disposables = serviceContainer.get<IDisposableRegistry>(IDisposableRegistry);
        disposables.push(this);
        disposables.push(this.workspaceService.onDidChangeConfiguration(this.onDidChangeConfiguration.bind(this)));
        disposables.push(this.workspaceService.onDidChangeWorkspaceFolders(this.onWorkspaceFoldersChanged, this));
        disposables.push(this.interpreterService.onDidChangeInterpreter(this.onDidChangeInterpreter.bind(this)));
        disposables.push(
            commandManager.registerCommand(Commands.ClearAnalyisCache, this.onClearAnalysisCaches.bind(this)),
        );

        this.languageServerChangeHandler = new LanguageServerChangeHandler(
            this.getCurrentLanguageServerType(),
            this.serviceContainer.get<IExtensions>(IExtensions),
            this.serviceContainer.get<IApplicationShell>(IApplicationShell),
            this.serviceContainer.get<ICommandManager>(ICommandManager),
            this.workspaceService,
            this.configurationService,
        );
        disposables.push(this.languageServerChangeHandler);
    }

    public async activate(resource: Resource): Promise<void> {
        const stopWatch = new StopWatch();
        // Get a new server and dispose of the old one (might be the same one)
        this.resource = resource;
        const interpreter = await this.interpreterService.getActiveInterpreter(resource);
        const key = await this.getKey(resource, interpreter);

        // If we have an old server with a different key, then deactivate it as the
        // creation of the new server may fail if this server is still connected
        if (this.activatedServer && this.activatedServer.key !== key) {
            this.activatedServer.server.deactivate();
        }

        // Get the new item
        const result = await this.get(resource, interpreter);

        // Now we dispose. This ensures the object stays alive if it's the same object because
        // we dispose after we increment the ref count.
        if (this.activatedServer) {
            this.activatedServer.server.dispose();
        }

        // Save our active server.
        this.activatedServer = { key, server: result, jedi: result.type === LanguageServerType.Jedi };

        // Force this server to reconnect (if disconnected) as it should be the active
        // language server for all of VS code.
        this.activatedServer.server.activate();
        sendTelemetryEvent(EventName.PYTHON_LANGUAGE_SERVER_STARTUP_DURATION, stopWatch.elapsedTime, {
            languageServerType: result.type,
        });
    }

    public async get(resource: Resource, interpreter?: PythonEnvironment): Promise<RefCountedLanguageServer> {
        // See if we already have it or not
        const key = await this.getKey(resource, interpreter);
        let result: Promise<RefCountedLanguageServer> | undefined = this.cache.get(key);
        if (!result) {
            // Create a special ref counted result so we don't dispose of the
            // server too soon.
            result = this.createRefCountedServer(resource, interpreter, key);
            this.cache.set(key, result);
        } else {
            // Increment ref count if already exists.
            result = result.then((r) => {
                r.increment();
                return r;
            });
        }
        return result;
    }

    public dispose(): void {
        if (this.activatedServer) {
            this.activatedServer.server.dispose();
        }
    }

    @swallowExceptions('Send telemetry for language server current selection')
    public async sendTelemetryForChosenLanguageServer(languageServer: LanguageServerType): Promise<void> {
        const state = this.stateFactory.createGlobalPersistentState<LanguageServerType | undefined>(
            'SWITCH_LS',
            undefined,
        );
        if (typeof state.value !== 'string') {
            await state.updateValue(languageServer);
        }
        if (state.value !== languageServer) {
            await state.updateValue(languageServer);
            sendTelemetryEvent(EventName.PYTHON_LANGUAGE_SERVER_CURRENT_SELECTION, undefined, {
                switchTo: languageServer,
            });
        } else {
            sendTelemetryEvent(EventName.PYTHON_LANGUAGE_SERVER_CURRENT_SELECTION, undefined, {
                lsStartup: languageServer,
            });
        }
    }

    /**
     * Checks if user does not have any `languageServer` setting set.
     * @param resource
     * @returns `true` if user is using default configuration, `false` if user has `languageServer` setting added.
     */
    public isJediUsingDefaultConfiguration(resource: Resource): boolean {
        const settings = this.workspaceService
            .getConfiguration('python', resource)
            .inspect<LanguageServerType>('languageServer');
        if (!settings) {
            traceError('WorkspaceConfiguration.inspect returns `undefined` for setting `python.languageServer`');
            return false;
        }
        return (
            settings.globalValue === undefined &&
            settings.workspaceValue === undefined &&
            settings.workspaceFolderValue === undefined
        );
    }

    protected async onWorkspaceFoldersChanged(): Promise<void> {
        // If an activated workspace folder was removed, dispose its activator
        const workspaceKeys = await Promise.all(
            this.workspaceService.workspaceFolders!.map((workspaceFolder) => this.getKey(workspaceFolder.uri)),
        );
        const activatedWkspcKeys = Array.from(this.cache.keys());
        const activatedWkspcFoldersRemoved = activatedWkspcKeys.filter((item) => workspaceKeys.indexOf(item) < 0);
        if (activatedWkspcFoldersRemoved.length > 0) {
            for (const folder of activatedWkspcFoldersRemoved) {
                const server = await this.cache.get(folder);
                server?.dispose(); // This should remove it from the cache if this is the last instance.
            }
        }
    }

    private async onDidChangeInterpreter() {
        // Reactivate the resource. It should destroy the old one if it's different.
        return this.activate(this.resource);
    }

    private getCurrentLanguageServerType(): LanguageServerType {
        const configurationService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        return configurationService.getSettings(this.resource).languageServer;
    }

    private getCurrentLanguageServerTypeIsDefault(): boolean {
        const configurationService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        return configurationService.getSettings(this.resource).languageServerIsDefault;
    }

    private async createRefCountedServer(
        resource: Resource,
        interpreter: PythonEnvironment | undefined,
        key: string,
    ): Promise<RefCountedLanguageServer> {
        let serverType = this.getCurrentLanguageServerType();

        if (serverType === LanguageServerType.Microsoft) {
            const lsNotSupportedDiagnosticService = this.serviceContainer.get<IDiagnosticsService>(
                IDiagnosticsService,
                LSNotSupportedDiagnosticServiceId,
            );
            const diagnostic = await lsNotSupportedDiagnosticService.diagnose(undefined);
            lsNotSupportedDiagnosticService.handle(diagnostic).ignoreErrors();
            if (diagnostic.length) {
                sendTelemetryEvent(EventName.PYTHON_LANGUAGE_SERVER_PLATFORM_SUPPORTED, undefined, {
                    supported: false,
                });
                serverType = LanguageServerType.Jedi;
            }
        }

        // If the interpreter is Python 2 and the LS setting is explicitly set to Jedi, turn it off.
        // If set to Default, use Pylance.
        if (interpreter && (interpreter.version?.major ?? 0) < 3) {
            if (serverType === LanguageServerType.Jedi) {
                serverType = LanguageServerType.None;
            } else if (this.getCurrentLanguageServerTypeIsDefault()) {
                serverType = LanguageServerType.Node;
            }
        }

        this.sendTelemetryForChosenLanguageServer(serverType).ignoreErrors();

        await this.logStartup(serverType);
        let server = this.serviceContainer.get<ILanguageServerActivator>(ILanguageServerActivator, serverType);
        try {
            await server.start(resource, interpreter);
        } catch (ex) {
            if (serverType === LanguageServerType.Jedi) {
                throw ex;
            }
            traceError(ex);
            this.output.appendLine(LanguageService.lsFailedToStart());
            serverType = LanguageServerType.Jedi;
            server = this.serviceContainer.get<ILanguageServerActivator>(ILanguageServerActivator, serverType);
            await server.start(resource, interpreter);
        }

        // Wrap the returned server in something that ref counts it.
        return new RefCountedLanguageServer(server, serverType, () => {
            // When we finally remove the last ref count, remove from the cache
            this.cache.delete(key);

            // Dispose of the actual server.
            server.dispose();
        });
    }

    private async logStartup(serverType: LanguageServerType): Promise<void> {
        let outputLine;
        switch (serverType) {
            case LanguageServerType.Jedi:
                outputLine = LanguageService.startingJedi();
                break;
            case LanguageServerType.JediLSP:
                outputLine = LanguageService.startingJediLSP();
                break;
            case LanguageServerType.Microsoft:
                outputLine = LanguageService.startingMicrosoft();
                break;
            case LanguageServerType.Node:
                outputLine = LanguageService.startingPylance();
                break;
            case LanguageServerType.None:
                outputLine = LanguageService.startingNone();
                break;
            default:
                throw new Error('Unknown language server type in activator.');
        }
        this.output.appendLine(outputLine);
    }

    private async onDidChangeConfiguration(event: ConfigurationChangeEvent): Promise<void> {
        const workspacesUris: (Uri | undefined)[] = this.workspaceService.hasWorkspaceFolders
            ? this.workspaceService.workspaceFolders!.map((workspace) => workspace.uri)
            : [undefined];
        if (
            workspacesUris.findIndex((uri) => event.affectsConfiguration(`python.${languageServerSetting}`, uri)) === -1
        ) {
            return;
        }
        const lsType = this.getCurrentLanguageServerType();
        if (this.activatedServer?.key !== lsType) {
            await this.languageServerChangeHandler.handleLanguageServerChange(lsType);
        }
    }

    private async getKey(resource: Resource, interpreter?: PythonEnvironment): Promise<string> {
        const configurationService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        const serverType = configurationService.getSettings(this.resource).languageServer;
        if (serverType === LanguageServerType.Node) {
            return LanguageServerType.Node;
        }

        const resourcePortion = this.workspaceService.getWorkspaceFolderIdentifier(
            resource,
            workspacePathNameForGlobalWorkspaces,
        );
        interpreter = interpreter || (await this.interpreterService.getActiveInterpreter(resource));
        const interperterPortion = interpreter ? `${interpreter.path}-${interpreter.envName}` : '';
        return `${resourcePortion}-${interperterPortion}`;
    }

    private async onClearAnalysisCaches() {
        const values = await Promise.all([...this.cache.values()]);
        values.forEach((v) => (v.clearAnalysisCache ? v.clearAnalysisCache() : noop()));
    }
}
