// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import * as fs from 'fs-extra';
import { injectable } from 'inversify';
import { CancellationToken, DebugConfiguration, WorkspaceFolder } from 'vscode';
import { IDynamicDebugConfigurationService } from '../types';
import { DebuggerTypeName } from '../../constants';
import { asyncFilter } from '../../../common/utils/arrayUtils';
import { replaceAll } from '../../../common/stringUtils';

const workspaceFolderToken = '${workspaceFolder}';

@injectable()
export class DynamicPythonDebugConfigurationService implements IDynamicDebugConfigurationService {
    // eslint-disable-next-line class-methods-use-this
    public async provideDebugConfigurations(
        folder: WorkspaceFolder,
        _token?: CancellationToken,
    ): Promise<DebugConfiguration[] | undefined> {
        const providers = [];

        providers.push({
            name: 'Python: File',
            type: DebuggerTypeName,
            request: 'launch',
            program: '${file}',
            justMyCode: true,
        });

        const djangoManagePath = await DynamicPythonDebugConfigurationService.getDjangoPath(folder);
        if (djangoManagePath) {
            providers.push({
                name: 'Python: Django',
                type: DebuggerTypeName,
                request: 'launch',
                program: `${workspaceFolderToken}${path.sep}${djangoManagePath}`,
                args: ['runserver'],
                django: true,
                justMyCode: true,
            });
        }

        const flaskPath = await DynamicPythonDebugConfigurationService.getFlaskPath(folder);
        if (flaskPath) {
            providers.push({
                name: 'Python: Flask',
                type: DebuggerTypeName,
                request: 'launch',
                module: 'flask',
                env: {
                    FLASK_APP: path.relative(folder.uri.fsPath, flaskPath),
                    FLASK_DEBUG: '1',
                },
                args: ['run', '--no-debugger', '--no-reload'],
                jinja: true,
                justMyCode: true,
            });
        }

        let fastApiPath = await DynamicPythonDebugConfigurationService.getFastApiPath(folder);
        if (fastApiPath) {
            fastApiPath = replaceAll(path.relative(folder.uri.fsPath, fastApiPath), path.sep, '.').replace('.py', '');
            providers.push({
                name: 'Python: FastAPI',
                type: DebuggerTypeName,
                request: 'launch',
                module: 'uvicorn',
                args: [`${fastApiPath}:app`],
                jinja: true,
                justMyCode: true,
            });
        }

        return providers;
    }

    private static async getDjangoPath(folder: WorkspaceFolder) {
        const regExpression = /execute_from_command_line\(/;
        const possiblePaths = await DynamicPythonDebugConfigurationService.getPossiblePaths(
            folder,
            ['manage.py', '*/manage.py', 'app.py', '*/app.py'],
            regExpression,
        );
        return possiblePaths.length ? path.relative(folder.uri.fsPath, possiblePaths[0]) : null;
    }

    private static async getFastApiPath(folder: WorkspaceFolder) {
        const regExpression = /app\s*=\s*FastAPI\(/;
        const fastApiPaths = await DynamicPythonDebugConfigurationService.getPossiblePaths(
            folder,
            ['main.py', 'app.py', '*/main.py', '*/app.py', '*/*/main.py', '*/*/app.py'],
            regExpression,
        );

        return fastApiPaths.length ? fastApiPaths[0] : null;
    }

    private static async getFlaskPath(folder: WorkspaceFolder) {
        const regExpression = /app(?:lication)?\s*=\s*(?:flask\.)?Flask\(|def\s+(?:create|make)_app\(/;
        const flaskPaths = await DynamicPythonDebugConfigurationService.getPossiblePaths(
            folder,
            ['__init__.py', 'app.py', 'wsgi.py', '*/__init__.py', '*/app.py', '*/wsgi.py'],
            regExpression,
        );

        return flaskPaths.length ? flaskPaths[0] : null;
    }

    private static async getPossiblePaths(
        folder: WorkspaceFolder,
        globPatterns: string[],
        regex: RegExp,
    ): Promise<string[]> {
        const foundPathsPromises = (await Promise.allSettled(
            globPatterns.map(
                async (pattern): Promise<string[]> =>
                    (await fs.pathExists(path.join(folder.uri.fsPath, pattern)))
                        ? [path.join(folder.uri.fsPath, pattern)]
                        : [],
            ),
        )) as { status: string; value: [] }[];
        const possiblePaths: string[] = [];
        foundPathsPromises.forEach((result) => possiblePaths.push(...result.value));
        const finalPaths = await asyncFilter(possiblePaths, async (possiblePath) =>
            regex.exec((await fs.readFile(possiblePath)).toString()),
        );

        return finalPaths;
    }
}
