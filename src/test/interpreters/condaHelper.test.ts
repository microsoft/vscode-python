import * as assert from 'assert';
import { CondaInfo } from '../../client/interpreter/contracts';
import { AnacondaDisplayName } from '../../client/interpreter/locators/services/conda';
import { CondaHelper } from '../../client/interpreter/locators/services/condaHelper';
import { initialize, initializeTest } from '../initialize';

// tslint:disable-next-line:max-func-body-length
suite('Interpreters display name from Conda Environments', () => {
    const condaHelper = new CondaHelper();
    suiteSetup(initialize);
    setup(initializeTest);
    test('Must return default display name for invalid Conda Info', () => {
        assert.equal(condaHelper.getDisplayName(), AnacondaDisplayName, 'Incorrect display name');
        assert.equal(condaHelper.getDisplayName({}), AnacondaDisplayName, 'Incorrect display name');
    });
    test('Must return at least Python Version', () => {
        const info: CondaInfo = {
            python_version: '3.6.1.final.10'
        };
        const displayName = condaHelper.getDisplayName(info);
        assert.equal(displayName, AnacondaDisplayName, 'Incorrect display name');
    });
    test('Must return info without first part if not a python version', () => {
        const info: CondaInfo = {
            'sys.version': '3.6.1 |Anaconda 4.4.0 (64-bit)| (default, May 11 2017, 13:25:24) [MSC v.1900 64 bit (AMD64)]'
        };
        const displayName = condaHelper.getDisplayName(info);
        assert.equal(displayName, 'Anaconda 4.4.0 (64-bit)', 'Incorrect display name');
    });
    test('Must return info without prefixing with word \'Python\'', () => {
        const info: CondaInfo = {
            python_version: '3.6.1.final.10',
            'sys.version': '3.6.1 |Anaconda 4.4.0 (64-bit)| (default, May 11 2017, 13:25:24) [MSC v.1900 64 bit (AMD64)]'
        };
        const displayName = condaHelper.getDisplayName(info);
        assert.equal(displayName, 'Anaconda 4.4.0 (64-bit)', 'Incorrect display name');
    });
    test('Must include Ananconda name if Company name not found', () => {
        const info: CondaInfo = {
            python_version: '3.6.1.final.10',
            'sys.version': '3.6.1 |4.4.0 (64-bit)| (default, May 11 2017, 13:25:24) [MSC v.1900 64 bit (AMD64)]'
        };
        const displayName = condaHelper.getDisplayName(info);
        assert.equal(displayName, `4.4.0 (64-bit) : ${AnacondaDisplayName}`, 'Incorrect display name');
    });
});
