import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as localize from '../../utils/localize';

// Defines a Mocha test suite to group tests of similar kind together
suite('localize tests', () => {
    test('keys', done => {
        let val = localize.LanguageServiceSurveyBanner.bannerMessage;
        assert.equal(val, "Create Terminal", 'Create Terminal string doesnt match');
        done();
    });
});