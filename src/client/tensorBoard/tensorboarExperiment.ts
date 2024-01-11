// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Disposable, EventEmitter, commands, extensions, l10n, window } from 'vscode';
import { inject, injectable } from 'inversify';
import { IDisposable, IDisposableRegistry, IExperimentService } from '../common/types';
import { RecommendTensobardExtension } from '../common/experiments/groups';
import { TENSORBOARD_EXTENSION_ID } from '../common/constants';

@injectable()
export class TensorboardExperiment {
    private readonly _onDidChange = new EventEmitter<void>();

    public readonly onDidChange = this._onDidChange.event;

    private readonly toDisposeWhenTensobardIsInstalled: IDisposable[] = [];

    public static get isTensorboardExtensionInstalled(): boolean {
        return !!extensions.getExtension(TENSORBOARD_EXTENSION_ID);
    }

    private readonly isExperimentEnabled: boolean;

    constructor(
        @inject(IDisposableRegistry) disposables: IDisposableRegistry,
        @inject(IExperimentService) experiments: IExperimentService,
    ) {
        this.isExperimentEnabled = experiments.inExperimentSync(RecommendTensobardExtension.experiment);
        disposables.push(this._onDidChange);
        extensions.onDidChange(
            () =>
                TensorboardExperiment.isTensorboardExtensionInstalled
                    ? Disposable.from(...this.toDisposeWhenTensobardIsInstalled).dispose()
                    : undefined,
            this,
            disposables,
        );
    }

    public recommendAndUseNewExtension(): 'continueWithPythonExtension' | 'usingTensorboardExtension' {
        if (!this.isExperimentEnabled) {
            return 'continueWithPythonExtension';
        }
        if (TensorboardExperiment.isTensorboardExtensionInstalled) {
            return 'usingTensorboardExtension';
        }
        const install = l10n.t('Install Tensorboard Extension');
        window
            .showInformationMessage(
                l10n.t(
                    'Install the TensorBoard extension to use the this functionality. Once installed, select the command `Launch Tensorboard`.',
                ),
                { modal: true },
                install,
            )
            .then((result): void => {
                if (result === install) {
                    void commands.executeCommand('workbench.extensions.installExtension', TENSORBOARD_EXTENSION_ID);
                }
            });
        return 'usingTensorboardExtension';
    }

    public disposeOnInstallingTensorboard(disposabe: IDisposable): void {
        this.toDisposeWhenTensobardIsInstalled.push(disposabe);
    }
}
