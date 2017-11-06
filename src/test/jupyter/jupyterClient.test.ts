import * as assert from 'assert';
import { MockOutputChannel } from './mocks';
import { initialize, initializeTest, IS_MULTI_ROOT_TEST } from './../initialize';
import { JupyterClientAdapter } from '../../client/jupyter/jupyter_client/main';
import { KernelRestartedError, KernelShutdownError } from '../../client/jupyter/common/errors';
import { createDeferred } from '../../client/common/helpers';
import { KernelspecMetadata } from '../../client/jupyter/contracts';

suite('JupyterClient', () => {
    suiteSetup(async function () {
        if (IS_MULTI_ROOT_TEST) {
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }
        await initialize();
    });
    setup(() => {
        process.env['VSC_PYTHON_CI_TEST'] = '0';
        process.env['DEBUG_EXTENSION_IPYTHON'] = '1';
        output = new MockOutputChannel('Jupyter');
        jupyter = new JupyterClientAdapter(output, __dirname);
        return initializeTest();
    });
    teardown(() => {
        process.env['VSC_PYTHON_CI_TEST'] = '1';
        process.env['DEBUG_EXTENSION_IPYTHON'] = '0';
        output.dispose();
        jupyter.dispose();
    });

    let output: MockOutputChannel;
    let jupyter: JupyterClientAdapter;

    test('Ping (Process and Socket)', done => {
        jupyter.start({ 'VSC_PYTHON_CI_TEST': '1', 'DEBUG_EXTENSION_IPYTHON': '1' }).then(() => {
            done();
        }).catch(reason => {
            assert.fail(reason, undefined, 'Starting Jupyter failed', '');
            done();
        });
    });
    test('Start Jupyter Adapter (Socket Client)', done => {
        jupyter.start().then(() => {
            done();
        }).catch(reason => {
            assert.fail(reason, undefined, 'Failed to start jupyter adapter', '');
            done();
        });
    });
    test('List Kernels (with start)', done => {
        jupyter.start().then(() => {
            return jupyter.getAllKernelSpecs();
        }).then(kernelSpecs => {
            assert.notEqual(Object.keys(kernelSpecs).length, 0, 'kernelSpecs not found');
            done();
        }).catch(reason => {
            assert.fail(reason, undefined, 'Failed to retrieve kernelspecs', '');
            done();
        });
    });
    test('List Kernels (without starting)', done => {
        jupyter.getAllKernelSpecs().then(kernelSpecs => {
            assert.notEqual(Object.keys(kernelSpecs).length, 0, 'kernelSpecs not found');
            done();
        }).catch(reason => {
            assert.fail(reason, undefined, 'Failed to retrieve kernelspecs', '');
            done();
        });
    });

    test('Start Kernel (with start)', done => {
        jupyter.start().then(() => {
            return jupyter.getAllKernelSpecs();
        }).then(kernelSpecs => {
            const kernelNames = Object.keys(kernelSpecs);
            assert.notEqual(kernelNames.length, 0, 'kernelSpecs not found');
            // Get name of any kernel
            return jupyter.startKernel(kernelSpecs[kernelNames[0]].spec);
        }).then(startedInfo => {
            assert.equal(startedInfo.length, 3, 'Information for kernel start incorrect');
            assert.equal(typeof (startedInfo[0]), 'string', 'First part of information for kernel start incorrect');
            assert.equal(typeof (startedInfo[2]), 'string', 'Last part of information for kernel start incorrect');
            done();
        }).catch(reason => {
            assert.fail(reason, undefined, 'Failed to retrieve kernelspecs', '');
            done();
        });
    });
    test('Start Kernel (without start)', done => {
        jupyter.getAllKernelSpecs().then(kernelSpecs => {
            process.env['VSC_PYTHON_CI_TEST'] = '0';

            // Ok we got the kernelspecs, now create another new jupyter client
            // and tell it to start a specific kernel
            const jupyter2 = new JupyterClientAdapter(output, __dirname);
            const kernelNames = Object.keys(kernelSpecs);
            jupyter2.startKernel(kernelSpecs[kernelNames[0]].spec).then(startedInfo => {
                assert.equal(startedInfo.length, 3, 'Information for kernel start incorrect');
                assert.equal(typeof (startedInfo[0]), 'string', 'First part of information for kernel start incorrect');
                assert.equal(typeof (startedInfo[2]), 'string', 'Last part of information for kernel start incorrect');
                done();
            }).catch(reason => {
                assert.fail(reason, undefined, 'Failed to retrieve kernelspecs', '');
                done();
            });

            process.env['VSC_PYTHON_CI_TEST'] = '1';

        }).catch(reason => {
            assert.fail(reason, undefined, 'Failed to retrieve kernelspecs', '');
            done();
        });
    });
    test('Execute Code (success)', done => {
        jupyter.start().then(() => {
            return jupyter.getAllKernelSpecs();
        }).then(kernelSpecs => {
            const kernelNames = Object.keys(kernelSpecs);
            assert.notEqual(kernelNames.length, 0, 'kernelSpecs not found');
            // Get name of any kernel
            return jupyter.startKernel(kernelSpecs[kernelNames[0]].spec);
        }).then(startedInfo => {
            const output = [];
            jupyter.runCode('1+2').subscribe(data => {
                output.push(data);
            }, reason => {
                assert.fail(reason, null, 'Code execution failed in jupyter', '');
                done();
            }, () => {
                assert.equal(output.some(d => d.stream === 'pyout' && d.type === 'text' && d.data['text/plain'] === '3'), true, 'pyout not found in output');
                assert.equal(output.some(d => d.stream === 'status' && d.type === 'text' && d.data === 'ok'), true, 'status not found in output');
                done();
            });
        }).catch(reason => {
            assert.fail(reason, undefined, 'Failed to retrieve kernelspecs', '');
            done();
        });
    });
    test('Execute Code (with threads)', done => {
        jupyter.start().then(() => {
            return jupyter.getAllKernelSpecs();
        }).then(kernelSpecs => {
            const kernelNames = Object.keys(kernelSpecs);
            assert.notEqual(kernelNames.length, 0, 'kernelSpecs not found');
            // Get name of any kernel
            return jupyter.startKernel(kernelSpecs[kernelNames[0]].spec);
        }).then(startedInfo => {
            const output = [];
            jupyter.runCode('print(2)\nimport time\ntime.sleep(5)\nprint(3)').subscribe(data => {
                output.push(data);
            }, reason => {
                assert.fail(reason, null, 'Code execution failed in jupyter', '');
                done();
            }, () => {
                assert.equal(output.some(d => d.stream === 'stdout' && d.type === 'text' && d.data['text/plain'] === '2'), true, 'stdout (2) not found in output');
                assert.equal(output.some(d => d.stream === 'stdout' && d.type === 'text' && d.data['text/plain'] === '3'), true, 'stdout (3) not found in output');
                assert.equal(output.some(d => d.stream === 'status' && d.type === 'text' && d.data === 'ok'), true, 'status not found in output');
                done();
            });
        }).catch(reason => {
            assert.fail(reason, undefined, 'Failed to retrieve kernelspecs', '');
            done();
        });
    });
    test('Execute Code (failure)', done => {
        jupyter.start().then(() => {
            return jupyter.getAllKernelSpecs();
        }).then(kernelSpecs => {
            const kernelNames = Object.keys(kernelSpecs);
            assert.notEqual(kernelNames.length, 0, 'kernelSpecs not found');
            // Get name of any kernel
            return jupyter.startKernel(kernelSpecs[kernelNames[0]].spec);
        }).then(startedInfo => {
            const output = [];
            jupyter.runCode('print(x)').subscribe(data => {
                output.push(data);
            }, reason => {
                assert.fail(reason, null, 'Code execution failed in jupyter', '');
                done();
            }, () => {
                assert.equal(output.some(d => d.stream === 'error' && d.type === 'text'), true, 'error not found in output');
                assert.equal(output.some(d => d.stream === 'status' && d.type === 'text' && d.data === 'error'), true, 'status not found in output');
                done();
            });
        }).catch(reason => {
            assert.fail(reason, undefined, 'Failed to retrieve kernelspecs', '');
            done();
        });
    });
    test('Shutdown Kernel', done => {
        jupyter.start().then(() => {
            return jupyter.getAllKernelSpecs();
        }).then(kernelSpecs => {
            const kernelNames = Object.keys(kernelSpecs);
            assert.notEqual(kernelNames.length, 0, 'kernelSpecs not found');
            // Get name of any kernel
            return jupyter.startKernel(kernelSpecs[kernelNames[0]].spec);
        }).then(startedInfo => {
            assert.equal(startedInfo.length, 3, 'Information for kernel start incorrect');
            assert.equal(typeof (startedInfo[0]), 'string', 'First part of information for kernel start incorrect');
            assert.equal(typeof (startedInfo[2]), 'string', 'Last part of information for kernel start incorrect');

            return jupyter.shutdownkernel(startedInfo[0]);
        }).then(() => {
            done();
        }).catch(reason => {
            assert.fail(reason, undefined, 'Failed to retrieve kernelspecs', '');
            done();
        });
    });
    test('Shutdown while executing code', done => {
        jupyter.start().then(() => {
            return jupyter.getAllKernelSpecs();
        }).then(kernelSpecs => {
            const kernelNames = Object.keys(kernelSpecs);
            assert.notEqual(kernelNames.length, 0, 'kernelSpecs not found');
            // Get name of any kernel
            return jupyter.startKernel(kernelSpecs[kernelNames[0]].spec);
        }).then(startedInfo => {
            const output = [];
            let runFailedWithError = false;
            jupyter.runCode('print(2)\nimport time\ntime.sleep(5)\nprint(3)').subscribe(data => {
                output.push(data);
                if (output.length === 1) {
                    // Shutdown this kernel immediately
                    jupyter.shutdownkernel(startedInfo[0]).then(() => {
                        assert.equal(runFailedWithError, true, 'Error event not raised in observale');
                        done();
                    }, reason => {
                        assert.fail(reason, null, 'Failed to shutdown the kernel', '');
                    });
                }
            }, reason => {
                if (reason instanceof KernelShutdownError) {
                    runFailedWithError = true;
                }
                else {
                    assert.fail(reason, null, 'Code execution failed in jupyter with invalid error', '');
                }
            }, () => {
                assert.fail('Complete event fired', 'none', 'Completed fired for observable', '');
            });
        }).catch(reason => {
            assert.fail(reason, undefined, 'Failed to retrieve kernelspecs', '');
            done();
        });
    });

    test('Execute code after shutdowning down when executing code', done => {
        let kernelSpecUsed: KernelspecMetadata;
        jupyter.start().then(() => {
            return jupyter.getAllKernelSpecs();
        }).then(kernelSpecs => {
            const kernelNames = Object.keys(kernelSpecs);
            assert.notEqual(kernelNames.length, 0, 'kernelSpecs not found');
            // Get name of any kernel
            kernelSpecUsed = kernelSpecs[kernelNames[0]].spec;
            return jupyter.startKernel(kernelSpecUsed);
        }).then(startedInfo => {
            const output = [];
            let runFailedWithError = false;
            jupyter.runCode('print(2)\nimport time\ntime.sleep(5)\nprint(3)').subscribe(data => {
                output.push(data);
                if (output.length === 1) {
                    // Shutdown this kernel immediately
                    jupyter.shutdownkernel(startedInfo[0]).then(() => {
                        assert.equal(runFailedWithError, true, 'Error event not raised in observale');
                        jupyter.startKernel(kernelSpecUsed).then(() => {
                            const output2 = [];
                            jupyter.runCode('1+2').subscribe(data => {
                                output2.push(data);
                            }, reason => {
                                assert.fail(reason, null, 'Code execution failed in jupyter', '');
                            }, () => {
                                assert.equal(output2.some(d => d.stream === 'pyout' && d.type === 'text' && d.data['text/plain'] === '3'), true, 'pyout not found in output');
                                assert.equal(output2.some(d => d.stream === 'status' && d.type === 'text' && d.data === 'ok'), true, 'status not found in output');
                                done();
                            });
                        }).catch(reason => {
                            assert.fail(reason, null, 'Failed to restart the kernel', '');
                        });
                    }, reason => {
                        assert.fail(reason, null, 'Failed to shutdown the kernel', '');
                    });
                }
            }, reason => {
                if (reason instanceof KernelShutdownError) {
                    runFailedWithError = true;
                }
                else {
                    assert.fail(reason, null, 'Code execution failed in jupyter with invalid error', '');
                }
            }, () => {
                assert.fail('Complete event fired', 'none', 'Completed fired for observable', '');
            });
        }).catch(reason => {
            assert.fail(reason, undefined, 'Failed to retrieve kernelspecs', '');
            done();
        });
    });

    test('Interrupt Kernel', done => {
        jupyter.start().then(() => {
            return jupyter.getAllKernelSpecs();
        }).then(kernelSpecs => {
            const kernelNames = Object.keys(kernelSpecs);
            assert.notEqual(kernelNames.length, 0, 'kernelSpecs not found');
            // Get name of any kernel
            return jupyter.startKernel(kernelSpecs[kernelNames[0]].spec);
        }).then(startedInfo => {
            assert.equal(startedInfo.length, 3, 'Information for kernel start incorrect');
            assert.equal(typeof (startedInfo[0]), 'string', 'First part of information for kernel start incorrect');
            assert.equal(typeof (startedInfo[2]), 'string', 'Last part of information for kernel start incorrect');

            return jupyter.interruptKernel(startedInfo[0]);
        }).then(() => {
            jupyter.dispose();
            setTimeout(function () {
                done();

            }, 5000);
        }).catch(reason => {
            assert.fail(reason, undefined, 'Failed to retrieve kernelspecs', '');
        });
    });
    test('Interrupt Kernel while executing code', done => {
        jupyter.start().then(() => {
            return jupyter.getAllKernelSpecs();
        }).then(kernelSpecs => {
            const kernelNames = Object.keys(kernelSpecs);
            assert.notEqual(kernelNames.length, 0, 'kernelSpecs not found');
            // Get name of any kernel
            return jupyter.startKernel(kernelSpecs[kernelNames[0]].spec);
        }).then(startedInfo => {
            const output = [];
            jupyter.runCode('print(2)\nimport time\ntime.sleep(5)\nprint(3)').subscribe(data => {
                output.push(data);

                if (output.length === 1) {
                    // interrupt this kernel immediately
                    jupyter.interruptKernel(startedInfo[0]).then(() => {
                        // Do nothing
                    }, reason => {
                        assert.fail(reason, null, 'Failed to interrupt the kernel', '');
                    });
                }
            }, reason => {
                assert.fail(reason, null, 'Code execution failed in jupyter with invalid error', '');
            }, () => {
                assert.equal(output.some(d => d.stream === 'stdout' && d.type === 'text' && d.data['text/plain'] === '2'), true, 'stdout not found in output');
                assert.equal(output.some(d => d.stream === 'error' && d.type === 'text'), true, 'error (KeyboardInterrupt) not found');
                assert.equal(output.some(d => d.stream === 'status' && d.type === 'text' && d.data === 'error'), true, 'status not found in output');
                jupyter.dispose();
                done();
            });
        }).catch(reason => {
            assert.fail(reason, undefined, 'Failed to retrieve kernelspecs', '');
        });
    });
    test('Restart Kernel', done => {
        jupyter.start().then(() => {
            return jupyter.getAllKernelSpecs();
        }).then(kernelSpecs => {
            const kernelNames = Object.keys(kernelSpecs);
            assert.notEqual(kernelNames.length, 0, 'kernelSpecs not found');
            // Get name of any kernel
            return jupyter.startKernel(kernelSpecs[kernelNames[0]].spec);
        }).then(startedInfo => {
            assert.equal(startedInfo.length, 3, 'Information for kernel start incorrect');
            assert.equal(typeof (startedInfo[0]), 'string', 'First part of information for kernel start incorrect');
            assert.equal(typeof (startedInfo[2]), 'string', 'Last part of information for kernel start incorrect');

            return jupyter.restartKernel(startedInfo[0]);
        }).then(() => {
            done();
        }).catch(reason => {
            assert.fail(reason, undefined, 'Failed to resrart the kernel', '');
            done();
        });
    });
    test('Restart while executing code', done => {
        jupyter.start().then(() => {
            return jupyter.getAllKernelSpecs();
        }).then(kernelSpecs => {
            const kernelNames = Object.keys(kernelSpecs);
            assert.notEqual(kernelNames.length, 0, 'kernelSpecs not found');
            // Get name of any kernel
            return jupyter.startKernel(kernelSpecs[kernelNames[0]].spec);
        }).then(startedInfo => {
            const output = [];
            let runFailedWithError = false;
            jupyter.runCode('print(2)\nimport time\ntime.sleep(5)\nprint(3)').subscribe(data => {
                output.push(data);
                if (output.length === 1) {
                    // Shutdown this kernel immediately
                    jupyter.restartKernel(startedInfo[0]).then(() => {
                        assert.equal(runFailedWithError, true, 'Error event not raised in observale');
                        done();
                    }, reason => {
                        assert.fail(reason, null, 'Failed to restart the kernel', '');
                    });
                }
            }, reason => {
                if (reason instanceof KernelRestartedError) {
                    runFailedWithError = true;
                }
                else {
                    assert.fail(reason, null, 'Code execution failed in jupyter with invalid error', '');
                }
            }, () => {
                assert.fail('Complete event fired', 'none', 'Completed fired for observable', '');
            });
        }).catch(reason => {
            assert.fail(reason, undefined, 'Failed to retrieve kernelspecs', '');
            done();
        });
        process.env['VSC_PYTHON_CI_TEST'] = '1';
    });
    test('Execute multiple blocks of Code', done => {
        jupyter.start().then(() => {
            return jupyter.getAllKernelSpecs();
        }).then(kernelSpecs => {
            const kernelNames = Object.keys(kernelSpecs);
            assert.notEqual(kernelNames.length, 0, 'kernelSpecs not found');
            // Get name of any kernel
            return jupyter.startKernel(kernelSpecs[kernelNames[0]].spec);
        }).then(startedInfo => {
            const output1 = [];
            const output2 = [];
            const output3 = [];
            const def1 = createDeferred<any>();
            const def2 = createDeferred<any>();
            const def3 = createDeferred<any>();
            jupyter.runCode('1+2').subscribe(data => {
                output1.push(data);
            }, reason => {
                assert.fail(reason, null, 'Code execution failed in jupyter', '');
            }, () => {
                assert.equal(output1.some(d => d.stream === 'pyout' && d.type === 'text' && d.data['text/plain'] === '3'), true, 'pyout not found in output');
                assert.equal(output1.some(d => d.stream === 'status' && d.type === 'text' && d.data === 'ok'), true, 'status not found in output');
                def1.resolve();
            });
            jupyter.runCode('print(2)\nimport time\ntime.sleep(5)\nprint(3)').subscribe(data => {
                output2.push(data);
            }, reason => {
                assert.fail(reason, null, 'Code execution failed in jupyter', '');
            }, () => {
                assert.equal(output2.some(d => d.stream === 'stdout' && d.type === 'text' && d.data['text/plain'] === '2'), true, 'stdout (2) not found in output');
                assert.equal(output2.some(d => d.stream === 'stdout' && d.type === 'text' && d.data['text/plain'] === '3'), true, 'stdout (3) not found in output');
                assert.equal(output2.some(d => d.stream === 'status' && d.type === 'text' && d.data === 'ok'), true, 'status not found in output');
                def2.resolve();
            });
            jupyter.runCode('print(1)').subscribe(data => {
                output3.push(data);
            }, reason => {
                assert.fail(reason, null, 'Code execution failed in jupyter', '');
            }, () => {
                assert.equal(output3.some(d => d.stream === 'stdout' && d.type === 'text' && d.data['text/plain'] === '1'), true, 'pyout not found in output');
                assert.equal(output3.some(d => d.stream === 'status' && d.type === 'text' && d.data === 'ok'), true, 'status not found in output');
                def3.resolve();
            });

            Promise.all([def1.promise, def2.promise, def3.promise]).then(() => {
                done();
            }).catch(reason => {
                assert.fail(reason, null, 'One of the code executions failed', '');
            });
        }).catch(reason => {
            assert.fail(reason, undefined, 'Failed to retrieve kernelspecs', '');
            done();
        });
    });
    test('Status change', done => {
        jupyter.start().then(() => {
            return jupyter.getAllKernelSpecs();
        }).then(kernelSpecs => {
            const kernelNames = Object.keys(kernelSpecs);
            assert.notEqual(kernelNames.length, 0, 'kernelSpecs not found');
            // Get name of any kernel
            return jupyter.startKernel(kernelSpecs[kernelNames[0]].spec);
        }).then(startedInfo => {
            const output = [];
            const statuses = [];
            jupyter.on('status', status => {
                statuses.push(status);
            });
            jupyter.runCode('1+2').subscribe(data => {
                output.push(data);
            }, reason => {
                assert.fail(reason, null, 'Code execution failed in jupyter', '');
                done();
            }, () => {
                assert.equal(output.some(d => d.stream === 'pyout' && d.type === 'text' && d.data['text/plain'] === '3'), true, 'pyout not found in output');
                assert.equal(output.some(d => d.stream === 'status' && d.type === 'text' && d.data === 'ok'), true, 'status not found in output');
                assert.equal(statuses.indexOf('busy'), 0, 'busy status not the first status');
                assert.equal(statuses.indexOf('idle'), 1, 'idle status not the last status');
                done();
            });
        }).catch(reason => {
            assert.fail(reason, undefined, 'Failed to retrieve kernelspecs', '');
            done();
        });
    });
});
