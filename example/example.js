const Automerge = require('automerge');
const {DocumentSlot} = require('automerge-slots');
const {AutomergeCodeMirror} = require('..');


var docset = new Automerge.DocSet();

docset.setDoc('doc', Automerge.change(Automerge.init(),
    doc => doc.text = new Automerge.Text()));

var slot = new DocumentSlot(docset, 'doc').path(['text']);

function createSheet() {
    var div = document.createElement('div');
    div.classList.add('sheet');
    document.body.appendChild(div);
    var editor = new CodeMirror(div, {
        viewportMargin: Infinity
    });
    new AutomergeCodeMirror(editor, slot, {debounce: {wait: 0}});
}



Object.assign(window, {Automerge, DocumentSlot, AutomergeCodeMirror, createSheet});
