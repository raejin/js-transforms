export default function transformer(file, api) {
  const j = api.jscodeshift;

  let isModified = false;

  const codemod = j(file.source)

    // find [$.ajax] looking code snippet
    .find(j.MemberExpression)

    .filter(path => {
      const node = path.node;

      const is$Form = (node.object.name === 'Api');
      const nodeName = is$Form && node.property.name.toLowerCase ? node.property.name.toLowerCase() : false;
      return is$Form
      && (nodeName === 'get' || nodeName === 'post' || nodeName === 'deleteRequest' || nodeName === 'put') || nodeName === 'patch';
    })

    // returning the parent of [$.ajax] node
    .map(path => {
      return path.parent
    })

    // make sure it is a callExpression $.ajax(...), not like `const ajax = $.ajax;`
    // i don't feel like i care in this case
    // .filter(path => {
    //   return path.node.type === 'CallExpression';
    // })

    .filter(path => {
      // need to make sure that the option is an ObjectExpression
      if (path.node.arguments.length < 2) return false
      if (path.node.arguments[1] && path.node.arguments[1].type !== 'ObjectExpression') return false

      const properties = path.node.arguments[1].properties
      return properties && properties.findIndex((x) => (x.key.name === 'success')) !== -1 ||
        properties.findIndex((x) => (x.key.name === 'error')) !== -1
    })

    // find 'success' or 'error' callbacks defined on the $.ajax(param)
    // and move them to the end of $.ajax(param).then(successCallback, errorCallback)
    .replaceWith(path => {
      isModified = true;

      let successCallback = path.node.arguments[1].properties.findIndex((x) => (x.key.name === 'success'))
      let errorCallback = path.node.arguments[1].properties.findIndex((x) => (x.key.name === 'error'))

      if (errorCallback === -1 && successCallback !== -1) {

        const successNode = path.node.arguments[1].properties.splice(successCallback, 1)[0];
        const thenVar = j.identifier('then')

        if (path.node.arguments[1].properties.length === 0) {
          path.node.arguments.splice(1, 1);
        }

        return j.callExpression(j.memberExpression(path.node, thenVar), [successNode.value]);

      } else if (errorCallback !== -1 && successCallback === -1) {

        const errorNode = path.node.arguments[1].properties.splice(successCallback, 1)[0];

        if (path.node.arguments[1].properties.length === 0) {
          path.node.arguments.splice(1, 1);
        }

        const thenVar = j.identifier('catch')
        return j.callExpression(j.memberExpression(path.node, thenVar), [errorNode.value]);

      } else {
        const successNode = path.node.arguments[1].properties.splice(successCallback, 1)[0];
        errorCallback = path.node.arguments[1].properties.findIndex((x) => (x.key.name === 'error'))
        const errorNode = path.node.arguments[1].properties.splice(errorCallback, 1)[0];

        if (path.node.arguments[1].properties.length === 0) {
          path.node.arguments.splice(1, 1);
        }

        const thenVar = j.identifier('then')
        return j.callExpression(j.memberExpression(path.node, thenVar), [successNode.value, errorNode.value]);

      }
    })

    if (isModified) {
      return codemod.toSource();
    } else {
      return null;
    }
}
