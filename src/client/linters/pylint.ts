// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as os from 'os';
import * as path from 'path';
import { CancellationToken, OutputChannel, TextDocument } from 'vscode';
import '../common/extensions';
import { IFileSystem, IPlatformService } from '../common/platform/types';
import { Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { BaseLinter } from './baseLinter';
import { ILintMessage } from './types';

const pylintrc = 'pylintrc';
const dotPylintrc = '.pylintrc';

const REGEX = '(?<line>\\d+),(?<column>-?\\d+),(?<type>\\w+),(?<code>[\\w-]+):(?<message>.*)\\r?(\\n|$)';

export class Pylint extends BaseLinter {
    constructor(outputChannel: OutputChannel, serviceContainer: IServiceContainer) {
        super(Product.pylint, outputChannel, serviceContainer);
    }

    protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
        const uri = document.uri;
        const settings = this.configService.getSettings(uri);
        const args = [
            "--msg-template='{line},{column},{category},{symbol}:{msg}'",
            '--reports=n',
            '--output-format=text',
            uri.fsPath,
        ];
        const messages = await this.run(args, document, cancellation, REGEX);
        messages.forEach((msg) => {
            msg.severity = this.parseMessagesSeverity(msg.type, settings.linting.pylintCategorySeverity);
        });

        return messages;
    }

    public static async hasConfigurationFile(
        fs: IFileSystem,
        folder: string,
        platformService: IPlatformService,
    ): Promise<boolean> {
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

        if (
            (await fs.fileExists(path.join(folder, pylintrc))) ||
            (await fs.fileExists(path.join(folder, dotPylintrc)))
        ) {
            return true;
        }

        let current = folder;
        let above = path.dirname(folder);
        do {
            if (!(await fs.fileExists(path.join(current, '__init__.py')))) {
                break;
            }
            if (
                (await fs.fileExists(path.join(current, pylintrc))) ||
                (await fs.fileExists(path.join(current, dotPylintrc)))
            ) {
                return true;
            }
            current = above;
            above = path.dirname(above);
        } while (!fs.arePathsSame(current, above));

        const home = os.homedir();
        if (await fs.fileExists(path.join(home, dotPylintrc))) {
            return true;
        }
        if (await fs.fileExists(path.join(home, '.config', pylintrc))) {
            return true;
        }

        if (!platformService.isWindows) {
            if (await fs.fileExists(path.join('/etc', pylintrc))) {
                return true;
            }
        }
        return false;
    }

    public static async hasConfigurationFileInWorkspace(
        fs: IFileSystem,
        folder: string,
        root: string,
    ): Promise<boolean> {
        // Search up from file location to the workspace root
        let current = folder;
        let above = path.dirname(current);
        do {
            if (
                (await fs.fileExists(path.join(current, pylintrc))) ||
                (await fs.fileExists(path.join(current, dotPylintrc)))
            ) {
                return true;
            }
            current = above;
            above = path.dirname(above);
        } while (!fs.arePathsSame(current, root) && !fs.arePathsSame(current, above));
        return false;
    }
}
