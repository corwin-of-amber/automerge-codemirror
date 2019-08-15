import * as Automerge from 'automerge';
import CodeMirror from 'codemirror';
import _ from 'lodash';

import {DocumentSlotInterface, Cancelable} from 'automerge-slots';


/**
 * A synchronized editor that supports multi-client editing.
 * Uses Automerge.Text for synchronization.
 */
class AutomergeCodeMirror<D> {

  cm: CodeMirror.Editor;
  slot: DocumentSlotInterface<D, Automerge.Text>;

  lastRev?: Automerge.Doc<D>;

  _park?: Cancelable;
  _objectId?: Automerge.UUID;
  _amFlush?: () => void;

  cmHandler?: (cm: CodeMirror.Editor, change: CodeMirror.EditorChange) => void;
  amHandler?: ((newRev: Automerge.Doc<D>) => void) & _.Cancelable;

  /**
   * Constructs a live link between a CodeMirror instance and a Text
   * embedded in an Automerge document.
   * @param {CodeMirror.Editor} cm the CodeMirror instance
   * @param {DocumentSlotInterface} slot the slot (DocumentPathSlot/DocumentObjectSlot)
   *   of the Automerge.Text to connect
   * @param {object} opts options object:
   *   debounce.wait - the debounce time for incoming Automerge changes
   *      (in ms, default 50)
   *   debounce.max - maxWait for said debounce, after which queued changes
   *      are flushed even if changes keep coming (in ms, default 500)
   */
  constructor(cm : CodeMirror.Editor, slot: DocumentSlotInterface<D, Automerge.Text>, opts:Options={}) {
    this.cm = cm;
    this.slot = slot;

    (this._park = this.slot.park()).then(() => this._formLink(opts));
  }

  destroy() {
    if (this._park)     this._park.cancel();
    if (this.amHandler) this.slot.docSlot.unregisterHandler(this.amHandler);
    if (this.cmHandler) this.cm.off('change', this.cmHandler);
    if (this._amFlush)  this.cm.off('beforeChange', this._amFlush);
  }

  _formLink(opts: Options) {
    var doc = this.slot.docSlot.get() || this.slot.docSlot.create();
    if (!this.slot.get()) this.slot.set(new Automerge.Text());

    this._objectId = Automerge.getObjectId(this.slot.get());

    var debounce = this._debounceOpts(opts);

    var {cm, slot} = this;

    // Synchronize CodeMirror -> Automerge
    cm.setValue(slot.get().join(''));

    this.cmHandler = (cm: CodeMirror.Editor, change: CodeMirror.EditorChange) => {
      this.lastRev = updateAutomergeDoc(slot, cm.getDoc(), change)
                      || this.lastRev;
    };

    this._amFlush = () => this.amHandler!.flush();

    cm.on('change', this.cmHandler);
    cm.on('beforeChange', this._amFlush);

    // Synchronize Automerge -> CodeMirror
    this.lastRev = doc;

    this.amHandler = _.debounce((newRev: Automerge.Doc<D>) => {
      updateCodeMirrorDoc(this.lastRev!, newRev, 
                          this._objectId!, cm.getDoc());
      this.lastRev = newRev;
    }, debounce.wait, {maxWait: debounce.max});

    slot.docSlot.registerHandler(this.amHandler);
  }

  _debounceOpts(opts: Options) {
      return {wait: (opts.debounce && opts.debounce.wait) || 50,
              max:  (opts.debounce && opts.debounce.max)  || 500};
  }
}


type Options = { debounce?: { wait?: number; max?: number; }; };


/* -- Internal routines -- */


/**
 * Propagates changes made to a CodeMirror document to Automerge.Text.
 * @param slot a document slot referring to a Text instance
 * @param codeMirrorDoc the CodeMirror document
 * @param editorChange the current change object
 * @returns undefined if no changes are needed; otherwise, the new revision
 *   of the underlying Automerge.Doc.
 */
function updateAutomergeDoc<D>(
    slot : DocumentSlotInterface<D, Automerge.Text>,
    codeMirrorDoc : CodeMirror.Doc,
    editorChange : CodeMirror.EditorChange
  ) : Automerge.Doc<D> | void
{
  if (editorChange.origin === 'automerge') return;  // own change

  return slot.change((text : Automerge.Text) => {
    const startPos = codeMirrorDoc.indexFromPos(editorChange.from)

    const removedLines = editorChange.removed || []
    const addedLines = editorChange.text

    const removedLength =
      removedLines.reduce((sum, remove) => sum + remove.length + 1, 0) - 1
    if (removedLength > 0) {
      text.splice(startPos, removedLength)
    }

    const addedText = addedLines.join('\n')
    if (addedText.length > 0) {
      text.splice(startPos, 0, ...addedText.split(''))
    }
  });
}


/**
 * Propagates changes received through Automerge to a CodeMirror document.
 * @param oldDoc previous revision of the document
 * @param newDoc current revision of the document
 * @param objectId the UUID of the Text instance in the document
 * @param codeMirrorDoc the target CodeMirror document
 */
function updateCodeMirrorDoc<T>(
    oldDoc : Automerge.Doc<T>,
    newDoc : Automerge.Doc<T>,
    objectId: Automerge.UUID,
    codeMirrorDoc: CodeMirror.Doc
) {
  if (!oldDoc) return;

  const diffs = Automerge.diff(oldDoc, newDoc)

  for (const d of diffs) {
    if (!(d.type === 'text' && d.obj === objectId)) continue

    switch (d.action) {
      case 'insert': {
        const fromPos = codeMirrorDoc.posFromIndex(d.index!)
        codeMirrorDoc.replaceRange(d.value, fromPos, undefined, 'automerge')
        break
      }
      case 'remove': {
        const fromPos = codeMirrorDoc.posFromIndex(d.index!)
        const toPos = codeMirrorDoc.posFromIndex(d.index! + 1)
        codeMirrorDoc.replaceRange('', fromPos, toPos, 'automerge')
        break
      }
    }
  }
}



export {AutomergeCodeMirror}