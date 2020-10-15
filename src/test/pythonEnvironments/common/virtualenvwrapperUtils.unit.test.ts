// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as path from 'path';
import * as sinon from 'sinon';
import * as platformUtils from '../../../client/common/utils/platform';
import { getDefaultVirtualenvwrapperDir } from '../../../client/pythonEnvironments/common/virtualenvwrapperUtils';

suite('Virtualenvwrapper Utils tests', () => {
    const homeDir = path.join('path', 'to', 'home');

    let getOsTypeStub: sinon.SinonStub;
    let getHomeDirStub: sinon.SinonStub;

    setup(() => {
        getOsTypeStub = sinon.stub(platformUtils, 'getOSType');
        getHomeDirStub = sinon.stub(platformUtils, 'getUserHomeDir');

        getHomeDirStub.returns(homeDir);
    });

    teardown(() => {
        getOsTypeStub.restore();
        getHomeDirStub.restore();
    });

    test('Default virtualenvwrapper directory on non-Windows should be ~/.virtualenvs', () => {
        getOsTypeStub.returns(platformUtils.OSType.Linux);

        const directory = getDefaultVirtualenvwrapperDir();

        assert.deepStrictEqual(directory, path.join(homeDir, '.virtualenvs'));
    });

    test('Default virtualenvwrapper directory on Windows should be %USERPROFILE%\\Envs', () => {
        getOsTypeStub.returns(platformUtils.OSType.Windows);

        const directory = getDefaultVirtualenvwrapperDir();

        assert.deepStrictEqual(directory, path.join(homeDir, 'Envs'));
    });
});
