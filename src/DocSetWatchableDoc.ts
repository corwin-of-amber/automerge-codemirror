import { Doc, Change, DocSet, WatchableDocHandler } from 'automerge'

type Handler<Doc> = WatchableDocHandler<Doc>

/**
 * Implements the API of Automerge.WatchableDoc, but backed by an Automerge.DocSet.
 * The motivation behind this is to use Automerge.Connection (which
 * only works with Automerge.DocSet, and not Automerge.WatchableDoc). Another
 * approach could have been to implement a WatchableDocConnection, but that
 * is a lot more work
 */
export default class DocSetWatchableDoc<T> /*implements WatchableDoc<T>*/ {
  private handlers = new Set<Handler<T>>()

  constructor(
    public readonly docSet: DocSet<T>,
    public readonly docId: string
  ) {
    this.docSet.registerHandler((updatedDocId: string, updatedDoc) => {
      if (updatedDocId === docId) {
        this.handlers.forEach(handler => handler(updatedDoc))
      }
    })
  }

  public get(): T {
    return this.docSet.getDoc(this.docId)
  }

  public set(doc: T) {
    this.docSet.setDoc(this.docId, <Doc<T>>doc)
  }

  public applyChanges(changes: Change[]) {
    this.docSet.applyChanges(this.docId, changes)
    return this.get()
  }

  public registerHandler(handler: Handler<T>) {
    this.handlers.add(handler)
  }

  public unregisterHandler(handler: Handler<T>) {
    this.handlers.delete(handler)
  }
}
