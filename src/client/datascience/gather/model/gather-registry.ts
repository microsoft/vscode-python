import { INotebookModel, INotebookTracker } from '@jupyterlab/notebook';
import { UUID } from '@phosphor/coreutils';
import { log } from 'util';
import { IGatherModel, IGatherModelRegistry } from '../../types';

export function getGatherModelForActiveNotebook(
  notebooks: INotebookTracker,
  gatherModelRegistry: IGatherModelRegistry
): IGatherModel | null {
  const activeNotebook = notebooks.currentWidget;
  if (activeNotebook == null) { return null; }
  return gatherModelRegistry.getGatherModel(activeNotebook.model);
}

/**
 * Registry of all gather models created for all open notebooks.
 */
export class GatherModelRegistry implements IGatherModelRegistry {

  private _gatherModels: { [notebookId: string]: IGatherModel } = {};
  /**
   * Returns null is notebook ID is in an unexpected format.
   */
  public _getNotebookId(notebookModel: INotebookModel): string | null {
    const METADATA_NOTEBOOK_ID_KEY = 'uuid';
    if (!notebookModel.metadata.has(METADATA_NOTEBOOK_ID_KEY)) {
      notebookModel.metadata.set(METADATA_NOTEBOOK_ID_KEY, UUID.uuid4());
    }
    const id = notebookModel.metadata.get(METADATA_NOTEBOOK_ID_KEY);
    if (!(typeof id == 'string')) {
      log('Unexpected notebook ID format ' + id);
      return null;
    }
    return id;
  }

  /**
   * Returns false if storage of gather model failed.
   */
  public addGatherModel(
    notebookModel: INotebookModel,
    gatherModel: IGatherModel
  ): boolean {
    const notebookId = this._getNotebookId(notebookModel);
    if (notebookId == null) { return false; }
    this._gatherModels[notebookId] = gatherModel;
    return true;
  }

  /**
   * Returns null if no gather model found for this notebook.
   */
  public getGatherModel(notebookModel: INotebookModel): IGatherModel | null {
    const notebookId = this._getNotebookId(notebookModel);
    if (notebookId == null) { return null; }
    if (this._gatherModels.hasOwnProperty(notebookId)) {
      return this._gatherModels[notebookId];
    }
    return null;
  }
}
