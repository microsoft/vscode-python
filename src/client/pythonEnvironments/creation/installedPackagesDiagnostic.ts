// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License

import { Diagnostic, DiagnosticCollection, DiagnosticSeverity, l10n, Range, TextDocument, Uri } from 'vscode';
import { installedCheckScript } from '../../common/process/internal/scripts';
import { plainExec } from '../../common/process/rawProcessApis';
import { IDisposableRegistry, IInterpreterPathService } from '../../common/types';
import { executeCommand } from '../../common/vscodeApis/commandApis';
import { createDiagnosticCollection, onDidChangeDiagnostics } from '../../common/vscodeApis/languageApis';
import { getActiveTextEditor, onDidChangeActiveTextEditor } from '../../common/vscodeApis/windowApis';
import {
    getOpenTextDocuments,
    onDidCloseTextDocument,
    onDidOpenTextDocument,
    onDidSaveTextDocument,
} from '../../common/vscodeApis/workspaceApis';
import { traceVerbose } from '../../logging';

interface PackageDiagnostic {
    package: string;
    line: number;
    code: string;
    severity: DiagnosticSeverity;
}

const SOURCE = 'Python-Ext';
const PIP_DEPS_NOT_INSTALLED_KEY = 'pipDepsNotInstalled';

async function getPipRequirementsDiagnostics(
    interpreterPathService: IInterpreterPathService,
    doc: TextDocument,
): Promise<Diagnostic[]> {
    const interpreter = interpreterPathService.get(doc.uri);
    const result = await plainExec(interpreter, [installedCheckScript(), doc.uri.fsPath]);
    traceVerbose('Installed packages check result:\n', result.stdout);
    let diagnostics: Diagnostic[] = [];
    try {
        const raw = JSON.parse(result.stdout) as PackageDiagnostic[];
        diagnostics = raw.map((item) => {
            const d = new Diagnostic(
                new Range(item.line, 0, item.line, item.package.length),
                l10n.t(`Package \`${item.package}\` is not installed in the selected environment.`),
                item.severity,
            );
            d.code = { value: item.code, target: Uri.parse(`https://pypi.org/p/${item.package}`) };
            d.source = SOURCE;
            return d;
        });
    } catch {
        diagnostics = [];
    }
    return diagnostics;
}

async function setContextForActiveEditor(diagnosticCollection: DiagnosticCollection): Promise<void> {
    const doc = getActiveTextEditor()?.document;
    if (doc && doc.languageId === 'pip-requirements') {
        const diagnostics = diagnosticCollection.get(doc.uri);
        if (diagnostics && diagnostics.length > 0) {
            traceVerbose(`Setting context for pip dependencies not installed: ${doc.uri.fsPath}`);
            await executeCommand('setContext', PIP_DEPS_NOT_INSTALLED_KEY, true);
            return;
        }
    }

    // undefined here in the logs means no file was selected
    traceVerbose(`Clearing context for pip dependencies not installed: ${doc?.uri.fsPath}`);
    await executeCommand('setContext', PIP_DEPS_NOT_INSTALLED_KEY, false);
}

export function registerInstalledPackagesChecking(
    interpreterPathService: IInterpreterPathService,
    disposables: IDisposableRegistry,
): void {
    const diagnosticCollection = createDiagnosticCollection(SOURCE);

    disposables.push(diagnosticCollection);
    disposables.push(
        onDidOpenTextDocument(async (e: TextDocument) => {
            if (e.languageId === 'pip-requirements') {
                const diagnostics = await getPipRequirementsDiagnostics(interpreterPathService, e);
                if (diagnostics.length > 0) {
                    diagnosticCollection.set(e.uri, diagnostics);
                } else if (diagnosticCollection.has(e.uri)) {
                    diagnosticCollection.delete(e.uri);
                }
            }
        }),
        onDidSaveTextDocument(async (e: TextDocument) => {
            if (e.languageId === 'pip-requirements') {
                const diagnostics = await getPipRequirementsDiagnostics(interpreterPathService, e);
                if (diagnostics.length > 0) {
                    diagnosticCollection.set(e.uri, diagnostics);
                } else if (diagnosticCollection.has(e.uri)) {
                    diagnosticCollection.delete(e.uri);
                }
            }
        }),
        onDidCloseTextDocument((e: TextDocument) => {
            if (diagnosticCollection.has(e.uri)) {
                diagnosticCollection.delete(e.uri);
            }
        }),
        onDidChangeDiagnostics(async () => {
            await setContextForActiveEditor(diagnosticCollection);
        }),
        onDidChangeActiveTextEditor(async () => {
            await setContextForActiveEditor(diagnosticCollection);
        }),
    );

    getOpenTextDocuments().forEach(async (doc: TextDocument) => {
        if (doc.languageId === 'pip-requirements') {
            const diagnostics = await getPipRequirementsDiagnostics(interpreterPathService, doc);
            if (diagnostics.length > 0) {
                diagnosticCollection.set(doc.uri, diagnostics);
            } else if (diagnosticCollection.has(doc.uri)) {
                diagnosticCollection.delete(doc.uri);
            }
        }
    });
}
