import * as vscode from 'vscode';
import { Generator } from './generator';
import { Installer, InstallerResponse, Product } from '../common/installer';
import { fsExistsAsync } from '../common/utils';
import { isNotInstalledError } from '../common/helpers';
import { PythonLanguage, Commands } from '../common/constants';
import { WorkspaceSymbolProvider } from './provider';
import { workspace } from 'vscode';

const MAX_NUMBER_OF_ATTEMPTS_TO_INSTALL_AND_BUILD = 2;

export class WorkspaceSymbols implements vscode.Disposable {
    private disposables: vscode.Disposable[];
    private generators: Generator[] = [];
    private installer: Installer;
    constructor(private outputChannel: vscode.OutputChannel) {
        this.disposables = [];
        this.disposables.push(this.outputChannel);
        this.installer = new Installer();
        this.disposables.push(this.installer);
        this.registerCommands();
        this.initializeGenerators();
        vscode.languages.registerWorkspaceSymbolProvider(new WorkspaceSymbolProvider(this.generators, this.outputChannel));
        this.buildWorkspaceSymbols(true);
        this.disposables.push(vscode.workspace.onDidChangeWorkspaceFolders(() => this.initializeGenerators()));
    }
    private initializeGenerators() {
        while (this.generators.length > 0) {
            const generator = this.generators.shift();
            generator.dispose();
        }

        if (Array.isArray(vscode.workspace.workspaceFolders)) {
            vscode.workspace.workspaceFolders.forEach(wkSpc => {
                this.generators.push(new Generator(wkSpc.uri, this.outputChannel));
            });
        }
    }
    registerCommands() {
        this.disposables.push(vscode.commands.registerCommand(Commands.Build_Workspace_Symbols, (rebuild: boolean = true, token?: vscode.CancellationToken) => {
            this.buildWorkspaceSymbols(rebuild, token);
        }));
    }
    registerOnSaveHandlers() {
        this.disposables.push(vscode.workspace.onDidSaveTextDocument(this.onDidSaveTextDocument.bind(this)));
    }
    onDidSaveTextDocument(textDocument: vscode.TextDocument) {
        if (textDocument.languageId === PythonLanguage.language) {
            this.rebuildTags();
        }
    }
    private timeout: number;
    rebuildTags() {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }
        this.timeout = setTimeout(() => {
            this.buildWorkspaceSymbols(true);
        }, 5000);
    }
    dispose() {
        this.disposables.forEach(d => d.dispose());
    }
    async buildWorkspaceSymbols(rebuild: boolean = true, token?: vscode.CancellationToken): Promise<any> {
        if (token && token.isCancellationRequested) {
            return Promise.resolve([]);
        }
        if (this.generators.length === 0) {
            return Promise.resolve([]);
        }

        let promptPromise: Promise<InstallerResponse>;
        let promptResponse: InstallerResponse;
        return this.generators.map(async generator => {
            if (!generator.enabled) {
                return;
            }
            const exists = await fsExistsAsync(generator.tagFilePath);
            // if file doesn't exist, then run the ctag generator
            // Or check if required to rebuild
            if (!rebuild && exists) {
                return;
            }
            for (let counter = 0; counter < MAX_NUMBER_OF_ATTEMPTS_TO_INSTALL_AND_BUILD; counter++) {
                try {
                    await generator.generateWorkspaceTags();
                    return;
                }
                catch (error) {
                    if (!isNotInstalledError(error)) {
                        this.outputChannel.show();
                        return;
                    }
                }
                if (!token || token.isCancellationRequested) {
                    return;
                }
                // Display prompt once for all workspaces
                if (promptPromise) {
                    promptResponse = await promptPromise;
                    continue;
                }
                else {
                    promptPromise = this.installer.promptToInstall(Product.ctags, workspace.workspaceFolders[0].uri);
                    promptResponse = await promptPromise;
                }
                if (promptResponse !== InstallerResponse.Installed || (!token || token.isCancellationRequested)) {
                    return;
                }
            }
        });
    }
}

