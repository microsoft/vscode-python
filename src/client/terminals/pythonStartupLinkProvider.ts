/* eslint-disable class-methods-use-this */
import {
    CancellationToken,
    Disposable,
    ProviderResult,
    TerminalLink,
    TerminalLinkContext,
    TerminalLinkProvider,
    l10n,
} from 'vscode';
import { executeCommand } from '../common/vscodeApis/commandApis';
import { registerTerminalLinkProvider } from '../common/vscodeApis/windowApis';

interface CustomTerminalLink extends TerminalLink {
    command: string;
}

export class CustomTerminalLinkProvider implements TerminalLinkProvider<CustomTerminalLink> {
    provideTerminalLinks(
        context: TerminalLinkContext,
        _token: CancellationToken,
    ): ProviderResult<CustomTerminalLink[]> {
        const links: CustomTerminalLink[] = [];
        // Question: What if context.line is truncated because of user zoom setting?
        // Meaning what if this line is separated into two+ line in terminal?
        const expectedNativeLink = 'VS Code Native REPL';

        // eslint-disable-next-line no-cond-assign
        if (context.line.includes(expectedNativeLink)) {
            links.push({
                startIndex: context.line.indexOf(expectedNativeLink),
                length: expectedNativeLink.length,
                tooltip: l10n.t('Launch VS Code Native REPL'),
                command: 'python.startNativeREPL',
            });
        }
        return links;
    }

    async handleTerminalLink(link: CustomTerminalLink): Promise<void> {
        await executeCommand(link.command);
    }
}

export function registerCustomTerminalLinkProvider(disposables: Disposable[]): void {
    disposables.push(registerTerminalLinkProvider(new CustomTerminalLinkProvider()));
}
