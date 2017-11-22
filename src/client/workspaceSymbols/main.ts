import * as vscode from 'vscode';
import { workspace } from 'vscode';
import { Commands, PythonLanguage } from '../common/constants';
import { isNotInstalledError } from '../common/helpers';
import { Installer, InstallerResponse, Product } from '../common/installer';
import { fsExistsAsync } from '../common/utils';
import { Generator } from './generator';
import { WorkspaceSymbolProvider } from './provider';

const MAX_NUMBER_OF_ATTEMPTS_TO_INSTALL_AND_BUILD = 2;

export class WorkspaceSymbols implements vscode.Disposable {
    private disposables: vscode.Disposable[];
    private generators: Generator[] = [];
    private installer: Installer;
    // tslint:disable-next-line:no-any
    private timeout: any;
    constructor(private outputChannel: vscode.OutputChannel) {
        this.disposables = [];
        this.disposables.push(this.outputChannel);
        this.installer = new Installer();
        this.disposables.push(this.installer);
        this.registerCommands();
        this.initializeGenerators();
        vscode.languages.registerWorkspaceSymbolProvider(new WorkspaceSymbolProvider(this.generators, this.outputChannel));
        this.disposables.push(vscode.workspace.onDidChangeWorkspaceFolders(() => this.initializeGenerators()));
    }
    public dispose() {
        this.disposables.forEach(d => d.dispose());
    }
    private initializeGenerators() {
        while (this.generators.length > 0) {
            const generator = this.generators.shift()!;
            generator.dispose();
        }

        if (Array.isArray(vscode.workspace.workspaceFolders)) {
            vscode.workspace.workspaceFolders.forEach(wkSpc => {
                this.generators.push(new Generator(wkSpc.uri, this.outputChannel));
            });
        }
    }
    private registerCommands() {
        this.disposables.push(vscode.commands.registerCommand(Commands.Build_Workspace_Symbols, async (rebuild: boolean = true, token?: vscode.CancellationToken) => {
            const promises = this.buildWorkspaceSymbols(rebuild, token);
            return Promise.all(promises);
        }));
    }
    private registerOnSaveHandlers() {
        this.disposables.push(vscode.workspace.onDidSaveTextDocument(this.onDidSaveTextDocument.bind(this)));
    }
    private onDidSaveTextDocument(textDocument: vscode.TextDocument) {
        if (textDocument.languageId === PythonLanguage.language) {
            this.rebuildTags();
        }
    }
    private rebuildTags() {
        if (this.timeout) {
            clearTimeout(this.timeout!);
            this.timeout = null;
        }
        this.timeout = setTimeout(() => {
            this.buildWorkspaceSymbols(true);
        }, 5000);
    }
    // tslint:disable-next-line:no-any
    private buildWorkspaceSymbols(rebuild: boolean = true, token?: vscode.CancellationToken): Promise<any>[] {
        if (token && token.isCancellationRequested) {
            return [];
        }
        if (this.generators.length === 0) {
            return [];
        }

        let promptPromise: Promise<InstallerResponse>;
        let promptResponse: InstallerResponse;
        return this.generators.map(async generator => {
            if (!generator.enabled) {
                return;
            }
            const exists = await fsExistsAsync(generator.tagFilePath);
            // If file doesn't exist, then run the ctag generator,
            // or check if required to rebuild.
            if (!rebuild && exists) {
                return;
            }
            for (let counter = 0; counter < MAX_NUMBER_OF_ATTEMPTS_TO_INSTALL_AND_BUILD; counter += 1) {
                try {
                    await generator.generateWorkspaceTags();
                    return;
                } catch (error) {
                    if (!isNotInstalledError(error)) {
                        this.outputChannel.show();
                        return;
                    }
                }
                if (!token || token.isCancellationRequested) {
                    return;
                }
                // Display prompt once for all workspaces.
                if (promptPromise) {
                    promptResponse = await promptPromise;
                    continue;
                } else {
                    promptPromise = this.installer.promptToInstall(Product.ctags, workspace.workspaceFolders[0]!.uri);
                    promptResponse = await promptPromise;
                }
                if (promptResponse !== InstallerResponse.Installed || (!token || token.isCancellationRequested)) {
                    return;
                }
            }
        });
    }
}
