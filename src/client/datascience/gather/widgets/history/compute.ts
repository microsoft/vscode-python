import { nbformat } from '@jupyterlab/coreutils';
import { SlicedExecution } from '../../analysis/slice/log-slicer';
import { GatherModel } from '../../model';
import { IGatherCell } from '../../model/cell';
import { CellSlice } from '../../model/cellslice';
import { CodeVersionModel } from '../codeversion/model';
import { RevisionModel } from '../revision/model';
import { SlicedCellModel } from '../slicedcell/model';
import { computeTextDiff } from './diff';
import { HistoryModel } from './model';

/**
 * Build a history model of how a cell was computed across notebook snapshots.
 */
export function buildHistoryModel(
  gatherModel: GatherModel,
  selectedCellPersistentId: string,
  executionVersions: SlicedExecution[],
  includeOutput?: boolean
): HistoryModel {
  // All cells in past revisions will be compared to those in the current revision. For the most
  // recent version, save a mapping from cells' IDs to their content, so we can look them up to
  // make comparisons between versions of cells.
  const lastestVersion = executionVersions[executionVersions.length - 1];
  const latestCellVersions: { [cellPersistentId: string]: CellSlice } = {};
  lastestVersion.cellSlices.forEach(cellSlice => {
    latestCellVersions[cellSlice.cell.persistentId] = cellSlice;
  });

  // Compute diffs between each of the previous revisions and the current revision.
  const revisions = new Array<RevisionModel>();
  executionVersions.forEach(function(executionVersion, versionIndex) {
    // Then difference the code in each cell.
    // Use the two-step diffing process of `diff_main` and `diff_cleanupSemantic` as the
    // second method will clean up the diffs to be more readable.
    const slicedCellModels: Array<SlicedCellModel> = new Array<SlicedCellModel>();
    executionVersion.cellSlices.forEach(function(cellSlice) {
      const cell = cellSlice.cell;
      const recentCellVersion = latestCellVersions[cell.persistentId];
      let latestText: string = '';
      if (recentCellVersion) {
        latestText = recentCellVersion.textSliceLines;
      }

      const thisVersionText: string = cellSlice.textSliceLines;
      const diff = computeTextDiff(latestText, thisVersionText);

      const slicedCell: SlicedCellModel = new SlicedCellModel({
        executionEventId: cell.executionEventId,
        executionCount: cell.executionCount,
        sourceCode: diff.text,
        diff: diff
      });
      slicedCellModels.push(slicedCell);
    });

    let output: nbformat.IOutput[] = undefined;
    if (includeOutput) {
      let selectedCell: IGatherCell = undefined;
      executionVersion.cellSlices
        .map(cs => cs.cell)
        .forEach(function(cellModel) {
          if (cellModel.persistentId == selectedCellPersistentId) {
            selectedCell = cellModel;
          }
        });
      if (selectedCell && selectedCell.outputs) {
        output = selectedCell.outputs;
      }
    }

    const isLatestVersion = versionIndex == executionVersions.length - 1;
    const codeVersionModel: CodeVersionModel = new CodeVersionModel({
      cells: slicedCellModels,
      isLatest: isLatestVersion
    });
    const revisionModel = new RevisionModel({
      versionIndex: versionIndex + 1, // Version index should start at 1
      source: codeVersionModel,
      slice: executionVersion,
      gatherModel: gatherModel,
      output: output,
      isLatest: isLatestVersion,
      timeCreated: executionVersion.executionTime
    });
    revisions.push(revisionModel);
  });

  return new HistoryModel({ revisions: revisions });
}
