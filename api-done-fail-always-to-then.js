export default function transformer(file, api) {
  const j = api.jscodeshift;

  let isModified = false;

  const codemod = j(file.source)

    // find [$.ajax().done(..)] looking code snippet
    .find(j.MemberExpression, {
      property: {type: j.identifier, name: 'always'},
    })

    .filter(path => {
      const isCorrectExpr = path.node.object.type === 'CallExpression' && path.node.object.callee.type === 'MemberExpression';
      const previousExpr = isCorrectExpr ? path.node.object.callee : false;
      const isCorrectFinalExpr = previousExpr && previousExpr.object.type === 'CallExpression' && previousExpr.object.callee.type === 'MemberExpression';

      const lowercaseName = isCorrectFinalExpr ? previousExpr.object.callee.object.callee.property.name.toLowerCase() : false;

      return isCorrectFinalExpr &&
        (lowercaseName === 'deleterequest' || lowercaseName === 'get' || lowercaseName === 'post'|| lowercaseName === 'put')
        && (path.node.object.callee.property.name === 'error') && (path.node.object.callee.object.callee.property.name === 'done')
        && (path.node.object.callee.object.callee.object.callee.object.name === 'Api')
    })

    // returning the parent of [$.ajax] node
    .map(path => {
      return path.parent
    })

    // find 'success' or 'error' callbacks defined on the $.ajax(param)
    // and move them to the end of $.ajax(param).then(successCallback, errorCallback)
    .replaceWith(path => {
      isModified = true

    const alwaysCallback = path.node.arguments[0]
      const failCallback = path.node.callee.object.arguments[0]
      const doneCallback = path.node.callee.object.callee.object.arguments[0]

      const originalCallexpr = path.node.callee.object.callee.object.callee.object

      const thenVar = j.identifier('then')

      const doneFailCallExpr = j.callExpression(j.memberExpression(originalCallexpr, thenVar), [doneCallback, failCallback])

      return j.callExpression(j.memberExpression(doneFailCallExpr, thenVar), [alwaysCallback, alwaysCallback]);
    })

    if (isModified) {
      return codemod.toSource();
    } else {
      return null;
    }
}
