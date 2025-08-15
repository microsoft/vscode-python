/* eslint-disable class-methods-use-this */
import {
    CancellationToken,
    Disposable,
    ProviderResult,
    TerminalLink,
    TerminalLinkContext,
    TerminalLinkProvider,
} from 'vscode';
import { executeCommand } from '../common/vscodeApis/commandApis';
import { registerTerminalLinkProvider } from '../common/vscodeApis/windowApis';
import { getConfiguration } from '../common/vscodeApis/workspaceApis';
import { Repl } from '../common/utils/localize';

interface CustomTerminalLink extends TerminalLink {
    command: string;
}

/**
 * Gets the appropriate modifier key text for the Native REPL link based on the
 * editor.multiCursorModifier setting and platform.
 */
function getModifierKeyText(): string {
    const editorConfig = getConfiguration('editor');
    const multiCursorModifier = editorConfig.get<string>('multiCursorModifier', 'alt');

    if (multiCursorModifier === 'ctrlCmd') {
        // When multiCursorModifier is ctrlCmd, links use Alt/Option
        return process.platform === 'darwin' ? 'Option' : 'Alt';
    } else {
        // Default behavior: multiCursorModifier is alt, links use Ctrl/Cmd
        return process.platform === 'darwin' ? 'Cmd' : 'Ctrl';
    }
}

export class CustomTerminalLinkProvider implements TerminalLinkProvider<CustomTerminalLink> {
    provideTerminalLinks(
        context: TerminalLinkContext,
        _token: CancellationToken,
    ): ProviderResult<CustomTerminalLink[]> {
        const links: CustomTerminalLink[] = [];
        const modifierKey = getModifierKeyText();
        const expectedNativeLink = `${modifierKey} click to launch VS Code Native REPL`;

        if (context.line.includes(expectedNativeLink)) {
            links.push({
                startIndex: context.line.indexOf(expectedNativeLink),
                length: expectedNativeLink.length,
                tooltip: Repl.launchNativeRepl,
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
