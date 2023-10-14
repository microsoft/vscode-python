// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { _SCRIPTS_DIR } from '../../common/process/internal/scripts/constants';
import { TerminalShellType } from '../../common/terminal/types';

type ShellScripts = {
    /**
     * Source deactivate script to copy.
     */
    source: string;
    /**
     * Destination to copy deactivate script to.
     */
    destination: string;
    /**
     * Path to init script for the shell.
     */
    initScriptPath: string;
    /**
     * Contents to add to init script.
     */
    initContents: string;
};

// eslint-disable-next-line global-require
const untildify: (value: string) => string = require('untildify');

export function getScriptsForShell(shellType: TerminalShellType): ShellScripts | undefined {
    switch (shellType) {
        case TerminalShellType.bash:
            return {
                source: path.join(_SCRIPTS_DIR, 'deactivate'),
                destination: untildify('~/.vscode-python/deactivate'),
                initScriptPath: untildify(`~/.bashrc`),
                initContents: `source ~/.vscode-python/deactivate`,
            };
        case TerminalShellType.powershell:
            return {
                source: path.join(_SCRIPTS_DIR, 'deactivate.ps1'),
                destination: untildify('~/.vscode-python/deactivate.ps1'),
                initScriptPath: '$Profile',
                initContents: `source ~/.vscode-python/deactivate.ps1`,
            };
        case TerminalShellType.zsh:
            return {
                source: path.join(_SCRIPTS_DIR, 'deactivate'),
                destination: untildify('~/.vscode-python/deactivate'),
                initScriptPath: untildify(`~/.zshrc`),
                initContents: `source ~/.vscode-python/deactivate`,
            };
        case TerminalShellType.fish:
            return {
                source: path.join(_SCRIPTS_DIR, 'deactivate.fish'),
                destination: untildify('~/.vscode-python/deactivate.fish'),
                initScriptPath: '$__fish_config_dir/config.fish',
                initContents: `source ~/.vscode-python/deactivate.fish`,
            };
        case TerminalShellType.cshell:
            return {
                source: path.join(_SCRIPTS_DIR, 'deactivate.csh'),
                destination: untildify('~/.vscode-python/deactivate.csh'),
                initScriptPath: untildify(`~/.cshrc`),
                initContents: `source ~/.vscode-python/deactivate.csh`,
            };
        default:
            return undefined;
    }
}
