export default function transformer(file, api) {
  const j = api.jscodeshift;

  let isModified = false;

  const codemod = j(file.source)

    // find [$.ajax().done(..)] looking code snippet
    .find(j.MemberExpression, {
      property: {type: j.identifier, name: 'done'},
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
      return path.node.type === 'CallExpression' && path.parent.node.type === 'MemberExpression' &&
        path.parent.node.property.name === 'fail'
    })

    .map(path => {
      return path.parent.parent // back to [$.ajax] callExpression
    })

    // make sure it is a callExpression $.ajax(...), not like `const ajax = $.ajax;`
    .filter(path => {
      return path.node.type === 'CallExpression';
    })

    // find 'success' or 'error' callbacks defined on the $.ajax(param)
    // and move them to the end of $.ajax(param).then(successCallback, errorCallback)
    .replaceWith(path => {
      isModified = true
      const doneMemberExpr = path.node.callee.object
      const originalCallexpr = doneMemberExpr.callee.object
      const doneCallback = doneMemberExpr.arguments[0]
      const failCallback = path.node.arguments[0]

      const thenVar = j.identifier('then')

      return j.callExpression(j.memberExpression(originalCallexpr, thenVar), [doneCallback, failCallback]);
    })

    if (isModified) {
      return codemod.toSource();
    } else {
      return null;
    }
}
