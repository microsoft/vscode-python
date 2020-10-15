import { injectable } from 'inversify';
import { Event, EventEmitter } from 'vscode';
import type { NotebookCell } from 'vscode-proposed';
import { INotebookExtensibility } from './types';

@injectable()
export class NotebookExtensibility implements INotebookExtensibility {
    private kernelExecute = new EventEmitter<NotebookCell>();

    private kernelRestart = new EventEmitter<void>();

    public get onKernelPostExecute(): Event<NotebookCell> {
        return this.kernelExecute.event;
    }

    public get onKernelRestart(): Event<void> {
        return this.kernelRestart.event;
    }

    public fireKernelRestart(): void {
        this.kernelRestart.fire();
    }

    public fireKernelPostExecute(cell: NotebookCell): void {
        this.kernelExecute.fire(cell);
    }
}
