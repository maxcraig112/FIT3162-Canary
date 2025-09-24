// UndoRedoHandler for bounding boxes and keypoints
// Tracks add, edit, delete operations and syncs with backend


import type { KeypointAnnotation, BoundingBoxAnnotation } from './constants';
export type AnnotationType = KeypointAnnotation | BoundingBoxAnnotation;


export type UndoRedoAction =
  | { type: 'add'; kind: 'kp' | 'bb'; annotation: AnnotationType }
  | { type: 'edit'; kind: 'kp' | 'bb'; before: AnnotationType; after: AnnotationType }
  | { type: 'delete'; kind: 'kp' | 'bb'; annotation: AnnotationType };

export class UndoRedoHandler {
  private undoStack: UndoRedoAction[] = [];
  private redoStack: UndoRedoAction[] = [];

  canUndo() {
    return this.undoStack.length > 0;
  }
  canRedo() {
    return this.redoStack.length > 0;
  }

  // Pushes the inverse of the action to the undo stack and clears redo stack
  addAction(kind: 'kp' | 'bb', annotation: AnnotationType) {
    this.undoStack.push({ type: 'delete', kind, annotation });
    this.redoStack = [];
    console.log('Added action to undo stack:', this.undoStack);
  }
  editAction(kind: 'kp' | 'bb', before: AnnotationType, after: AnnotationType) {
    this.undoStack.push({ type: 'edit', kind, before: after, after: before });
    this.redoStack = [];
    console.log('Added edit action to undo stack:', this.undoStack);
  }
  deleteAction(kind: 'kp' | 'bb', annotation: AnnotationType) {
    this.undoStack.push({ type: 'add', kind, annotation });
    this.redoStack = [];
    console.log('Added delete action to undo stack:', this.undoStack);
  }

  async undo({
    onAdd,
    onEdit,
    onDelete,
    validate,
  }: {
    onAdd: (kind: 'kp' | 'bb', annotation: AnnotationType) => Promise<void>;
    onEdit: (kind: 'kp' | 'bb', before: AnnotationType, after: AnnotationType) => Promise<void>;
    onDelete: (kind: 'kp' | 'bb', annotation: AnnotationType) => Promise<void>;
    validate: (action: UndoRedoAction) => boolean;
  }) {
    if (!this.canUndo()) return;
    const action = this.undoStack.pop()!;
    if (!validate(action)) return;
    let inverse: UndoRedoAction | null = null;
    switch (action.type) {
      case 'add':
        await onAdd(action.kind, action.annotation);
        inverse = { type: 'delete', kind: action.kind, annotation: action.annotation };
        break;
      case 'edit':
        await onEdit(action.kind, action.before, action.after);
        inverse = { type: 'edit', kind: action.kind, before: action.after, after: action.before };
        break;
      case 'delete':
        await onDelete(action.kind, action.annotation);
        inverse = { type: 'add', kind: action.kind, annotation: action.annotation };
        break;
    }
    if (inverse) this.redoStack.push(inverse);
  }

  async redo({
    onAdd,
    onEdit,
    onDelete,
    validate,
  }: {
    onAdd: (kind: 'kp' | 'bb', annotation: AnnotationType) => Promise<void>;
    onEdit: (kind: 'kp' | 'bb', before: AnnotationType, after: AnnotationType) => Promise<void>;
    onDelete: (kind: 'kp' | 'bb', annotation: AnnotationType) => Promise<void>;
    validate: (action: UndoRedoAction) => boolean;
  }) {
    if (!this.canRedo()) return;
    const action = this.redoStack.pop()!;
    if (!validate(action)) return;
    let inverse: UndoRedoAction | null = null;
    switch (action.type) {
      case 'add':
        await onAdd(action.kind, action.annotation);
        inverse = { type: 'delete', kind: action.kind, annotation: action.annotation };
        break;
      case 'edit':
        await onEdit(action.kind, action.before, action.after);
        inverse = { type: 'edit', kind: action.kind, before: action.after, after: action.before };
        break;
      case 'delete':
        await onDelete(action.kind, action.annotation);
        inverse = { type: 'add', kind: action.kind, annotation: action.annotation };
        break;
    }
    if (inverse) this.undoStack.push(inverse);
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}
