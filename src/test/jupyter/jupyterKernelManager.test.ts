import * as assert from 'assert';
import * as vscode from 'vscode';
import { MockOutputChannel } from './mocks';
import { initialize, initializeTest, IS_MULTI_ROOT_TEST } from './../initialize';
import { JupyterClientAdapter } from '../../client/jupyter/jupyter_client/main';
import { KernelManagerImpl } from '../../client/jupyter/kernel-manager';

suite('Jupyter Kernel Manager', () => {
    suiteSetup(async function () {
        if (IS_MULTI_ROOT_TEST) {
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }
        await initialize();
    });
    setup(() => {
        process.env['VSC_PYTHON_CI_TEST'] = '0';
        process.env['DEBUG_DJAYAMANNE_IPYTHON'] = '1';
        disposables = [];
        output = new MockOutputChannel('Jupyter');
        disposables.push(output);
        jupyter = new JupyterClientAdapter(output, __dirname);
        disposables.push(jupyter);
        // Hack hack hack hack hack :)
        cmds.registerCommand = function () { };
        return initializeTest();
    });
    teardown(() => {
        process.env['VSC_PYTHON_CI_TEST'] = '1';
        process.env['DEBUG_DJAYAMANNE_IPYTHON'] = '0';
        output.dispose();
        jupyter.dispose();
        disposables.forEach(d => {
            try {
                d.dispose();
            } catch (error) {
            }
        });
        cmds.registerCommand = oldRegisterCommand;
    });

    let output: MockOutputChannel;
    let jupyter: JupyterClientAdapter;
    let disposables: { dispose: Function }[];
    const cmds = (vscode.commands as any);
    const oldRegisterCommand = vscode.commands.registerCommand;

    test('GetAllKernelSpecsFor python', done => {
        process.env['VSC_PYTHON_CI_TEST'] = '0';
        const mgr = new KernelManagerImpl(output, jupyter);
        disposables.push(mgr);
        mgr.getAllKernelSpecsFor('python').then(specMetadata => {
            assert.notEqual(specMetadata.length, 0, 'No spec metatadata');
            done();
        }).catch(reason => {
            assert.fail(reason, null, 'Some error', '');
        });
    });
    test('Start a kernel', done => {
        const mgr = new KernelManagerImpl(output, jupyter);
        disposables.push(mgr);
        mgr.getAllKernelSpecsFor('python').then(specMetadata => {
            assert.notEqual(specMetadata.length, 0, 'No spec metatadata');
            return mgr.startKernel(specMetadata[0], 'python');
        }).then(kernel => {
            assert.equal(typeof kernel === 'object' && kernel !== null, true, 'Kernel instance not returned');
            done();
        }).catch(reason => {
            assert.fail(reason, null, 'Some error', '');
        });
    });
    test('Start any kernel for Python', done => {
        const mgr = new KernelManagerImpl(output, jupyter);
        disposables.push(mgr);
        mgr.startKernelFor('python').then(kernel => {
            assert.equal(typeof kernel === 'object' && kernel !== null, true, 'Kernel instance not returned');
            done();
        }).catch(reason => {
            assert.fail(reason, null, 'Some error', '');
            done();
        });
    });
});
