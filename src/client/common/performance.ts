import * as fs from 'fs-extra';
import * as path from 'path';
import { IStopWatch, StopWatch } from './utils/stopWatch';
import { EXTENSION_ROOT_DIR } from '../constants';

let _stopWatch: IStopWatch;

let _log: fs.WriteStream;
export function logTime(msg: string): void {
    if (!_stopWatch) {
        _stopWatch = new StopWatch();
        _log = fs.createWriteStream(path.join(EXTENSION_ROOT_DIR, `perf-logs-${Date.now()}.log`), {
            autoClose: true,
            flags: 'w',
        });
    }
    _log.write(`PERF[${_stopWatch?.elapsedTime}]: ${msg}\r\n`);
    console.log(`PERF[${_stopWatch?.elapsedTime}]: ${msg}`);
}
