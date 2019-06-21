import { PanelLayout } from '@phosphor/widgets';
import { Widget } from '@phosphor/widgets';
import { ISlicedCellModel } from './model';
import CodeMirror = require('codemirror');
import 'codemirror/addon/scroll/simplescrollbars';
import 'codemirror/addon/scroll/simplescrollbars.css';

// The HTML class names used in these widgets
const SLICED_CELL_CLASS = 'jp-SlicedCell';
const DIFFED_SLICED_CELL_CLASS = 'jp-DiffedSlicedCell';
const SLICED_CELL_EDITOR_CLASS = 'jp-SlicedCell-editor';
const DIFFED_CELL_BEFORE_TEXT_CLASS = 'jp-DiffedCell-editor-beforetext';
const DIFFED_CELL_BEFORE_BACKGROUND_CLASS =
  'jp-DiffedCell-editor-beforebackground';
const DIFFED_CELL_AFTER_TEXT_CLASS = 'jp-DiffedCell-editor-aftertext';
const DIFFED_CELL_CHANGED_TEXT_CLASS = 'jp-DiffedCell-editor-changedtext';
const CELL_AREA_CLASS = 'jp-CellArea';

/**
 * A widget for showing a cell with a code slice.
 */
export class SlicedCell extends Widget {
  protected editor: CodeMirror.Editor = null;
  protected codeMirrorWidget: Widget;
  readonly model: ISlicedCellModel;

  constructor(options: SlicedCell.IOptions) {
    super();
    this.addClass(SLICED_CELL_CLASS);

    this.model = options.model;

    let codeMirrorElement = document.createElement('div');
    let codeMirror = CodeMirror(codeMirrorElement, {
      value: this.model.sourceCode,
      mode: 'python',
      readOnly: 'nocursor', // don't allow interaction with cell's contents
      scrollbarStyle: 'simple', // show simple (thin) scrollbar
    });
    let codeMirrorWidget = new Widget({ node: codeMirror.getWrapperElement() });
    this.editor = codeMirror;
    this.codeMirrorWidget = codeMirrorWidget;
    codeMirrorWidget.addClass(SLICED_CELL_EDITOR_CLASS);

    let layout = (this.layout = new PanelLayout());
    layout.addWidget(codeMirrorWidget);
    this.initializeEditor();
  }

  initializeEditor() {
    // XXX: If I don't call this method with a delay, the text doesn't appear.
    let codeMirrorEditor: CodeMirror.Editor = this.editor;
    setTimeout(function() {
      codeMirrorEditor.refresh();
    }, 1);
  }

  dispose() {
    // Do nothing if already disposed.
    if (this.isDisposed) {
      return;
    }
    this.editor = null;
    super.dispose();
  }
}

export namespace SlicedCell {
  export interface IOptions {
    model: ISlicedCellModel;
  }
}

/**
 * A widget for showing a cell with a code slice, diff'd to another cell.
 */
export class DiffedSlicedCell extends SlicedCell {
  constructor(options: SlicedCell.IOptions) {
    super(options);
    this.addClass(DIFFED_SLICED_CELL_CLASS);

    let codeMirrorDoc: CodeMirror.Doc = this.editor.getDoc();

    // Mark up differences
    for (let beforeLine of this.model.diff.beforeLines) {
      this.editor.addLineClass(
        beforeLine - 1,
        'background',
        DIFFED_CELL_BEFORE_BACKGROUND_CLASS
      );
      this.editor.addLineClass(
        beforeLine - 1,
        'wrap',
        DIFFED_CELL_BEFORE_TEXT_CLASS
      );
    }
    for (let afterLine of this.model.diff.afterLines) {
      this.editor.addLineClass(
        afterLine - 1,
        'background',
        DIFFED_CELL_AFTER_TEXT_CLASS
      );
    }
    for (let loc of this.model.diff.changeLocations) {
      codeMirrorDoc.markText(
        { line: loc.first_line - 1, ch: loc.first_column },
        { line: loc.last_line - 1, ch: loc.last_column },
        { className: DIFFED_CELL_CHANGED_TEXT_CLASS }
      );
      let versionClass;
      if (this.model.diff.beforeLines.indexOf(loc.first_line) !== -1) {
        versionClass = DIFFED_CELL_BEFORE_TEXT_CLASS;
      } else if (this.model.diff.afterLines.indexOf(loc.first_line) !== -1) {
        versionClass = DIFFED_CELL_AFTER_TEXT_CLASS;
      }
      codeMirrorDoc.markText(
        { line: loc.first_line - 1, ch: loc.first_column },
        { line: loc.last_line - 1, ch: loc.last_column },
        { className: versionClass }
      );
    }
  }
}

export namespace CellArea {
  export interface IOptions {
    model: ISlicedCellModel;
    showDiff: boolean;
  }
}

/**
 * A cell area widget, which hosts a prompt and a cell editor widget.
 */
export class CellArea extends Widget {
  readonly model: ISlicedCellModel;

  constructor(options: CellArea.IOptions) {
    super();
    this.addClass(CELL_AREA_CLASS);

    let layout = (this.layout = new PanelLayout());

    let cellOptions: SlicedCell.IOptions = {
      model: options.model,
    };
    if (options.showDiff) {
      layout.addWidget(new SlicedCell(cellOptions));
    } else {
      layout.addWidget(new DiffedSlicedCell(cellOptions));
    }
  }
}
