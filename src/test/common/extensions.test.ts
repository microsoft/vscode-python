import { expect } from 'chai';
import '../../client/common/extensions';

// Defines a Mocha test suite to group tests of similar kind together
suite('String Extensions', () => {
    test('Should return empty string for empty arg', () => {
        const argTotest = '';
        expect(argTotest.toCommandArgument()).to.be.equal('');
    });
    test('Should quote an empty space', () => {
        const argTotest = ' ';
        expect(argTotest.toCommandArgument()).to.be.equal('" "');
    });
    test('Should not quote command arguments without spaces', () => {
        const argTotest = 'one.two.three';
        expect(argTotest.toCommandArgument()).to.be.equal(argTotest);
    });
    test('Should quote command arguments with spaces', () => {
        const argTotest = 'one two three';
        expect(argTotest.toCommandArgument()).to.be.equal(`"${argTotest}"`);
    });
    test('Should return empty string for empty path', () => {
        const fileToTest = '';
        expect(fileToTest.fileToCommandArgument()).to.be.equal('');
    });
    test('Should not quote file argument without spaces', () => {
        const fileToTest = 'users/test/one';
        expect(fileToTest.fileToCommandArgument()).to.be.equal(fileToTest);
    });
    test('Should quote file argument with spaces', () => {
        const fileToTest = 'one two three';
        expect(fileToTest.fileToCommandArgument()).to.be.equal(`"${fileToTest}"`);
    });
    test('Should replace all back slashes with forward slashes (irrespective of OS)', () => {
        const fileToTest = 'c:\\users\\user\\conda\\scripts\\python.exe';
        expect(fileToTest.fileToCommandArgument()).to.be.equal(fileToTest.replace(/\\/g, '/'));
    });
    test('Should replace all back slashes with forward slashes (irrespective of OS) and quoted when file has spaces', () => {
        const fileToTest = 'c:\\users\\user namne\\conda path\\scripts\\python.exe';
        expect(fileToTest.fileToCommandArgument()).to.be.equal(`"${fileToTest.replace(/\\/g, '/')}"`);
    });
});
