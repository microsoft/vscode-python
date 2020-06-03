import * as assert from 'assert';
import { expect } from 'chai';
import {
    AnacondaDisplayName,
    CondaInfo
} from '../../../../client/pythonEnvironments/discovery/locators/services/conda';
import {
    getDisplayName,
    parseCondaEnvFileContents
} from '../../../../client/pythonEnvironments/discovery/locators/services/condaHelper';

// tslint:disable-next-line:max-func-body-length
suite('Interpreters display name from Conda Environments', () => {
    test('Must return default display name for invalid Conda Info', () => {
        assert.equal(getDisplayName(), AnacondaDisplayName, 'Incorrect display name');
        assert.equal(getDisplayName({}), AnacondaDisplayName, 'Incorrect display name');
    });
    test('Must return at least Python Version', () => {
        const info: CondaInfo = {
            python_version: '3.6.1.final.10'
        };
        const displayName = getDisplayName(info);
        assert.equal(displayName, AnacondaDisplayName, 'Incorrect display name');
    });
    test('Must return info without first part if not a python version', () => {
        const info: CondaInfo = {
            'sys.version':
                '3.6.1 |Anaconda 4.4.0 (64-bit)| (default, May 11 2017, 13:25:24) [MSC v.1900 64 bit (AMD64)]'
        };
        const displayName = getDisplayName(info);
        assert.equal(displayName, 'Anaconda 4.4.0 (64-bit)', 'Incorrect display name');
    });
    test("Must return info without prefixing with word 'Python'", () => {
        const info: CondaInfo = {
            python_version: '3.6.1.final.10',
            'sys.version':
                '3.6.1 |Anaconda 4.4.0 (64-bit)| (default, May 11 2017, 13:25:24) [MSC v.1900 64 bit (AMD64)]'
        };
        const displayName = getDisplayName(info);
        assert.equal(displayName, 'Anaconda 4.4.0 (64-bit)', 'Incorrect display name');
    });
    test('Must include Ananconda name if Company name not found', () => {
        const info: CondaInfo = {
            python_version: '3.6.1.final.10',
            'sys.version': '3.6.1 |4.4.0 (64-bit)| (default, May 11 2017, 13:25:24) [MSC v.1900 64 bit (AMD64)]'
        };
        const displayName = getDisplayName(info);
        assert.equal(displayName, `4.4.0 (64-bit) : ${AnacondaDisplayName}`, 'Incorrect display name');
    });
    test('Parse conda environments', () => {
        // tslint:disable-next-line:no-multiline-string
        const environments = `
# conda environments:
#
base                  *  /Users/donjayamanne/anaconda3
                      *  /Users/donjayamanne/anaconda3
one                      /Users/donjayamanne/anaconda3/envs/one
 one                      /Users/donjayamanne/anaconda3/envs/ one
one two                  /Users/donjayamanne/anaconda3/envs/one two
three                    /Users/donjayamanne/anaconda3/envs/three
                         /Users/donjayamanne/anaconda3/envs/four
                         /Users/donjayamanne/anaconda3/envs/five six
aaaa_bbbb_cccc_dddd_eeee_ffff_gggg     /Users/donjayamanne/anaconda3/envs/aaaa_bbbb_cccc_dddd_eeee_ffff_gggg
aaaa_bbbb_cccc_dddd_eeee_ffff_gggg  *  /Users/donjayamanne/anaconda3/envs/aaaa_bbbb_cccc_dddd_eeee_ffff_gggg
with*star                /Users/donjayamanne/anaconda3/envs/with*star
with*one*two*three*four*five*six*seven*     /Users/donjayamanne/anaconda3/envs/with*one*two*three*four*five*six*seven*
with*one*two*three*four*five*six*seven*  *  /Users/donjayamanne/anaconda3/envs/with*one*two*three*four*five*six*seven*
                         /Users/donjayamanne/anaconda3/envs/seven `; // note the space after seven

        const expectedList = [
            { name: 'base', path: '/Users/donjayamanne/anaconda3', isActive: true },
            { name: '', path: '/Users/donjayamanne/anaconda3', isActive: true },
            { name: 'one', path: '/Users/donjayamanne/anaconda3/envs/one', isActive: false },
            { name: ' one', path: '/Users/donjayamanne/anaconda3/envs/ one', isActive: false },
            { name: 'one two', path: '/Users/donjayamanne/anaconda3/envs/one two', isActive: false },
            { name: 'three', path: '/Users/donjayamanne/anaconda3/envs/three', isActive: false },
            { name: '', path: '/Users/donjayamanne/anaconda3/envs/four', isActive: false },
            { name: '', path: '/Users/donjayamanne/anaconda3/envs/five six', isActive: false },
            {
                name: 'aaaa_bbbb_cccc_dddd_eeee_ffff_gggg',
                path: '/Users/donjayamanne/anaconda3/envs/aaaa_bbbb_cccc_dddd_eeee_ffff_gggg',
                isActive: false
            },
            {
                name: 'aaaa_bbbb_cccc_dddd_eeee_ffff_gggg',
                path: '/Users/donjayamanne/anaconda3/envs/aaaa_bbbb_cccc_dddd_eeee_ffff_gggg',
                isActive: true
            },
            { name: 'with*star', path: '/Users/donjayamanne/anaconda3/envs/with*star', isActive: false },
            {
                name: 'with*one*two*three*four*five*six*seven*',
                path: '/Users/donjayamanne/anaconda3/envs/with*one*two*three*four*five*six*seven*',
                isActive: false
            },
            {
                name: 'with*one*two*three*four*five*six*seven*',
                path: '/Users/donjayamanne/anaconda3/envs/with*one*two*three*four*five*six*seven*',
                isActive: true
            },
            { name: '', path: '/Users/donjayamanne/anaconda3/envs/seven ', isActive: false }
        ];

        const list = parseCondaEnvFileContents(environments);
        expect(list).deep.equal(expectedList);
    });
});
