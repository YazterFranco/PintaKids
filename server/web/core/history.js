/** Deshacer/rehacer sobre la lista de trazos (inmutable: devuelve la lista nueva). */

export function createHistory(initial = []) {
  let undoStack = [];
  let redoStack = [];
  let strokes = initial;

  return {
    get strokes() {
      return strokes;
    },
    canUndo() {
      return undoStack.length > 0;
    },
    canRedo() {
      return redoStack.length > 0;
    },
    set(next) {
      if (next !== strokes) {
        undoStack.push(strokes);
        if (undoStack.length > 60) undoStack.shift();
        redoStack = [];
        strokes = next;
      }
      return strokes;
    },
    undo() {
      if (!undoStack.length) return strokes;
      redoStack.push(strokes);
      strokes = undoStack.pop();
      return strokes;
    },
    redo() {
      if (!redoStack.length) return strokes;
      undoStack.push(strokes);
      strokes = redoStack.pop();
      return strokes;
    },
    reset(next = []) {
      undoStack = [];
      redoStack = [];
      strokes = next;
      return strokes;
    },
  };
}
