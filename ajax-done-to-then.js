export default function transformer(file, api) {
  const j = api.jscodeshift;

  let isModified = false;

  const codemod = j(file.source)

    // find [$.ajax().done(..)] looking code snippet
    .find(j.MemberExpression, {
      property: {type: j.identifier, name: 'done'}
    })

    .filter(path => {
      return path.node.object.type === 'CallExpression' && path.node.object.callee.type === 'MemberExpression' &&
        path.node.object.callee.property.name === 'ajax' && (path.node.object.callee.object.name === '$' || path.node.object.callee.object.name === 'jQuery' )
    })

    // returning the parent of [$.ajax] node
    .map(path => {
      return path.parent
    })

  .filter(path => {
      // only $.ajax().done() is present
      return path.node.type === 'CallExpression' && path.parent.node.type !== 'MemberExpression'
    })

    .replaceWith(path => {
      isModified = true
      const originalExpr = path.node.callee.object
      const doneCallback = path.node.arguments[0]

      const thenVar = j.identifier('then')

      return j.callExpression(j.memberExpression(originalExpr, thenVar), [doneCallback]);
    })

    if (isModified) {
      return codemod.toSource();
    } else {
      return null;
    }
}
