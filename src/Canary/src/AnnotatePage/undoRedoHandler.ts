import * as fabric from 'fabric';
import type { BoundingBoxAnnotation, KeypointAnnotation } from '../utils/interfaces/interfaces';
export type AnnotationType = KeypointAnnotation | BoundingBoxAnnotation;

export type UndoRedoAction =
  | { type: 'add'; kind: 'kp' | 'bb'; annotation: AnnotationType; group: fabric.Group }
  | { type: 'edit'; kind: 'kp' | 'bb'; before: AnnotationType; after: AnnotationType; group: fabric.Group }
  | { type: 'delete'; kind: 'kp' | 'bb'; annotation: AnnotationType; group: fabric.Group };

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
  addAction(kind: 'kp' | 'bb', annotation: AnnotationType, group: fabric.Group) {
    this.undoStack.push({ type: 'delete', kind, annotation, group });
    this.redoStack = [];
    // console.log('Added delete action to undo stack:', this.undoStack);
  }
  editAction(kind: 'kp' | 'bb', before: AnnotationType, after: AnnotationType, group: fabric.Group) {
    this.undoStack.push({ type: 'edit', kind, before: after, after: before, group: group });
    this.redoStack = [];
    // console.log('Added edit action to undo stack:', this.undoStack);
  }
  deleteAction(kind: 'kp' | 'bb', annotation: AnnotationType, group: fabric.Group) {
    this.undoStack.push({ type: 'add', kind, annotation, group: group });
    this.redoStack = [];
    // console.log('Added add action to undo stack:', this.undoStack);
  }

  async undo({
    onAdd,
    onEdit,
    onDelete,
    validate,
  }: {
    onAdd: (kind: 'kp' | 'bb', annotation: AnnotationType, group: fabric.Group) => Promise<void>;
    onEdit: (kind: 'kp' | 'bb', before: AnnotationType, after: AnnotationType, group: fabric.Group) => Promise<void>;
    onDelete: (kind: 'kp' | 'bb', annotation: AnnotationType, group: fabric.Group) => Promise<void>;
    validate: (action: UndoRedoAction) => boolean;
  }) {
    if (!this.canUndo()) return;
    const action = this.undoStack.pop()!;
    if (!validate(action)) return;
    let inverse: UndoRedoAction | null = null;
    switch (action.type) {
      case 'add':
        await onAdd(action.kind, action.annotation, action.group);
        inverse = { type: 'delete', kind: action.kind, annotation: action.annotation, group: action.group };
        break;
      case 'edit':
        await onEdit(action.kind, action.before, action.after, action.group);
        inverse = { type: 'edit', kind: action.kind, before: action.after, after: action.before, group: action.group };
        break;
      case 'delete':
        await onDelete(action.kind, action.annotation, action.group);
        inverse = { type: 'add', kind: action.kind, annotation: action.annotation, group: action.group };
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
    onAdd: (kind: 'kp' | 'bb', annotation: AnnotationType, group: fabric.Group) => Promise<void>;
    onEdit: (kind: 'kp' | 'bb', before: AnnotationType, after: AnnotationType, group: fabric.Group) => Promise<void>;
    onDelete: (kind: 'kp' | 'bb', annotation: AnnotationType, group: fabric.Group) => Promise<void>;
    validate: (action: UndoRedoAction) => boolean;
  }) {
    if (!this.canRedo()) return;
    const action = this.redoStack.pop()!;
    if (!validate(action)) return;
    let inverse: UndoRedoAction | null = null;
    switch (action.type) {
      case 'add':
        await onAdd(action.kind, action.annotation, action.group);
        inverse = { type: 'delete', kind: action.kind, annotation: action.annotation, group: action.group };
        break;
      case 'edit':
        await onEdit(action.kind, action.before, action.after, action.group);
        inverse = { type: 'edit', kind: action.kind, before: action.after, after: action.before, group: action.group };
        break;
      case 'delete':
        await onDelete(action.kind, action.annotation, action.group);
        inverse = { type: 'add', kind: action.kind, annotation: action.annotation, group: action.group };
        break;
    }
    if (inverse) this.undoStack.push(inverse);
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}
