// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License

import * as tomljs from '@iarna/toml';
import * as fs from 'fs-extra';
import { flatten, isArray } from 'lodash';
import * as path from 'path';
import { CancellationToken, QuickPickItem, RelativePattern, WorkspaceFolder } from 'vscode';
import { CreateEnv } from '../../../common/utils/localize';
import { MultiStepAction, MultiStepNode, showQuickPickWithBack } from '../../../common/vscodeApis/windowApis';
import { findFiles } from '../../../common/vscodeApis/workspaceApis';
import { traceError, traceVerbose } from '../../../logging';

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

    const selection = await showQuickPickWithBack(
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

    const selection = await showQuickPickWithBack(
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

export function isPipInstallableToml(tomlContent: string): boolean {
    const toml = tomlParse(tomlContent);
    return tomlHasBuildSystem(toml);
}

export interface IPackageInstallSelection {
    installType: 'toml' | 'requirements' | 'none';
    installItem?: string;
    source?: string;
}

export async function pickPackagesToInstall(
    workspaceFolder: WorkspaceFolder,
    token?: CancellationToken,
): Promise<IPackageInstallSelection[] | undefined> {
    const tomlPath = path.join(workspaceFolder.uri.fsPath, 'pyproject.toml');
    const packages: IPackageInstallSelection[] = [];

    const tomlStep = new MultiStepNode(
        undefined,
        async (context?: MultiStepAction) => {
            traceVerbose(`Looking for toml pyproject.toml with optional dependencies at: ${tomlPath}`);

            let extras: string[] = [];
            let hasBuildSystem = false;

            if (await fs.pathExists(tomlPath)) {
                const toml = tomlParse(await fs.readFile(tomlPath, 'utf-8'));
                extras = getTomlOptionalDeps(toml);
                hasBuildSystem = tomlHasBuildSystem(toml);

                if (!hasBuildSystem) {
                    traceVerbose('Create env: Found toml without build system. So we will not use editable install.');
                }
                if (extras.length === 0) {
                    traceVerbose('Create env: Found toml without optional dependencies.');
                }
            } else if (context === MultiStepAction.Back) {
                // This step is not really used so just go back
                return MultiStepAction.Back;
            }

            if (hasBuildSystem) {
                if (extras.length > 0) {
                    traceVerbose('Create Env: Found toml with optional dependencies.');

                    try {
                        const installList = await pickTomlExtras(extras, token);
                        if (installList) {
                            if (installList.length > 0) {
                                installList.forEach((i) => {
                                    packages.push({ installType: 'toml', installItem: i, source: tomlPath });
                                });
                            }
                            packages.push({ installType: 'toml', source: tomlPath });
                        } else {
                            return MultiStepAction.Cancel;
                        }
                    } catch (ex) {
                        if (ex === MultiStepAction.Back || ex === MultiStepAction.Cancel) {
                            return ex;
                        }
                        throw ex;
                    }
                } else if (context === MultiStepAction.Back) {
                    // This step is not really used so just go back
                    return MultiStepAction.Back;
                } else {
                    // There are no extras to install and the context is to go to next step
                    packages.push({ installType: 'toml', source: tomlPath });
                }
            } else if (context === MultiStepAction.Back) {
                // This step is not really used because there is no build system in toml, so just go back
                return MultiStepAction.Back;
            }

            return MultiStepAction.Continue;
        },
        undefined,
    );

    const requirementsStep = new MultiStepNode(
        tomlStep,
        async (context?: MultiStepAction) => {
            traceVerbose('Looking for pip requirements.');
            const requirementFiles = (await getPipRequirementsFiles(workspaceFolder, token))?.map((p) =>
                path.relative(workspaceFolder.uri.fsPath, p),
            );

            if (requirementFiles && requirementFiles.length > 0) {
                traceVerbose('Found pip requirements.');
                try {
                    const result = await pickRequirementsFiles(requirementFiles, token);
                    const installList = result?.map((p) => path.join(workspaceFolder.uri.fsPath, p));
                    if (installList) {
                        installList.forEach((i) => {
                            packages.push({ installType: 'requirements', installItem: i });
                        });
                    } else {
                        return MultiStepAction.Cancel;
                    }
                } catch (ex) {
                    if (ex === MultiStepAction.Back || ex === MultiStepAction.Cancel) {
                        return ex;
                    }
                    throw ex;
                }
            } else if (context === MultiStepAction.Back) {
                // This step is not really used, because there were no requirement files, so just go back
                return MultiStepAction.Back;
            }

            return MultiStepAction.Continue;
        },
        undefined,
    );
    tomlStep.next = requirementsStep;

    const action = await MultiStepNode.run(tomlStep);
    if (action === MultiStepAction.Back || action === MultiStepAction.Cancel) {
        throw action;
    }

    return packages;
}
