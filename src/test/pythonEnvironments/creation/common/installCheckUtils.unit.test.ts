// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License

import * as chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';
import * as typemoq from 'typemoq';
import { assert, use as chaiUse } from 'chai';
import { Diagnostic, TextDocument, Range, Uri } from 'vscode';
import * as rawProcessApis from '../../../../client/common/process/rawProcessApis';
import { getInstalledPackagesDiagnostics } from '../../../../client/pythonEnvironments/creation/common/installCheckUtils';
import { IInterpreterPathService } from '../../../../client/common/types';

chaiUse(chaiAsPromised);

function getSomeRequirementFile(): typemoq.IMock<TextDocument> {
    const someFilePath = 'requirements.txt';
    const someFile = typemoq.Mock.ofType<TextDocument>();
    someFile.setup((p) => p.languageId).returns(() => 'pip-requirements');
    someFile.setup((p) => p.fileName).returns(() => someFilePath);
    someFile.setup((p) => p.getText(typemoq.It.isAny())).returns(() => 'flake8-csv');
    return someFile;
}

const MISSING_PACKAGES_STR =
    '[{"line": 8, "character": 34, "endLine": 8, "endCharacter": 44, "package": "flake8-csv", "code": "not-installed", "severity": 3}]';
const MISSING_PACKAGES: Diagnostic[] = [
    {
        range: new Range(8, 34, 8, 44),
        message: 'Package `flake8-csv` is not installed in the selected environment.',
        source: 'Python-InstalledPackagesChecker',
        code: { value: 'not-installed', target: Uri.parse(`https://pypi.org/p/flake8-csv`) },
        severity: 3,
        relatedInformation: [],
    },
];

suite('Install check diagnostics tests', () => {
    let plainExecStub: sinon.SinonStub;
    let interpreterPathService: typemoq.IMock<IInterpreterPathService>;

    setup(() => {
        plainExecStub = sinon.stub(rawProcessApis, 'plainExec');
        interpreterPathService = typemoq.Mock.ofType<IInterpreterPathService>();
    });

    teardown(() => {
        sinon.restore();
    });

    test('Test parse diagnostics', async () => {
        plainExecStub.resolves({ stdout: MISSING_PACKAGES_STR, stderr: '' });
        const someFile = getSomeRequirementFile();
        const result = await getInstalledPackagesDiagnostics(interpreterPathService.object, someFile.object);

        assert.deepStrictEqual(result, MISSING_PACKAGES);
    });

    test('Test parse empty diagnostics', async () => {
        plainExecStub.resolves({ stdout: '', stderr: '' });
        const someFile = getSomeRequirementFile();
        const result = await getInstalledPackagesDiagnostics(interpreterPathService.object, someFile.object);

        assert.deepStrictEqual(result, []);
    });
});
