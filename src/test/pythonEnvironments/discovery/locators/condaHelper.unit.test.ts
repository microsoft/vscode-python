import { expect } from 'chai';
import { parseCondaEnvFileContents } from '../../../../client/pythonEnvironments/discovery/locators/services/condaHelper';

suite('Interpreters display name from Conda Environments', () => {
    test('Parse conda environments', () => {
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
                isActive: false,
            },
            {
                name: 'aaaa_bbbb_cccc_dddd_eeee_ffff_gggg',
                path: '/Users/donjayamanne/anaconda3/envs/aaaa_bbbb_cccc_dddd_eeee_ffff_gggg',
                isActive: true,
            },
            { name: 'with*star', path: '/Users/donjayamanne/anaconda3/envs/with*star', isActive: false },
            {
                name: 'with*one*two*three*four*five*six*seven*',
                path: '/Users/donjayamanne/anaconda3/envs/with*one*two*three*four*five*six*seven*',
                isActive: false,
            },
            {
                name: 'with*one*two*three*four*five*six*seven*',
                path: '/Users/donjayamanne/anaconda3/envs/with*one*two*three*four*five*six*seven*',
                isActive: true,
            },
            { name: '', path: '/Users/donjayamanne/anaconda3/envs/seven ', isActive: false },
        ];

        const list = parseCondaEnvFileContents(environments);
        expect(list).deep.equal(expectedList);
    });
});
