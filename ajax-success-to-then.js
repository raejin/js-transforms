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
      const properties = path.node.arguments[0].properties
      return properties.findIndex((x) => (x.key.name === 'success')) !== -1 ||
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

      // if (successCallback === -1 && errorCallback === -1 && completeCallback === -1) {
      //   return false;
      // }

      if (errorCallback === -1 && completeCallback === -1) {
        // only success cb is defined
        const successNode = path.node.arguments[0].properties.splice(successCallback, 1)[0];
        // successNode.value.id = j.identifier('success')
        const thenVar = j.identifier('then')
        return j.callExpression(j.memberExpression(path.node, thenVar), [successNode.value]);

      } else if (errorCallback === -1 && completeCallback !== -1) {
        // success & complete callbacks defined
        const successNode = path.node.arguments[0].properties.splice(successCallback, 1)[0];
        // successNode.value.id = j.identifier('success')
        completeCallback = path.node.arguments[0].properties.findIndex((x) => (x.key.name === 'complete'))
        const completeNode = path.node.arguments[0].properties.splice(completeCallback, 1)[0];
        const thenVar = j.identifier('then')
        const callExpr = j.callExpression(j.memberExpression(path.node, thenVar), [successNode.value]);
        // completeNode.value.id = j.identifier('complete')
        return j.callExpression(j.memberExpression(callExpr, thenVar), [completeNode.value]);

      } else if (successCallback === -1) {
        const errorNode = path.node.arguments[0].properties.splice(errorCallback, 1)[0];
        // errorNode.value.id = j.identifier('error')
        const thenVar = j.identifier('catch')
        return j.callExpression(j.memberExpression(path.node, thenVar), [errorNode.value]);
      } else if (completeCallback === -1 && successCallback !== -1 && errorCallback !== -1) {
        // both defined
        const successNode = path.node.arguments[0].properties.splice(successCallback, 1)[0];
        errorCallback = path.node.arguments[0].properties.findIndex((x) => (x.key.name === 'error'))
        const errorNode = path.node.arguments[0].properties.splice(errorCallback, 1)[0];

        // successNode.value.id = j.identifier('success')
        // errorNode.value.id = j.identifier('error')
        const thenVar = j.identifier('then')
        return j.callExpression(j.memberExpression(path.node, thenVar), [successNode.value, errorNode.value]);

      } else if (completeCallback !== -1 && successCallback === -1 && errorCallback === -1) {
        // if only complete callback exists
        const completeNode = path.node.arguments[0].properties.splice(completeCallback, 1)[0];
        const alwaysVar = j.identifier('always')

        return j.callExpression(j.memberExpression(path.node, alwaysVar), [completeNode.value]);

      } else {
        // all three defined

        const successNode = path.node.arguments[0].properties.splice(successCallback, 1)[0];
        errorCallback = path.node.arguments[0].properties.findIndex((x) => (x.key.name === 'error'))
        const errorNode = path.node.arguments[0].properties.splice(errorCallback, 1)[0];
        completeCallback = path.node.arguments[0].properties.findIndex((x) => (x.key.name === 'complete'))
        const completeNode = path.node.arguments[0].properties.splice(completeCallback, 1)[0];

        // successNode.value.id = j.identifier('success')
        // errorNode.value.id = j.identifier('error')
        const thenVar = j.identifier('then')

        const callExpr = j.callExpression(j.memberExpression(path.node, thenVar), [successNode.value, errorNode.value]);
        completeNode.value.id = j.identifier('complete')
        return j.callExpression(j.memberExpression(callExpr, thenVar), [completeNode.value]);

      }
    })

    if (isModified) {
      return codemod.toSource();
    } else {
      return null;
    }
}
