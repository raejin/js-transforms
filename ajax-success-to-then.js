export default function transformer(file, api) {
  const j = api.jscodeshift;

  let isModified = false;

  const codemod = j(file.source)

    // find [$.ajax] looking code snippet
    .find(j.MemberExpression)

    .filter(path => {
      const node = path.node;

      const is$Form = (node.object.name === '$' || node.object.name === 'jQuery');
      const nodeName = is$Form && node.property.name.toLowerCase ? node.property.name.toLowerCase() : false;
      return is$Form
      && (nodeName === 'ajax' || nodeName === 'post' || nodeName === 'get' || nodeName === 'put');
    })

    // returning the parent of [$.ajax] node
    .map(path => {
      return path.parent
    })

    // make sure it is a callExpression $.ajax(...), not like `const ajax = $.ajax;`
    .filter(path => {
      return path.node.type === 'CallExpression';
    })

    .filter(path => {
      let properties;
      if (path.node.arguments[0].type === 'ObjectExpression') {
        properties = path.node.arguments[0].properties
      } else if (path.node.arguments.length > 1 && path.node.arguments[1].type === 'ObjectExpression') {
        properties = path.node.arguments[1].properties
      } else {
        return false
      }

      return properties && properties.findIndex((x) => (x.key.name === 'success')) !== -1 ||
        properties.findIndex((x) => (x.key.name === 'error')) !== -1 ||
        properties.findIndex((x) => (x.key.name === 'complete')) !== -1
    })

    // find 'success' or 'error' callbacks defined on the $.ajax(param)
    // and move them to the end of $.ajax(param).then(successCallback, errorCallback)
    .replaceWith(path => {
      isModified = true;
      let successCallback = path.node.arguments[0].properties.findIndex((x) => (x.key.name === 'success'))
      let errorCallback = path.node.arguments[0].properties.findIndex((x) => (x.key.name === 'error'))
      let completeCallback = path.node.arguments[0].properties.findIndex((x) => (x.key.name === 'complete'))

      if (errorCallback === -1 && completeCallback === -1 && successCallback !== -1) {
        // only success cb is defined
        const successNode = path.node.arguments[0].properties.splice(successCallback, 1)[0];
        const thenVar = j.identifier('then')
        return j.callExpression(j.memberExpression(path.node, thenVar), [successNode.value]);

      } else if (errorCallback === -1 && completeCallback !== -1 && successCallback !== -1) {
        // success & complete callbacks defined, errorCallback not defined
        const successNode = path.node.arguments[0].properties.splice(successCallback, 1)[0];
        completeCallback = path.node.arguments[0].properties.findIndex((x) => (x.key.name === 'complete'))
        const completeNode = path.node.arguments[0].properties.splice(completeCallback, 1)[0];
        const thenVar = j.identifier('then')
        const callExpr = j.callExpression(j.memberExpression(path.node, thenVar), [successNode.value]);
        return j.callExpression(j.memberExpression(callExpr, thenVar), [completeNode.value, completeNode.value]);

      } else if (successCallback === -1 && errorCallback !== -1 && completeCallback === -1) {
        // only error callback is defined
        const errorNode = path.node.arguments[0].properties.splice(errorCallback, 1)[0];
        const thenVar = j.identifier('then')
        return j.callExpression(j.memberExpression(path.node, thenVar), [j.literal(null), errorNode.value]);

      } else if (completeCallback === -1 && successCallback !== -1 && errorCallback !== -1) {
        // both defined, but completeCallback is not defined
        const successNode = path.node.arguments[0].properties.splice(successCallback, 1)[0];
        errorCallback = path.node.arguments[0].properties.findIndex((x) => (x.key.name === 'error'))
        const errorNode = path.node.arguments[0].properties.splice(errorCallback, 1)[0];

        const thenVar = j.identifier('then')
        return j.callExpression(j.memberExpression(path.node, thenVar), [successNode.value, errorNode.value]);

      } else if (completeCallback !== -1 && successCallback === -1 && errorCallback === -1) {
        // if only complete callback exists
        const completeNode = path.node.arguments[0].properties.splice(completeCallback, 1)[0];
        const thenVar = j.identifier('then')

        return j.callExpression(j.memberExpression(path.node, thenVar), [completeNode.value, completeNode.value]);

      } else {
        // all three defined

        const successNode = path.node.arguments[0].properties.splice(successCallback, 1)[0];
        errorCallback = path.node.arguments[0].properties.findIndex((x) => (x.key.name === 'error'))
        const errorNode = path.node.arguments[0].properties.splice(errorCallback, 1)[0];
        completeCallback = path.node.arguments[0].properties.findIndex((x) => (x.key.name === 'complete'))
        const completeNode = path.node.arguments[0].properties.splice(completeCallback, 1)[0];

        const thenVar = j.identifier('then')

        const callExpr = j.callExpression(j.memberExpression(path.node, thenVar), [successNode.value, errorNode.value]);
        return j.callExpression(j.memberExpression(callExpr, thenVar), [completeNode.value, completeNode.value]);

      }
    })

    if (isModified) {
      return codemod.toSource();
    } else {
      return null;
    }
}
