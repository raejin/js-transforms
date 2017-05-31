export default function transformer(file, api) {
  const j = api.jscodeshift;

  let isModified = false;

  const codemod = j(file.source)

    // find [$.ajax().fail(..)] looking code snippet
    .find(j.MemberExpression, {
      property: {type: j.identifier, name: 'fail'}
    })

    .filter(path => {
      const isCorrectExpr = path.node.object.type === 'CallExpression' && path.node.object.callee.type === 'MemberExpression';
      const lowercaseName = isCorrectExpr ? path.node.object.callee.property.name.toLowerCase() : false;

      return isCorrectExpr &&
        (lowercaseName === 'get' || lowercaseName === 'post' || lowercaseName === 'put' || lowercaseName === 'deleteRequest') &&
        (path.node.object.callee.object.name === 'Api')
    })

    // returning the parent of [$.ajax] node
    .map(path => {
      return path.parent
    })

  .filter(path => {
      // only $.ajax().fail() is present
      return path.node.type === 'CallExpression' && path.parent.node.type !== 'MemberExpression'
    })

    .replaceWith(path => {
      isModified = true
      const originalExpr = path.node.callee.object
      const failCallback = path.node.arguments[0]

      const thenVar = j.identifier('then')

      return j.callExpression(j.memberExpression(originalExpr, thenVar), [j.literal(null), failCallback]);
    })

    if (isModified) {
      return codemod.toSource();
    } else {
      return null;
    }
}
