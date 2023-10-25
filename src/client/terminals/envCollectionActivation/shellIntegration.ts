import { TerminalShellType } from '../../common/terminal/types';

/**
 * This is a list of shells which support shell integration:
 * https://code.visualstudio.com/docs/terminal/shell-integration
 */
export const ShellIntegrationShells = [
    TerminalShellType.commandPrompt, // Shell integration is not supported, but is also not needed to activate the env.
    TerminalShellType.powershell,
    TerminalShellType.powershellCore,
    TerminalShellType.bash,
    TerminalShellType.zsh,
    TerminalShellType.fish,
];
