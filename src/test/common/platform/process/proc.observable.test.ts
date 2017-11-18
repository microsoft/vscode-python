import { expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { BufferDecoder } from '../../../../client/common/platform/process/decoder';
import { ProcessService } from '../../../../client/common/platform/process/proc';
import { initialize } from './../../../initialize';

use(chaiAsPromised);

suite('ProcessService', () => {
    setup(initialize);
    teardown(initialize);

    test('execObservable should work for simple python print statements', async () => {
        const procService = new ProcessService(new BufferDecoder());
        const printOutput = '1234';
        const result = procService.execObservable('python', ['-c', `print("${printOutput}")`]);

        expect(result).not.to.be.an('undefined', 'result is undefined');
        const output = await result.out.toPromise();
        expect(output.out).to.have.length.greaterThan(0, 'Invalid output length');
        const stdOut = output.out.replace(/\s+$/g, '');
        expect(stdOut).to.equal(printOutput, 'Output is incorrect');
    });

    test('execObservable should work stream output', function (done) {
        // tslint:disable-next-line:no-invalid-this
        this.timeout(5000);
        const procService = new ProcessService(new BufferDecoder());
        const pythonCode = ['import sys', 'import time',
            'print("1")', 'sys.stdout.flush()', 'time.sleep(1)',
            'print("2")', 'sys.stdout.flush()', 'time.sleep(1)',
            'print("3")'];
        const result = procService.execObservable('python', ['-c', pythonCode.join(';')]);
        const outputs = ['1', '2', '3'];

        expect(result).not.to.be.an('undefined', 'result is undefined');
        result.out.subscribe(value => {
            const expectedValue = outputs.shift();
            if (expectedValue !== value.out.replace(/\s+$/g, '')) {
                done(`Received value ${value} is not same as the expectd value ${expectedValue}`);
            }
            if (value.source !== 'stdout') {
                done(`Source is not stdout. Value received is ${value.source}`);
            }
        }, done, done);
    });
});
