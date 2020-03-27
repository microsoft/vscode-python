import * as assert from 'assert';
import { expect } from 'chai';
import { CondaInfo } from '../../client/interpreter/contracts';
import { AnacondaDisplayName } from '../../client/interpreter/locators/services/conda';
import { CondaHelper } from '../../client/interpreter/locators/services/condaHelper';

// tslint:disable-next-line:max-func-body-length
suite('Interpreters display name from Conda Environments', () => {
    const condaHelper = new CondaHelper();
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
            'sys.version':
                '3.6.1 |Anaconda 4.4.0 (64-bit)| (default, May 11 2017, 13:25:24) [MSC v.1900 64 bit (AMD64)]'
        };
        const displayName = condaHelper.getDisplayName(info);
        assert.equal(displayName, 'Anaconda 4.4.0 (64-bit)', 'Incorrect display name');
    });
    test("Must return info without prefixing with word 'Python'", () => {
        const info: CondaInfo = {
            python_version: '3.6.1.final.10',
            'sys.version':
                '3.6.1 |Anaconda 4.4.0 (64-bit)| (default, May 11 2017, 13:25:24) [MSC v.1900 64 bit (AMD64)]'
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
    test('Parse conda environments', () => {
        // tslint:disable-next-line:no-multiline-string
        const environments = `
# conda environments:
#
base                  *  /Users/donjayamanne/anaconda3
one1                     /Users/donjayamanne/anaconda3/envs/one
two2 2                   /Users/donjayamanne/anaconda3/envs/two 2
three3                   /Users/donjayamanne/anaconda3/envs/three
                         /Users/donjayamanne/anaconda3/envs/four
                         /Users/donjayamanne/anaconda3/envs/five 5`;

        const expectedList = [
            { name: 'base', path: '/Users/donjayamanne/anaconda3' },
            { name: 'one1', path: '/Users/donjayamanne/anaconda3/envs/one' },
            { name: 'two2 2', path: '/Users/donjayamanne/anaconda3/envs/two 2' },
            { name: 'three3', path: '/Users/donjayamanne/anaconda3/envs/three' },
            { name: '', path: '/Users/donjayamanne/anaconda3/envs/four' },
            { name: '', path: '/Users/donjayamanne/anaconda3/envs/five 5' }
        ];

        const list = condaHelper.parseCondaEnvironmentNames(environments);
        expect(list).deep.equal(expectedList);
    });
});
