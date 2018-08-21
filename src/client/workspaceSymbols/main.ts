import { Disposable, languages, OutputChannel, workspace } from 'vscode';
import { STANDARD_OUTPUT_CHANNEL } from '../common/constants';
import { IProcessServiceFactory } from '../common/process/types';
import { IOutputChannel } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { Generator } from './generator';
import { WorkspaceSymbolProvider } from './provider';

export class WorkspaceSymbols implements Disposable {
    private disposables: Disposable[];
    private generators: Generator[] = [];
    private readonly outputChannel: OutputChannel;
    constructor(private serviceContainer: IServiceContainer) {
        this.outputChannel = this.serviceContainer.get<OutputChannel>(IOutputChannel, STANDARD_OUTPUT_CHANNEL);
        this.disposables = [];
        this.disposables.push(this.outputChannel);
        this.initializeGenerators();
        languages.registerWorkspaceSymbolProvider(new WorkspaceSymbolProvider(this.generators));
        this.disposables.push(workspace.onDidChangeWorkspaceFolders(() => this.initializeGenerators()));
    }
    public dispose() {
        this.disposables.forEach(d => d.dispose());
    }
    private initializeGenerators() {
        while (this.generators.length > 0) {
            const generator = this.generators.shift()!;
            generator.dispose();
        }

        if (Array.isArray(workspace.workspaceFolders)) {
            workspace.workspaceFolders.forEach(wkSpc => {
                const processServiceFactory = this.serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory);
                this.generators.push(new Generator(wkSpc.uri, this.outputChannel, processServiceFactory));
            });
        }
    }
}
