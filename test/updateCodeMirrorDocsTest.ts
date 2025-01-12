import assert from 'assert'
import './codeMirrorEnv'
import Automerge from 'automerge'
import updateCodeMirrorDocs from '../src/updateCodeMirrorDocs'
import CodeMirror from 'codemirror'
import { randomPositiveInt, randomString } from './random'
import Mutex from '../src/Mutex'

interface TestDoc {
  text: Automerge.Text
}

interface TestDocWithManyTexts {
  texts: Automerge.Text[]
}

const getText = (doc: TestDoc): Automerge.Text => doc.text

describe('updateCodeMirrorDocs', () => {
  let div: HTMLDivElement
  beforeEach(() => {
    div = document.createElement('div')
    document.body.appendChild(div)
  })

  it('adds new text', () => {
    const doc1: TestDoc = Automerge.init()
    const doc2: TestDoc = Automerge.change(doc1, draft => {
      draft.text = new Automerge.Text()
      draft.text.insertAt!(0, ...'HELLO'.split(''))
    })
    const doc3: TestDoc = Automerge.change(doc2, draft => {
      draft.text.insertAt!(5, ...'WORLD'.split(''))
    })

    const codeMirror = CodeMirror(div)

    const links = new Set([
      {
        codeMirror: codeMirror,
        getText,
      },
    ])

    const mutex = new Mutex()

    updateCodeMirrorDocs(doc1, doc2, links, mutex)
    assert.deepStrictEqual(codeMirror.getValue(), doc2.text.join(''))

    updateCodeMirrorDocs(doc2, doc3, links, mutex)
    assert.deepStrictEqual(codeMirror.getValue(), doc3.text.join(''))
  })

  it('handles a removed text node without crashing', () => {
    const doc1: TestDocWithManyTexts = <any>Automerge.init()
    const doc2: TestDocWithManyTexts = Automerge.change(doc1, draft => {
      draft.texts = []
      draft.texts.push(new Automerge.Text())
    })

    const getText = (doc: TestDocWithManyTexts): Automerge.Text => doc.texts[0]

    const codeMirror = CodeMirror(div)

    const links = new Set([
      {
        codeMirror: codeMirror,
        getText,
      },
    ])

    const mutex = new Mutex()

    updateCodeMirrorDocs(doc1, doc2, links, mutex)
    assert.deepStrictEqual(codeMirror.getValue(), doc2.texts[0].join(''))

    const doc3: TestDocWithManyTexts = Automerge.change(doc2, draft => {
      draft.texts.shift()
    })

    updateCodeMirrorDocs(doc2, doc3, links, mutex)
  })

  for (let n = 0; n < 10; n++) {
    it(`works with random edits (fuzz test ${n})`, () => {
      let doc: TestDoc = Automerge.change(
        Automerge.init(),
        draft => (draft.text = new Automerge.Text())
      )

      const codeMirror = CodeMirror(div)

      const links = new Set([
        {
          codeMirror: codeMirror,
          getText,
          processingEditorChange: false,
        },
      ])

      const mutex = new Mutex()

      for (let t = 0; t < 10; t++) {
        const newDoc = monkeyModify(doc)
        updateCodeMirrorDocs(doc, newDoc, links, mutex)
        doc = newDoc
      }

      assert.deepStrictEqual(doc.text.join(''), codeMirror.getValue())
    })
  }
})

function monkeyModify(doc: TestDoc): TestDoc {
  const textLength = doc.text.length
  const index = Math.floor(Math.random() * textLength)
  // const from = cm.posFromIndex(index)
  const editLength = randomPositiveInt(10)
  if (Math.random() < 0.7) {
    // Add text
    doc = Automerge.change(doc, editableDoc => {
      editableDoc.text.splice(index, 0, ...randomString(editLength).split(''))
    })
  } else {
    const endIndex = Math.min(index + editLength, textLength - index)
    doc = Automerge.change(doc, editableDoc => {
      editableDoc.text.splice(index, endIndex)
    })
  }
  return doc
}
