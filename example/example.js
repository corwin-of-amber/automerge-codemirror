const Automerge = require('automerge');
const {DocumentSlot} = require('automerge-slots');
const {AutomergeCodeMirror} = require('..');



var docset = new Automerge.DocSet(),
    slot = new DocumentSlot(docset, 'doc').path(['text']);

slot.set(new Automerge.Text());  /* creates a document with an empty Text */


/**
 * Creates a new CodeMirror and links it to the slot.
 * All instances created thus will be synchronized with the same Text.
 */
function createSheet() {
    var div = document.createElement('div');
    div.classList.add('sheet');
    document.body.appendChild(div);

    var editor = new CodeMirror(div, {viewportMargin: Infinity});

    return new AutomergeCodeMirror(editor, slot, {debounce: {wait: 0}});
}



Object.assign(window, {docset, slot, createSheet});
