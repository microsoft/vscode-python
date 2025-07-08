import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as utils from '../../client/testing/utils';
import sinon from 'sinon';
use(chaiAsPromised.default);

describe('idToModuleClassMethod', () => {
    it('returns the only part if there is one', () => {
        expect(utils.idToModuleClassMethod('foo')).to.equal('foo');
    });
    it('returns module.class for two parts', () => {
        expect(utils.idToModuleClassMethod('a/b/c.py\\MyClass')).to.equal('c.MyClass');
    });
    it('returns module.class.method for three parts', () => {
        expect(utils.idToModuleClassMethod('a/b/c.py\\MyClass\\my_method')).to.equal('c.MyClass.my_method');
    });
    it('returns undefined if fileName is missing', () => {
        expect(utils.idToModuleClassMethod('\\MyClass')).to.be.undefined;
    });
});

describe('writeTestIdToClipboard', () => {
    let clipboardStub: sinon.SinonStub;

    afterEach(() => {
        sinon.restore();
    });

    it('writes module.class.method for unittest id', async () => {
        clipboardStub = sinon.stub(utils, 'clipboardWriteText').resolves();
        const { writeTestIdToClipboard } = utils;
        const testItem = { id: 'a/b/c.py\\MyClass\\my_method' };
        await writeTestIdToClipboard(testItem as any);
        sinon.assert.calledOnceWithExactly(clipboardStub, 'c.MyClass.my_method');
    });

    it('writes id as is for pytest id', async () => {
        clipboardStub = sinon.stub(utils, 'clipboardWriteText').resolves();
        const { writeTestIdToClipboard } = utils;
        const testItem = { id: 'tests/test_foo.py::TestClass::test_method' };
        await writeTestIdToClipboard(testItem as any);
        sinon.assert.calledOnceWithExactly(clipboardStub, 'tests/test_foo.py::TestClass::test_method');
    });

    it('does nothing if testItem is undefined', async () => {
        clipboardStub = sinon.stub(utils, 'clipboardWriteText').resolves();
        const { writeTestIdToClipboard } = utils;
        await writeTestIdToClipboard(undefined as any);
        sinon.assert.notCalled(clipboardStub);
    });
});
