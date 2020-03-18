import { injectable } from 'inversify';
import { Event, EventEmitter } from 'vscode';
import { noop } from '../../common/utils/misc';
import { IInteractiveWindowListener } from '../types';

@injectable()
// This class handles all of the ipywidgets communication with the notebook
export class IpywidgetHandler implements IInteractiveWindowListener {
    // tslint:disable-next-line: no-any
    private postEmitter: EventEmitter<{ message: string; payload: any }> = new EventEmitter<{
        message: string;
        // tslint:disable-next-line: no-any
        payload: any;
    }>();
    // Map of file to Map of start line to actual hash

    public dispose() {
        noop();
    }

    // tslint:disable-next-line: no-any
    public get postMessage(): Event<{ message: string; payload: any }> {
        return this.postEmitter.event;
    }

    // tslint:disable-next-line: no-any
    public onMessage(message: string, _payload?: any): void {
        switch (message) {
            // case InteractiveWindowMessages.NotebookExecutionActivated:
            //     // Finish this after the notebook provider redesign
            //     break;

            default:
                break;
        }
    }
}
