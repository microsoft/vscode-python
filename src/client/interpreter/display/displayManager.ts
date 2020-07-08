// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable, multiInject } from 'inversify';
import { IExtensionSingleActivationService } from '../../activation/types';
import { IDocumentManager, IVSCodeNotebook } from '../../common/application/types';
import { IDisposableRegistry } from '../../common/types';
import { IInterpreterDisplay, IInterpreterStatusbarVisibilityFilter } from '../contracts';

/**
 * Create this class as Inversify doesn't allow @multiinject if there are no registered items.
 * i.e. we must always have one for @multiinject to work.
 */
@injectable()
export class AlwaysDisplayStatusBar implements IInterpreterStatusbarVisibilityFilter {
    public shouldDisplayStatusBar(): boolean {
        return false;
    }
}

@injectable()
export class InterpreterStatusbarDisplayManager implements IExtensionSingleActivationService {
    constructor(
        @multiInject(IInterpreterStatusbarVisibilityFilter)
        private readonly filters: IInterpreterStatusbarVisibilityFilter[],
        @inject(IInterpreterDisplay) private readonly interpreterDisplay: IInterpreterDisplay,
        @inject(IDocumentManager) private readonly documentManager: IDocumentManager,
        @inject(IVSCodeNotebook) private readonly vscNotebook: IVSCodeNotebook,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry
    ) {}
    /**
     * This class controls the triggers that can result in the visibility of an interpreter.
     * We don't want classes to directly control visibility by calling show/hide, as its possible that one class doesn't need to hide it and calls show,
     *  then another calls hide, this results in a race and last one wins (due to state management).
     * State/Visibility of statusbar state is managed by this class (single place).
     */
    public async activate(): Promise<void> {
        if (!this.filters.length) {
            return;
        }
        this.documentManager.onDidChangeActiveTextEditor(this.updateStatusBarDisplay, this, this.disposables);
        this.vscNotebook.onDidChangeActiveNotebookEditor(this.updateStatusBarDisplay, this, this.disposables);
        // Similarly, if we ever wanted to control the visibility of the status bar when interpreter or workspace folder changes, we can call the filters as required.
        // this.interpreter.onDidChangeInterpreter(this.updateStatusBarDisplay, this, this.disposables);
        // this.workspace.onDidChangeWorkspaceFolders(this.updateStatusBarDisplay, this, this.disposables);
    }
    private updateStatusBarDisplay() {
        if (this.filters.map((filter) => filter.shouldDisplayStatusBar()).every((show) => show)) {
            this.interpreterDisplay.show();
        } else {
            this.interpreterDisplay.hide();
        }
    }
}
