/* eslint-disable class-methods-use-this */
import * as vscode from 'vscode';

interface CustomTerminalLink extends vscode.TerminalLink {
    command: string;
}

export class CustomTerminalLinkProvider implements vscode.TerminalLinkProvider<CustomTerminalLink> {
    // TODO: How should I properly add this to disposables?
    // Need advice, do not want to cause memory leak.

    // private disposable: Disposable;

    // constructor() {
    //     this.disposable = window.registerTerminalLinkProvider(this);
    // }

    // dispose(): void {
    //     this.disposable.dispose();
    // }

    provideTerminalLinks(
        context: vscode.TerminalLinkContext,
        _token: vscode.CancellationToken,
    ): vscode.ProviderResult<CustomTerminalLink[]> {
        const links: CustomTerminalLink[] = [];
        const expectedNativeLink = 'this is link to launch native repl';

        // eslint-disable-next-line no-cond-assign
        if (context.line === expectedNativeLink) {
            links.push({
                startIndex: 0,
                length: expectedNativeLink.length,
                tooltip: 'Launch Native REPL',
                command: 'python.startNativeREPL',
            });
        }
        return links;
    }

    handleTerminalLink(link: CustomTerminalLink): vscode.ProviderResult<void> {
        // TODO: probably dont use vscode.commands directly?
        vscode.commands.executeCommand(link.command);
    }
}
