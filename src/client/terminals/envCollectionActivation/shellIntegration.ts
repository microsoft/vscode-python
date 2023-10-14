import { TerminalShellType } from '../../common/terminal/types';

/**
 * This is a list of shells which support shell integration:
 * https://code.visualstudio.com/docs/terminal/shell-integration
 */
export const ShellIntegrationShells = [
    TerminalShellType.powershell,
    TerminalShellType.powershellCore,
    TerminalShellType.bash,
    TerminalShellType.zsh,
    TerminalShellType.fish,
];
