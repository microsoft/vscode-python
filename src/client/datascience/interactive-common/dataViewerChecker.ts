import { ConfigurationTarget } from 'vscode';
import { IApplicationShell } from '../../common/application/types';
import { IConfigurationService, Resource } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { ColumnWarningSize } from '../data-viewing/types';

// This helper class validates requests to show large data in the data viewer and configures related settings.
export class DataViewerChecker {
    constructor(private configuration: IConfigurationService, private applicationShell: IApplicationShell) {}

    public async isRequestedColumnSizeAllowed(columnSize: number, owningResource?: Resource): Promise<boolean> {
        if (columnSize > ColumnWarningSize && (await this.shouldAskForLargeData(owningResource))) {
            const message = localize.DataScience.tooManyColumnsMessage();
            const yes = localize.DataScience.tooManyColumnsYes();
            const no = localize.DataScience.tooManyColumnsNo();
            const dontAskAgain = localize.DataScience.tooManyColumnsDontAskAgain();

            const result = await this.applicationShell.showWarningMessage(message, yes, no, dontAskAgain);
            if (result === dontAskAgain) {
                await this.disableAskForLargeData();
            }
            return result === yes;
        }
        return true;
    }

    private async shouldAskForLargeData(owningResource?: Resource): Promise<boolean> {
        const settings = owningResource
            ? this.configuration.getSettings(owningResource)
            : this.configuration.getSettings();
        return settings && settings.datascience && settings.datascience.askForLargeDataFrames === true;
    }

    private async disableAskForLargeData(owningResource?: Resource): Promise<void> {
        const settings = owningResource
            ? this.configuration.getSettings(owningResource)
            : this.configuration.getSettings();
        if (settings && settings.datascience) {
            settings.datascience.askForLargeDataFrames = false;
            this.configuration
                .updateSetting('dataScience.askForLargeDataFrames', false, undefined, ConfigurationTarget.Global)
                .ignoreErrors();
        }
    }
}
