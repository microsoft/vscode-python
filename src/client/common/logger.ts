import { injectable } from 'inversify';
import { ILogger } from './types';

const PREFIX = 'Python Extension: ';

@injectable()
export class Logger implements ILogger {
    public logError(message: string, ex?: Error) {
        if (ex) {
            console.error(`${PREFIX}${message}`, error);
        } else {
            console.error(`${PREFIX}${message}`);
        }
    }
    public logWarning(message: string, ex?: Error) {
        if (ex) {
            console.warn(`${PREFIX}${message}`, ex);
        } else {
            console.warn(`${PREFIX}${message}`);
        }
    }
}
// tslint:disable-next-line:no-any
export function error(title: string = '', message: any) {
    new Logger().logError(`${title}, ${message}`);
}
// tslint:disable-next-line:no-any
export function warn(title: string = '', message: any) {
    new Logger().logWarning(`${title}, ${message}`);
}
