/* eslint-disable class-methods-use-this */
import * as vscode from 'vscode';
import { executeCommand } from '../common/vscodeApis/commandApis';

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
        // Question: What if context.line is truncated because of user zoom setting?
        // Meaning what if this line is separated into two+ line in terminal?
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

    async handleTerminalLink(link: CustomTerminalLink): Promise<void> {
        await executeCommand(link.command);
    }
}
