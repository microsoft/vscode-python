import { DocumentRegistry } from '@jupyterlab/docregistry';
import { INotebookModel, NotebookPanel } from '@jupyterlab/notebook';
import { DisposableDelegate, IDisposable } from '@phosphor/disposable';
import { NotificationWidget } from '../widgets/notification';

export class NotifactionExtension implements DocumentRegistry.IWidgetExtension<NotebookPanel, INotebookModel> {
    private notificationWidget: NotificationWidget;

    createNew(panel: NotebookPanel, _: DocumentRegistry.IContext<INotebookModel>): IDisposable {
        this.notificationWidget = new NotificationWidget();
        panel.toolbar.insertItem(9, 'notifications', this.notificationWidget);
        return new DisposableDelegate(() => {
            this.notificationWidget.dispose();
        });
    }

    showMessage(message: string) {
        this.notificationWidget.showMessage(message);
    }
}
