// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { assert } from 'chai';
import * as fs from 'fs-extra';
import * as sinon from 'sinon';
import { Uri } from 'vscode';
import * as path from 'path';
import * as windowApis from '../../../../client/common/vscodeApis/windowApis';
import * as workspaceApis from '../../../../client/common/vscodeApis/workspaceApis';
import { pickPackagesToInstall } from '../../../../client/pythonEnvironments/creation/provider/venvUtils';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../../constants';
import { CreateEnv } from '../../../../client/common/utils/localize';

suite('Venv Utils test', () => {
    let findFilesStub: sinon.SinonStub;
    let showQuickPickStub: sinon.SinonStub;
    let pathExistsStub: sinon.SinonStub;
    let readFileStub: sinon.SinonStub;

    const workspace1 = {
        uri: Uri.file(path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'testMultiRootWkspc', 'workspace1')),
        name: 'workspace1',
        index: 0,
    };

    setup(() => {
        findFilesStub = sinon.stub(workspaceApis, 'findFiles');
        showQuickPickStub = sinon.stub(windowApis, 'showQuickPick');
        pathExistsStub = sinon.stub(fs, 'pathExists');
        readFileStub = sinon.stub(fs, 'readFile');
    });

    teardown(() => {
        sinon.restore();
    });

    test('No requirements or toml found', async () => {
        findFilesStub.resolves([]);
        pathExistsStub.resolves(false);

        const actual = await pickPackagesToInstall(workspace1);
        assert.isTrue(showQuickPickStub.notCalled);
        assert.deepStrictEqual(actual, {
            installType: 'none',
            installList: [],
        });
    });

    test('Toml found with no optional deps', async () => {
        findFilesStub.resolves([]);
        pathExistsStub.resolves(true);
        readFileStub.resolves('[project]\nname = "spam"\nversion = "2020.0.0"\n');

        const actual = await pickPackagesToInstall(workspace1);
        assert.isTrue(showQuickPickStub.notCalled);
        assert.deepStrictEqual(actual, {
            installType: 'toml',
            installList: [],
            source: path.join(workspace1.uri.fsPath, 'pyproject.toml'),
        });
    });

    test('Toml found with deps, but user presses escape', async () => {
        findFilesStub.resolves([]);
        pathExistsStub.resolves(true);
        readFileStub.resolves(
            '[project]\nname = "spam"\nversion = "2020.0.0"\n[project.optional-dependencies]\ntest = ["pytest"]\ndoc = ["sphinx", "furo"]',
        );

        showQuickPickStub.resolves(undefined);

        const actual = await pickPackagesToInstall(workspace1);
        assert.isTrue(
            showQuickPickStub.calledWithExactly(
                [{ label: 'test' }, { label: 'doc' }],
                {
                    placeHolder: CreateEnv.Venv.tomlExtrasQuickPickTitle,
                    ignoreFocusOut: true,
                    canPickMany: true,
                },
                undefined,
            ),
        );
        assert.deepStrictEqual(actual, undefined);
    });

    test('Toml found with dependencies and user selects None', async () => {
        findFilesStub.resolves([]);
        pathExistsStub.resolves(true);
        readFileStub.resolves(
            '[project]\nname = "spam"\nversion = "2020.0.0"\n[project.optional-dependencies]\ntest = ["pytest"]\ndoc = ["sphinx", "furo"]',
        );

        showQuickPickStub.resolves([]);

        const actual = await pickPackagesToInstall(workspace1);
        assert.isTrue(
            showQuickPickStub.calledWithExactly(
                [{ label: 'test' }, { label: 'doc' }],
                {
                    placeHolder: CreateEnv.Venv.tomlExtrasQuickPickTitle,
                    ignoreFocusOut: true,
                    canPickMany: true,
                },
                undefined,
            ),
        );
        assert.deepStrictEqual(actual, {
            installType: 'toml',
            installList: [],
            source: path.join(workspace1.uri.fsPath, 'pyproject.toml'),
        });
    });

    test('Toml found with dependencies and user selects One', async () => {
        findFilesStub.resolves([]);
        pathExistsStub.resolves(true);
        readFileStub.resolves(
            '[project]\nname = "spam"\nversion = "2020.0.0"\n[project.optional-dependencies]\ntest = ["pytest"]\ndoc = ["sphinx", "furo"]',
        );

        showQuickPickStub.resolves([{ label: 'doc' }]);

        const actual = await pickPackagesToInstall(workspace1);
        assert.isTrue(
            showQuickPickStub.calledWithExactly(
                [{ label: 'test' }, { label: 'doc' }],
                {
                    placeHolder: CreateEnv.Venv.tomlExtrasQuickPickTitle,
                    ignoreFocusOut: true,
                    canPickMany: true,
                },
                undefined,
            ),
        );
        assert.deepStrictEqual(actual, {
            installType: 'toml',
            installList: ['doc'],
            source: path.join(workspace1.uri.fsPath, 'pyproject.toml'),
        });
    });

    test('Toml found with dependencies and user selects Few', async () => {
        findFilesStub.resolves([]);
        pathExistsStub.resolves(true);
        readFileStub.resolves(
            '[project]\nname = "spam"\nversion = "2020.0.0"\n[project.optional-dependencies]\ntest = ["pytest"]\ndoc = ["sphinx", "furo"]\ncov = ["pytest-cov"]',
        );

        showQuickPickStub.resolves([{ label: 'test' }, { label: 'cov' }]);

        const actual = await pickPackagesToInstall(workspace1);
        assert.isTrue(
            showQuickPickStub.calledWithExactly(
                [{ label: 'test' }, { label: 'doc' }, { label: 'cov' }],
                {
                    placeHolder: CreateEnv.Venv.tomlExtrasQuickPickTitle,
                    ignoreFocusOut: true,
                    canPickMany: true,
                },
                undefined,
            ),
        );
        assert.deepStrictEqual(actual, {
            installType: 'toml',
            installList: ['test', 'cov'],
            source: path.join(workspace1.uri.fsPath, 'pyproject.toml'),
        });
    });

    test('Requirements found, but user presses escape', async () => {
        let allow = true;
        findFilesStub.callsFake(() => {
            if (allow) {
                allow = false;
                return Promise.resolve([
                    Uri.file(path.join(workspace1.uri.fsPath, 'requirements.txt')),
                    Uri.file(path.join(workspace1.uri.fsPath, 'dev-requirements.txt')),
                    Uri.file(path.join(workspace1.uri.fsPath, 'test-requirements.txt')),
                ]);
            }
            return Promise.resolve([]);
        });
        pathExistsStub.resolves(false);

        showQuickPickStub.resolves(undefined);

        const actual = await pickPackagesToInstall(workspace1);
        assert.isTrue(
            showQuickPickStub.calledWithExactly(
                [{ label: 'requirements.txt' }, { label: 'dev-requirements.txt' }, { label: 'test-requirements.txt' }],
                {
                    placeHolder: CreateEnv.Venv.requirementsQuickPickTitle,
                    ignoreFocusOut: true,
                    canPickMany: true,
                },
                undefined,
            ),
        );
        assert.deepStrictEqual(actual, undefined);
        assert.isTrue(readFileStub.notCalled);
    });

    test('Requirements found and user selects None', async () => {
        let allow = true;
        findFilesStub.callsFake(() => {
            if (allow) {
                allow = false;
                return Promise.resolve([
                    Uri.file(path.join(workspace1.uri.fsPath, 'requirements.txt')),
                    Uri.file(path.join(workspace1.uri.fsPath, 'dev-requirements.txt')),
                    Uri.file(path.join(workspace1.uri.fsPath, 'test-requirements.txt')),
                ]);
            }
            return Promise.resolve([]);
        });
        pathExistsStub.resolves(false);

        showQuickPickStub.resolves([]);

        const actual = await pickPackagesToInstall(workspace1);
        assert.isTrue(
            showQuickPickStub.calledWithExactly(
                [{ label: 'requirements.txt' }, { label: 'dev-requirements.txt' }, { label: 'test-requirements.txt' }],
                {
                    placeHolder: CreateEnv.Venv.requirementsQuickPickTitle,
                    ignoreFocusOut: true,
                    canPickMany: true,
                },
                undefined,
            ),
        );
        assert.deepStrictEqual(actual, {
            installType: 'requirements',
            installList: [],
        });
        assert.isTrue(readFileStub.notCalled);
    });

    test('Requirements found and user selects One', async () => {
        let allow = true;
        findFilesStub.callsFake(() => {
            if (allow) {
                allow = false;
                return Promise.resolve([
                    Uri.file(path.join(workspace1.uri.fsPath, 'requirements.txt')),
                    Uri.file(path.join(workspace1.uri.fsPath, 'dev-requirements.txt')),
                    Uri.file(path.join(workspace1.uri.fsPath, 'test-requirements.txt')),
                ]);
            }
            return Promise.resolve([]);
        });
        pathExistsStub.resolves(false);

        showQuickPickStub.resolves([{ label: 'requirements.txt' }]);

        const actual = await pickPackagesToInstall(workspace1);
        assert.isTrue(
            showQuickPickStub.calledWithExactly(
                [{ label: 'requirements.txt' }, { label: 'dev-requirements.txt' }, { label: 'test-requirements.txt' }],
                {
                    placeHolder: CreateEnv.Venv.requirementsQuickPickTitle,
                    ignoreFocusOut: true,
                    canPickMany: true,
                },
                undefined,
            ),
        );
        assert.deepStrictEqual(actual, {
            installType: 'requirements',
            installList: [path.join(workspace1.uri.fsPath, 'requirements.txt')],
        });
        assert.isTrue(readFileStub.notCalled);
    });

    test('Requirements found and user selects Few', async () => {
        let allow = true;
        findFilesStub.callsFake(() => {
            if (allow) {
                allow = false;
                return Promise.resolve([
                    Uri.file(path.join(workspace1.uri.fsPath, 'requirements.txt')),
                    Uri.file(path.join(workspace1.uri.fsPath, 'dev-requirements.txt')),
                    Uri.file(path.join(workspace1.uri.fsPath, 'test-requirements.txt')),
                ]);
            }
            return Promise.resolve([]);
        });
        pathExistsStub.resolves(false);

        showQuickPickStub.resolves([{ label: 'dev-requirements.txt' }, { label: 'test-requirements.txt' }]);

        const actual = await pickPackagesToInstall(workspace1);
        assert.isTrue(
            showQuickPickStub.calledWithExactly(
                [{ label: 'requirements.txt' }, { label: 'dev-requirements.txt' }, { label: 'test-requirements.txt' }],
                {
                    placeHolder: CreateEnv.Venv.requirementsQuickPickTitle,
                    ignoreFocusOut: true,
                    canPickMany: true,
                },
                undefined,
            ),
        );
        assert.deepStrictEqual(actual, {
            installType: 'requirements',
            installList: [
                path.join(workspace1.uri.fsPath, 'dev-requirements.txt'),
                path.join(workspace1.uri.fsPath, 'test-requirements.txt'),
            ],
        });
        assert.isTrue(readFileStub.notCalled);
    });
});
