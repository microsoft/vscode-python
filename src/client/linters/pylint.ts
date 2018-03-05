
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as os from 'os';
import * as path from 'path';
import { OutputChannel } from 'vscode';
import { CancellationToken, TextDocument } from 'vscode';
import { IFileSystem, IPlatformService } from '../common/platform/types';
import { Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { BaseLinter } from './baseLinter';
import { ILintMessage } from './types';

const pylintrc = 'pylintrc';
const dotPylintrc = '.pylintrc';

export class Pylint extends BaseLinter {
    private fileSystem: IFileSystem;
    private platformService: IPlatformService;

    constructor(outputChannel: OutputChannel, serviceContainer: IServiceContainer) {
        super(Product.pylint, outputChannel, serviceContainer);
        this.fileSystem = serviceContainer.get<IFileSystem>(IFileSystem);
        this.platformService = serviceContainer.get<IPlatformService>(IPlatformService);
    }

    protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
        let minArgs: string[] = [];
        // Only use minimal checkers if
        //  a) there are no custom arguments and
        //  b) there is no pylintrc file next to the file or at the workspace root
        const uri = document.uri;
        const workspaceRoot = this.getWorkspaceRootPath(document);
        const settings = this.configService.getSettings(uri);
        if (settings.linting.pylintUseMinimalCheckers
            && this.info.linterArgs(uri).length === 0
            // Check pylintrc next to the file or above up to and including the workspace root
            && !await Pylint.hasConfigrationFileInWorkspace(this.fileSystem, path.dirname(uri.fsPath), workspaceRoot)
            // Check for pylintrc at the root and above
            && !await Pylint.hasConfigurationFile(this.fileSystem, this.getWorkspaceRootPath(document), this.platformService)) {
            minArgs = [
                '--disable=all',
                '--enable=F,E,unreachable,duplicate-key,unnecessary-semicolon,global-variable-not-assigned,unused-variable,unused-wildcard-import,binary-op-exception,bad-format-string,anomalous-backslash-in-string,bad-open-mode',
                '–-disable=print-statement'
            ];
        }
        const args = [
            '--msg-template=\'{line},{column},{category},{msg_id}:{msg}\'',
            '--reports=n',
            '--output-format=text',
            uri.fsPath
        ];
        const messages = await this.run(minArgs.concat(args), document, cancellation);
        messages.forEach(msg => {
            msg.severity = this.parseMessagesSeverity(msg.type, this.pythonSettings.linting.pylintCategorySeverity);
        });

        return messages;
    }

    // tslint:disable-next-line:member-ordering
    public static async hasConfigurationFile(fs: IFileSystem, folder: string, platformService: IPlatformService): Promise<boolean> {
        // https://pylint.readthedocs.io/en/latest/user_guide/run.html
        // https://github.com/PyCQA/pylint/blob/975e08148c0faa79958b459303c47be1a2e1500a/pylint/config.py
        // 1. pylintrc in the current working directory
        // 2. .pylintrc in the current working directory
        // 3. If the current working directory is in a Python module, Pylint searches
        //    up the hierarchy of Python modules until it finds a pylintrc file.
        //    This allows you to specify coding standards on a module by module basis.
        //    A directory is judged to be a Python module if it contains an __init__.py file.
        // 4. The file named by environment variable PYLINTRC
        // 5. if you have a home directory which isn’t /root:
        //      a) .pylintrc in your home directory
        //      b) .config/pylintrc in your home directory
        // 6. /etc/pylintrc
        if (process.env.PYLINTRC) {
            return true;
        }

        if (await fs.fileExistsAsync(path.join(folder, pylintrc)) || await fs.fileExistsAsync(path.join(folder, dotPylintrc))) {
            return true;
        }

        let current = folder;
        let above = path.dirname(folder);
        do {
            if (!await fs.fileExistsAsync(path.join(current, '__init__.py'))) {
                break;
            }
            if (await fs.fileExistsAsync(path.join(current, pylintrc)) || await fs.fileExistsAsync(path.join(current, dotPylintrc))) {
                return true;
            }
            current = above;
            above = path.dirname(above);
        } while (!fs.arePathsSame(current, above));

        const home = os.homedir();
        if (await fs.fileExistsAsync(path.join(home, dotPylintrc))) {
            return true;
        }
        if (await fs.fileExistsAsync(path.join(home, '.config', pylintrc))) {
            return true;
        }

        if (!platformService.isWindows) {
            if (await fs.fileExistsAsync(path.join('/etc', pylintrc))) {
                return true;
            }
        }
        return false;
    }

    // tslint:disable-next-line:member-ordering
    public static async hasConfigrationFileInWorkspace(fs: IFileSystem, folder: string, root: string): Promise<boolean> {
        // Search up from file location to the workspace root
        let current = folder;
        let above = path.dirname(current);
        do {
            if (await fs.fileExistsAsync(path.join(current, pylintrc)) || await fs.fileExistsAsync(path.join(current, dotPylintrc))) {
                return true;
            }
            current = above;
            above = path.dirname(above);
        } while (!fs.arePathsSame(current, root) && !fs.arePathsSame(current, above));
        return false;
    }
}
