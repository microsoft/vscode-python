// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as assert from 'assert';
import * as path from 'path';
import * as sinon from 'sinon';
import * as platformUtils from '../../../../client/common/utils/platform';
import * as fileUtils from '../../../../client/pythonEnvironments/common/externalDependencies';
import { isPyenvEnvironment } from '../../../../client/pythonEnvironments/discovery/locators/services/pyenvLocator';

suite('Pyenv Locator Tests', () => {
    const home = platformUtils.getUserHomeDir() || '';
    let getEnvVariableStub: sinon.SinonStub;
    let pathExistsStub:sinon.SinonStub;
    let getOsTypeStub: sinon.SinonStub;

    setup(() => {
        getEnvVariableStub = sinon.stub(platformUtils, 'getEnvironmentVariable');
        getOsTypeStub = sinon.stub(platformUtils, 'getOSType');
        pathExistsStub = sinon.stub(fileUtils, 'pathExists');
    });

    teardown(() => {
        getEnvVariableStub.restore();
        pathExistsStub.restore();
        getOsTypeStub.restore();
    });

    type PyenvUnitTestData = {
        testTitle: string,
        interpreterPath: string,
        pyenvEnvVar?: string,
        osType: platformUtils.OSType,
    };

    const testData: PyenvUnitTestData[] = [
        {
            testTitle: 'undefined',
            interpreterPath: path.join(home, '.pyenv', 'versions', '3.8.0', 'bin', 'python'),
            osType: platformUtils.OSType.Linux,
        },
        {
            testTitle: 'undefined',
            interpreterPath: path.join(home, '.pyenv', 'pyenv-win', 'versions', '3.8.0', 'bin', 'python'),
            osType: platformUtils.OSType.Windows,
        },
        {
            testTitle: 'its default value',
            interpreterPath: path.join(home, '.pyenv', 'versions', '3.8.0', 'bin', 'python'),
            pyenvEnvVar: path.join(home, '.pyenv'),
            osType: platformUtils.OSType.Linux,
        },
        {
            testTitle: 'its default value',
            interpreterPath: path.join(home, '.pyenv', 'pyenv-win', 'versions', '3.8.0', 'bin', 'python'),
            pyenvEnvVar: path.join(home, '.pyenv', 'pyenv-win'),
            osType: platformUtils.OSType.Windows,
        },
        {
            testTitle: 'a custom value',
            interpreterPath: path.join('path', 'to', 'mypyenv', 'versions', '3.8.0', 'bin', 'python'),
            pyenvEnvVar: path.join('path', 'to', 'mypyenv'),
            osType: platformUtils.OSType.Linux,
        },
        {
            testTitle: 'a custom value',
            interpreterPath: path.join('path', 'to', 'mypyenv', 'pyenv-win', 'versions', '3.8.0', 'bin', 'python'),
            pyenvEnvVar: path.join('path', 'to', 'mypyenv', 'pyenv-win'),
            osType: platformUtils.OSType.Windows,
        },
    ];

    testData.forEach(({
        testTitle, interpreterPath, pyenvEnvVar, osType,
    }) => {
        test(`The environment variable is set to ${testTitle} on ${osType}, and the interpreter path is in a subfolder of the pyenv folder`, async () => {
            getEnvVariableStub.withArgs('PYENV_ROOT').returns(pyenvEnvVar);
            getEnvVariableStub.withArgs('PYENV').returns(pyenvEnvVar);
            getOsTypeStub.returns(osType);
            pathExistsStub.resolves(true);

            const result = await isPyenvEnvironment(interpreterPath);

            assert.strictEqual(result, true);
        });
    });

    test('The pyenv directory does not exist', async () => {
        const interpreterPath = path.join('path', 'to', 'python');

        pathExistsStub.resolves(false);

        const result = await isPyenvEnvironment(interpreterPath);

        assert.strictEqual(result, false);
    });

    test('The interpreter path is not in a subfolder of the pyenv folder', async () => {
        const interpreterPath = path.join('path', 'to', 'python');

        pathExistsStub.resolves(true);

        const result = await isPyenvEnvironment(interpreterPath);

        assert.strictEqual(result, false);
    });
});
