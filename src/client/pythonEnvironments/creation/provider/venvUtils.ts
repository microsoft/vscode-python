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
import { traceError, traceInfo, traceVerbose } from '../../../logging';

const exclude = '**/{.venv*,.git,.nox,.tox,.conda,site-packages,__pypackages__}/**';
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

function tomlParse(content: string): tomljs.JsonMap {
    try {
        return tomljs.parse(content);
    } catch (err) {
        traceError('Failed to parse `pyproject.toml`:', err);
    }
    return {};
}

function tomlHasBuildSystem(toml: tomljs.JsonMap): boolean {
    return toml['build-system'] !== undefined;
}

function getTomlOptionalDeps(toml: tomljs.JsonMap): string[] {
    const extras: string[] = [];
    if (toml.project && (toml.project as tomljs.JsonMap)['optional-dependencies']) {
        const deps = (toml.project as tomljs.JsonMap)['optional-dependencies'];
        for (const key of Object.keys(deps)) {
            extras.push(key);
        }
    }
    return extras;
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

    let extras: string[] = [];
    let tomlExists = false;
    let hasBuildSystem = false;
    if (await fs.pathExists(tomlPath)) {
        tomlExists = true;
        const toml = tomlParse(await fs.readFile(tomlPath, 'utf-8'));
        extras = getTomlOptionalDeps(toml);
        hasBuildSystem = tomlHasBuildSystem(toml);
    }

    if (tomlExists && hasBuildSystem) {
        if (extras.length === 0) {
            return { installType: 'toml', installList: [], source: tomlPath };
        }
        traceVerbose('Found toml with optional dependencies.');
        const installList = await pickTomlExtras(extras, token);
        if (installList) {
            return { installType: 'toml', installList, source: tomlPath };
        }
        return undefined;
    }
    if (tomlExists) {
        traceInfo('Create env: Found toml without optional dependencies or build system.');
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
