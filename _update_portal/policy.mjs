import { parse } from 'parse5';
import * as css from 'css-tree';

export const FILES = ['index.html', 'about.html', 'services.html', 'applications.html', 'contact.html', 'style.css'];
const frozen = new Set(['script', 'style', 'template', 'noscript', 'textarea']);
function shape(node, locked = false) {
  locked ||= frozen.has(node.tagName);
  if (node.nodeName === '#text') return locked ? ['text', node.value] : null;
  if (node.nodeName === '#comment') return ['comment', node.data];
  return [node.nodeName, node.name, node.publicId, node.systemId, node.namespaceURI,
    (node.attrs || []).map(a => [a.name, a.value, a.namespace]).sort(),
    (node.childNodes || []).map(n => shape(n, locked)).filter(Boolean),
    node.content ? shape(node.content, true) : null];
}
function cssResources(source) {
  if (source.includes('\\')) throw Error('Unsafe CSS escape');
  const ast = css.parse(source, {parseCustomProperty:true,onParseError: () => { throw Error('Invalid CSS'); }});
  const resources = [];
  css.walk(ast, n => {
    if (n.type === 'Raw') throw Error('Unparsed CSS is forbidden');
    if (n.type === 'Url' || n.type === 'String' || n.type === 'Atrule' && /import|namespace/i.test(n.name)) resources.push(css.generate(n));
    if (n.type === 'Function' && /^(expression|attr|image-set|-webkit-image-set)$/i.test(n.name)) throw Error('Unsafe CSS function');
    if (n.type === 'Declaration' && /^(behavior|-moz-binding)$/i.test(n.property)) throw Error('Unsafe CSS property');
  });
  return resources.sort();
}
export function validateChange(path, before, after) {
  if (!FILES.includes(path) || typeof after !== 'string' || after.length > 80000 || !after.trim()) throw Error('File outside edit policy');
  if (before === after) return;
  if (path.endsWith('.html')) {
    const errors = [];
    const next = parse(after, {onParseError: e => errors.push(e.code)});
    if (errors.length || JSON.stringify(shape(parse(before))) !== JSON.stringify(shape(next))) {
      throw Error('Only visible HTML text may change; markup, links, scripts and attributes are protected');
    }
  } else if (JSON.stringify(cssResources(before)) !== JSON.stringify(cssResources(after))) {
    throw Error('CSS cannot add or change network resources');
  }
}
export function validateProposal(proposal, files) {
  if (!proposal || !Array.isArray(proposal.files) || !proposal.files.length || proposal.files.length > FILES.length) throw Error('Invalid proposal');
  const seen = new Set();
  for (const edit of proposal.files) {
    if (seen.has(edit.path) || !(edit.path in files) || edit.content === files[edit.path]) throw Error('Duplicate, unavailable or unchanged file');
    seen.add(edit.path);
    validateChange(edit.path, files[edit.path], edit.content);
  }
  return proposal.files;
}
