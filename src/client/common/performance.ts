import { IStopWatch, StopWatch } from './utils/stopWatch';

let _stopWatch: IStopWatch;

export function logTime(msg: string): void {
    if (!_stopWatch) {
        _stopWatch = new StopWatch();
    }
    console.log(`PERF[${_stopWatch?.elapsedTime}]: ${msg}`);
}
