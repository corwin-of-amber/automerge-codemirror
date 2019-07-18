import { Doc, WatchableDoc, Text } from 'automerge'
import { Editor, EditorChange } from 'codemirror'
import updateAutomergeDoc from './updateAutomergeDoc'
import Mutex from './Mutex'

export default function makeCodeMirrorChangeHandler<T>(
  watchableDoc: WatchableDoc<T>,
  getText: (doc: Doc<T>) => Text,
  mutex: Mutex
) {
  return (editor: Editor, change: EditorChange) => {
    if (change.origin !== 'automerge') {
      mutex.lock()
      const doc = updateAutomergeDoc(
        <Doc<T>>watchableDoc.get(),
        getText,
        editor.getDoc(),
        change
      )
      watchableDoc.set(<T>doc)
      mutex.release()
    }
  }
}
