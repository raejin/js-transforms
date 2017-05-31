export default function transformer(file, api) {
  const j = api.jscodeshift;

  let isModified = false;

  const codemod = j(file.source)

    // find [$.ajax().done(..)] looking code snippet
    .find(j.MemberExpression, {
      property: {type: j.identifier, name: 'fail'},
    })

    .filter(path => {
      const isCorrectExpr = path.node.object.type === 'CallExpression' && path.node.object.callee.type === 'MemberExpression';
      const lowercaseName = isCorrectExpr ? (path.node.object.callee.object.callee.property && path.node.object.callee.object.callee.property.name.toLowerCase()) : false;
      console.log(lowercaseName)
      return isCorrectExpr &&
        (lowercaseName === 'deleteRequest' || lowercaseName === 'get' || lowercaseName === 'post'|| lowercaseName === 'put')
        && (path.node.object.callee.object.callee.object.name === 'Api')
    })

    .filter(path => {
      return path.parent.node.type === 'CallExpression' && path.node.type === 'MemberExpression' &&
        path.node.object.callee.property.name === 'then' && path.node.property.name === 'fail'
    })

    .map(path => {
      return path.parent // back to [$.ajax] callExpression
    })

    // find 'success' or 'error' callbacks defined on the $.ajax(param)
    // and move them to the end of $.ajax(param).then(successCallback, errorCallback)
    .replaceWith(path => {
      isModified = true
      const doneMemberExpr = path.node.callee.object
      const originalCallexpr = doneMemberExpr.callee.object
      const thenCallback = doneMemberExpr.arguments[0]
      const failCallback = path.node.arguments[0]

      const thenVar = j.identifier('then')

      return j.callExpression(j.memberExpression(originalCallexpr, thenVar), [thenCallback, failCallback]);
    })

    if (isModified) {
      return codemod.toSource();
    } else {
      return null;
    }
}
