// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License

import { Diagnostic, DiagnosticSeverity, l10n, Range, TextDocument, Uri } from 'vscode';
import { installedCheckScript } from '../../../common/process/internal/scripts';
import { plainExec } from '../../../common/process/rawProcessApis';
import { IInterpreterPathService } from '../../../common/types';
import { traceInfo, traceVerbose, traceError } from '../../../logging';

interface PackageDiagnostic {
    package: string;
    line: number;
    character: number;
    endLine: number;
    endCharacter: number;
    code: string;
    severity: DiagnosticSeverity;
}

export const INSTALL_CHECKER_SOURCE = 'Python-InstalledPackagesChecker';

function parseDiagnostics(data: string): Diagnostic[] {
    let diagnostics: Diagnostic[] = [];
    try {
        const raw = JSON.parse(data) as PackageDiagnostic[];
        diagnostics = raw.map((item) => {
            const d = new Diagnostic(
                new Range(item.line, item.character, item.endLine, item.endCharacter),
                l10n.t(`Package \`${item.package}\` is not installed in the selected environment.`),
                item.severity,
            );
            d.code = { value: item.code, target: Uri.parse(`https://pypi.org/p/${item.package}`) };
            d.source = INSTALL_CHECKER_SOURCE;
            return d;
        });
    } catch {
        diagnostics = [];
    }
    return diagnostics;
}

export async function getInstalledPackagesDiagnostics(
    interpreterPathService: IInterpreterPathService,
    doc: TextDocument,
): Promise<Diagnostic[]> {
    const interpreter = interpreterPathService.get(doc.uri);
    const scriptPath = installedCheckScript();
    try {
        traceInfo('Running installed packages checker: ', interpreter, scriptPath, doc.uri.fsPath);
        const result = await plainExec(interpreter, [scriptPath, doc.uri.fsPath]);
        traceVerbose('Installed packages check result:\n', result.stdout);
        if (result.stderr) {
            traceError('Installed packages check error:\n', result.stderr);
        }
        return parseDiagnostics(result.stdout);
    } catch (ex) {
        traceError('Error while getting installed packages check result:\n', ex);
    }
    return [];
}
