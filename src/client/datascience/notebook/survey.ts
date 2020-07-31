// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IExtensionSingleActivationService } from '../../activation/types';
import { IApplicationShell, IVSCodeNotebook } from '../../common/application/types';
import { traceError } from '../../common/logger';
import { IBrowserService, IDisposableRegistry, IPersistentStateFactory } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { MillisecondsInADay } from '../../constants';
import { INotebookEditorProvider } from '../types';

const surveyLink = 'https://aka.ms/pyaivscnbsurvey';
const storageKey = 'NotebookSurveyUsageData';

export type NotebookSurveyUsageData = {
    numberOfExecutionsInCurrentSession?: number;
    numberOfCellActionsInCurrentSession?: number;
    numberOfExecutionsInPreviousSessions?: number;
    numberOfCellActionsInPreviousSessions?: number;
    surveyDisabled?: boolean;
    lastUsedDateTime?: number;
};

@injectable()
export class NotebookSurveyBanner {
    public get enabled(): boolean {
        return !this.persistentState.createGlobalPersistentState<NotebookSurveyUsageData>(storageKey, {}).value
            .surveyDisabled;
    }
    private disabledInCurrentSession: boolean = false;
    constructor(
        @inject(IApplicationShell) private appShell: IApplicationShell,
        @inject(IPersistentStateFactory) private persistentState: IPersistentStateFactory,
        @inject(IBrowserService) private browserService: IBrowserService
    ) {}

    public async showBanner(): Promise<void> {
        if (!this.enabled || this.disabledInCurrentSession) {
            return;
        }

        const show = await this.shouldShowBanner();
        if (!show || this.disabledInCurrentSession) {
            return;
        }

        this.disabledInCurrentSession = true;
        const response = await this.appShell.showInformationMessage(
            localize.DataScienceNotebookSurveyBanner.bannerMessage(),
            localize.CommonSurvey.yesLabel(),
            localize.CommonSurvey.noLabel(),
            localize.CommonSurvey.remindMeLaterLabel()
        );
        switch (response) {
            case localize.CommonSurvey.yesLabel(): {
                this.browserService.launch(surveyLink);
                await this.disable();
                break;
            }
            case localize.CommonSurvey.noLabel(): {
                await this.disable();
                break;
            }
            default: {
                // Disable for the current session.
                this.disabledInCurrentSession = true;
            }
        }
    }

    private async disable(): Promise<void> {
        await this.persistentState
            .createGlobalPersistentState<NotebookSurveyUsageData>(storageKey, {})
            .updateValue({ surveyDisabled: true });
    }

    private async shouldShowBanner(): Promise<boolean> {
        if (!this.enabled || this.disabledInCurrentSession) {
            return false;
        }
        const currentDate = new Date();
        if (currentDate.getMonth() < 7 && currentDate.getFullYear() <= 2020) {
            return false;
        }

        const data = this.persistentState.createGlobalPersistentState<NotebookSurveyUsageData>(storageKey, {});

        const totalActionsInPreviousSessions =
            (data.value.numberOfCellActionsInPreviousSessions || 0) +
            (data.value.numberOfExecutionsInPreviousSessions || 0);
        // If user barely tried nb in a previous session, then possible it wasn't a great experience.
        if (totalActionsInPreviousSessions > 0 && totalActionsInPreviousSessions < 5) {
            return true;
        }

        const totalActionsInCurrentSessions =
            (data.value.numberOfCellActionsInCurrentSession || 0) +
            (data.value.numberOfExecutionsInCurrentSession || 0);
        // If more than 100 actions in total then get feedback.
        if (totalActionsInPreviousSessions + totalActionsInCurrentSessions > 100) {
            return true;
        }

        // If more than 5 actions and not used for 5 days since then.
        // Geed feedback, possible it wasn't what they expected, as they have stopped using it.
        if (totalActionsInPreviousSessions > 5 && data.value.lastUsedDateTime) {
            const daysSinceLastUsage = (new Date().getTime() - data.value.lastUsedDateTime) / MillisecondsInADay;
            if (daysSinceLastUsage > 5) {
                return true;
            }
        }

        return false;
    }
}

/*
Survey after > 100 actions in notebooks (+remind me later)
Survey after > 5 & not used for 5 days (+remind me later)
Survey after < 5 operations in notebooks & closed it (+remind me later)
*/

@injectable()
export class NotebookSurveyDataLogger implements IExtensionSingleActivationService {
    constructor(
        @inject(IPersistentStateFactory) private readonly persistentState: IPersistentStateFactory,
        @inject(IVSCodeNotebook) private readonly vscNotebook: IVSCodeNotebook,
        @inject(INotebookEditorProvider) private readonly notebookEditorProvider: INotebookEditorProvider,
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
        // tslint:disable-next-line: no-use-before-declare
        @inject(NotebookSurveyBanner) private readonly survey: NotebookSurveyBanner
    ) {}
    public async activate() {
        if (!this.survey.enabled) {
            return;
        }

        this.notebookEditorProvider.onDidOpenNotebookEditor(
            (e) => {
                if (e.type !== 'native') {
                    return;
                }
                e.onExecutedCode(() => this.incrementCellExecution(), this, this.disposables);
            },
            this,
            this.disposables
        );
        this.vscNotebook.onDidChangeNotebookDocument(
            (e) => {
                if (e.type === 'changeCells' || e.type === 'changeCellLanguage') {
                    this.incrementCellAction().catch(traceError.bind(undefined, 'Failed to update survey data'));
                }
            },
            this,
            this.disposables
        );

        this.migrateDataAndDisplayBanner().catch(traceError.bind(undefined, 'Failed to migrate survey data'));
    }
    private async migrateDataAndDisplayBanner() {
        const data = this.persistentState.createGlobalPersistentState<NotebookSurveyUsageData>(storageKey, {});
        // The user has loaded a new instance of VSC, and we need to move numbers from previous session into the respective storage props.
        if (data.value.numberOfCellActionsInCurrentSession || data.value.numberOfExecutionsInCurrentSession) {
            data.value.numberOfCellActionsInPreviousSessions = data.value.numberOfCellActionsInPreviousSessions || 0;
            data.value.numberOfCellActionsInPreviousSessions += data.value.numberOfCellActionsInCurrentSession || 0;
            data.value.numberOfCellActionsInCurrentSession = 0; // Reset for new session.

            data.value.numberOfExecutionsInPreviousSessions = data.value.numberOfExecutionsInPreviousSessions || 0;
            data.value.numberOfExecutionsInPreviousSessions += data.value.numberOfExecutionsInCurrentSession || 0;
            data.value.numberOfExecutionsInCurrentSession = 0; // Reset for new session.

            data.value.lastUsedDateTime = new Date().getTime();
            await data.updateValue(data.value);
        }

        await this.survey.showBanner();
    }
    private async incrementCellAction() {
        const data = this.persistentState.createGlobalPersistentState<NotebookSurveyUsageData>(storageKey, {});

        data.value.numberOfCellActionsInCurrentSession = (data.value.numberOfCellActionsInCurrentSession || 0) + 1;
        data.value.lastUsedDateTime = new Date().getTime();
        await data.updateValue(data.value);
        await this.survey.showBanner();
    }
    private async incrementCellExecution() {
        const data = this.persistentState.createGlobalPersistentState<NotebookSurveyUsageData>(storageKey, {});
        data.value.numberOfExecutionsInCurrentSession = (data.value.numberOfExecutionsInCurrentSession || 0) + 1;
        data.value.lastUsedDateTime = new Date().getTime();
        await data.updateValue(data.value);
        await this.survey.showBanner();
    }
}
