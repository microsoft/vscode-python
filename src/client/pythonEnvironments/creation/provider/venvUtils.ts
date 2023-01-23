// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License

import * as tomljs from '@iarna/toml';
import * as fs from 'fs-extra';
import { flatten, isArray } from 'lodash';
import * as path from 'path';
import { CancellationToken, QuickPickItem, RelativePattern, WorkspaceFolder } from 'vscode';
import { CreateEnv } from '../../../common/utils/localize';
import { showQuickPick } from '../../../common/vscodeApis/windowApis';
import { findFiles } from '../../../common/vscodeApis/workspaceApis';
import { traceError, traceVerbose } from '../../../logging';

const exclude = '**/{.venv*,.git,.nox,.tox,.conda}/**';
async function getPipRequirementsFiles(
    workspaceFolder: WorkspaceFolder,
    token?: CancellationToken,
): Promise<string[] | undefined> {
    const files = flatten(
        await Promise.all([
            findFiles(new RelativePattern(workspaceFolder, '**/*requirement*.txt'), exclude, undefined, token),
            findFiles(new RelativePattern(workspaceFolder, '**/requirements/*.txt'), exclude, undefined, token),
        ]),
    ).map((u) => u.fsPath);
    return files;
}

async function getTomlOptionalDeps(tomlPath: string): Promise<string[] | undefined> {
    if (await fs.pathExists(tomlPath)) {
        const content = await fs.readFile(tomlPath, 'utf-8');
        const extras: string[] = [];
        try {
            const toml = tomljs.parse(content);
            if (toml.project && (toml.project as Record<string, Array<string>>)['optional-dependencies']) {
                const deps = (toml.project as Record<string, Record<string, Array<string>>>)['optional-dependencies'];
                for (const key of Object.keys(deps)) {
                    extras.push(key);
                }
            }
        } catch (err) {
            traceError('Failed to parse `pyproject.toml`:', err);
        }
        return extras;
    }
    return undefined;
}

async function pickTomlExtras(extras: string[], token?: CancellationToken): Promise<string[] | undefined> {
    const items: QuickPickItem[] = extras.map((e) => ({ label: e }));

    const selection = await showQuickPick(
        items,
        {
            placeHolder: CreateEnv.Venv.tomlExtrasQuickPickTitle,
            canPickMany: true,
            ignoreFocusOut: true,
        },
        token,
    );

    if (selection && isArray(selection)) {
        return selection.map((s) => s.label);
    }

    return undefined;
}

async function pickRequirementsFiles(files: string[], token?: CancellationToken): Promise<string[] | undefined> {
    const items: QuickPickItem[] = files
        .sort((a, b) => {
            const al: number = a.split(/[\\\/]/).length;
            const bl: number = b.split(/[\\\/]/).length;
            if (al === bl) {
                if (a.length === b.length) {
                    return a.localeCompare(b);
                }
                return a.length - b.length;
            }
            return al - bl;
        })
        .map((e) => ({ label: e }));

    const selection = await showQuickPick(
        items,
        {
            placeHolder: CreateEnv.Venv.requirementsQuickPickTitle,
            ignoreFocusOut: true,
            canPickMany: true,
        },
        token,
    );

    if (selection && isArray(selection)) {
        return selection.map((s) => s.label);
    }

    return undefined;
}

export interface IPackageInstallSelection {
    installType: 'toml' | 'requirements' | 'none';
    installList: string[];
    source?: string;
}

export async function pickPackagesToInstall(
    workspaceFolder: WorkspaceFolder,
    token?: CancellationToken,
): Promise<IPackageInstallSelection | undefined> {
    const tomlPath = path.join(workspaceFolder.uri.fsPath, 'pyproject.toml');
    traceVerbose(`Looking for toml pyproject.toml with optional dependencies at: ${tomlPath}`);
    const extras = await getTomlOptionalDeps(tomlPath);

    if (extras && extras.length > 0) {
        traceVerbose('Found toml with optional dependencies.');
        const installList = await pickTomlExtras(extras, token);
        if (installList) {
            return { installType: 'toml', installList, source: tomlPath };
        }
        return undefined;
    }

    traceVerbose('Looking for pip requirements.');
    const requirementFiles = (await getPipRequirementsFiles(workspaceFolder, token))?.map((p) =>
        path.relative(workspaceFolder.uri.fsPath, p),
    );

    if (requirementFiles && requirementFiles.length > 0) {
        traceVerbose('Found pip requirements.');
        const installList = (await pickRequirementsFiles(requirementFiles, token))?.map((p) =>
            path.join(workspaceFolder.uri.fsPath, p),
        );
        if (installList) {
            return { installType: 'requirements', installList };
        }
        return undefined;
    }

    return { installType: 'none', installList: [] };
}
