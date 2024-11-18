/* eslint-disable no-unused-expressions */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as TypeMoq from 'typemoq';
import * as sinon from 'sinon';
import { Disposable, ExtensionContext } from 'vscode';
import { expect } from 'chai';

import { IInterpreterService } from '../../client/interpreter/contracts';
import { PythonEnvironment } from '../../client/pythonEnvironments/info';
import { getNativeRepl, NATIVE_REPL_URI_MEMENTO, NativeRepl } from '../../client/repl/nativeRepl';
import { IExtensionContext } from '../../client/common/types';
import * as replUtils from '../../client/repl/replUtils';

suite('REPL - Native REPL', () => {
    let interpreterService: TypeMoq.IMock<IInterpreterService>;
    let extensionContext: TypeMoq.IMock<IExtensionContext>;
    let disposable: TypeMoq.IMock<Disposable>;
    let disposableArray: Disposable[] = [];
    let setReplDirectoryStub: sinon.SinonStub;
    let setReplControllerSpy: sinon.SinonSpy;
    let memento: TypeMoq.IMock<ExtensionContext['globalState']>;
    let getTabNameForUriStub: sinon.SinonStub;
    setup(() => {
        interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
        interpreterService
            .setup((i) => i.getActiveInterpreter(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(({ path: 'ps' } as unknown) as PythonEnvironment));
        disposable = TypeMoq.Mock.ofType<Disposable>();
        disposableArray = [disposable.object];
        memento = TypeMoq.Mock.ofType<ExtensionContext['globalState']>();
        setReplDirectoryStub = sinon.stub(NativeRepl.prototype as any, 'setReplDirectory').resolves(); // Stubbing private method
        // Use a spy instead of a stub for setReplController
        getTabNameForUriStub = sinon.stub(replUtils, 'getTabNameForUri').returns('tabName');
        setReplControllerSpy = sinon.spy(NativeRepl.prototype, 'setReplController');
        extensionContext = TypeMoq.Mock.ofType<IExtensionContext>();
        extensionContext.setup((c) => c.globalState).returns(() => memento.object);
        memento.setup((m) => m.get(NATIVE_REPL_URI_MEMENTO)).returns(() => undefined);
    });

    teardown(() => {
        disposableArray.forEach((d) => {
            if (d) {
                d.dispose();
            }
        });
        disposableArray = [];
        sinon.restore();
        extensionContext?.reset();
        memento?.reset();
    });

    test('getNativeRepl should call create constructor', async () => {
        const createMethodStub = sinon.stub(NativeRepl, 'create');
        interpreterService
            .setup((i) => i.getActiveInterpreter(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(({ path: 'ps' } as unknown) as PythonEnvironment));
        const interpreter = await interpreterService.object.getActiveInterpreter();
        await getNativeRepl(interpreter as PythonEnvironment, disposableArray, extensionContext.object);

        expect(createMethodStub.calledOnce).to.be.true;
    });

    test('sendToNativeRepl with undefined URI should not try to reload', async () => {
        memento.setup((m) => m.get(NATIVE_REPL_URI_MEMENTO)).returns(() => undefined);

        interpreterService
            .setup((i) => i.getActiveInterpreter(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(({ path: 'ps' } as unknown) as PythonEnvironment));
        const interpreter = await interpreterService.object.getActiveInterpreter();
        const nativeRepl = await getNativeRepl(
            interpreter as PythonEnvironment,
            disposableArray,
            extensionContext.object,
        );

        nativeRepl.sendToNativeRepl(undefined, false);

        expect(getTabNameForUriStub.notCalled).to.be.true;
    });

    test('create should call setReplDirectory, setReplController', async () => {
        const interpreter = await interpreterService.object.getActiveInterpreter();
        interpreterService
            .setup((i) => i.getActiveInterpreter(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(({ path: 'ps' } as unknown) as PythonEnvironment));

        await NativeRepl.create(interpreter as PythonEnvironment, extensionContext.object);

        expect(setReplDirectoryStub.calledOnce).to.be.true;
        expect(setReplControllerSpy.calledOnce).to.be.true;

        setReplDirectoryStub.restore();
        setReplControllerSpy.restore();
    });
});
