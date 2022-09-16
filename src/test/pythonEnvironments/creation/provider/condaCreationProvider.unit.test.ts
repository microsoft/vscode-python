// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { assert } from 'chai';
import * as sinon from 'sinon';
// import * as typemoq from 'typemoq';
import { Uri } from 'vscode';
import { CreateEnvironmentProvider } from '../../../../client/pythonEnvironments/creation/types';
import { condaCreationProvider } from '../../../../client/pythonEnvironments/creation/provider/condaCreationProvider';
import * as wsSelect from '../../../../client/pythonEnvironments/creation/common/workspaceSelection';
import * as condaUtils from '../../../../client/pythonEnvironments/creation/provider/condaUtils';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../../constants';

suite('Conda Creation provider tests', () => {
    let condaProvider: CreateEnvironmentProvider;
    // let showQuickPickStub: sinon.SinonStub;
    let getCondaStub: sinon.SinonStub;
    let pickPythonVersionStub: sinon.SinonStub;
    let pickWorkspaceFolderStub: sinon.SinonStub;

    setup(() => {
        pickWorkspaceFolderStub = sinon.stub(wsSelect, 'pickWorkspaceFolder');
        getCondaStub = sinon.stub(condaUtils, 'getConda');
        pickPythonVersionStub = sinon.stub(condaUtils, 'pickPythonVersion');

        condaProvider = condaCreationProvider();
    });

    teardown(() => {
        sinon.restore();
    });

    test('No conda installed.', async () => {
        getCondaStub.resolves(undefined);

        assert.isUndefined(await condaProvider.createEnvironment());
    });

    test('No workspace selected.', async () => {
        getCondaStub.resolves('/usr/bin/conda');
        pickWorkspaceFolderStub.resolves(undefined);

        assert.isUndefined(await condaProvider.createEnvironment());
    });

    test('No python version picked selected.', async () => {
        getCondaStub.resolves('/usr/bin/conda');
        pickWorkspaceFolderStub.resolves({
            uri: Uri.file(path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'testMultiRootWkspc', 'workspace1')),
            name: 'workspace1',
            index: 0,
        });
        pickPythonVersionStub.resolves(undefined);

        assert.isUndefined(await condaProvider.createEnvironment());
    });
});
