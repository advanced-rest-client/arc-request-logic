[![Build Status](https://travis-ci.org/advanced-rest-client/api-url-data-model.svg?branch=stage)](https://travis-ci.org/advanced-rest-client/arc-request-logic)

[![Published on webcomponents.org](https://img.shields.io/badge/webcomponents.org-published-blue.svg)](https://www.webcomponents.org/element/advanced-rest-client/arc-request-logic)

# arc-request-logic

A request logic for Advanced REST Client excluding HTTP transport.

This component is responsible for handing `api-request` event, handing variables processing, request actions, `before-request` event, dispatching URL history store event, communicating with transport library, and finally dispatching `api-response` event. If the transport library it the hearth of the application then this component is it's brain.

This library uses `advanced-rest-client/variables-evaluator` which depend on `advanced-rest-client/Jexl` (version 2.x) and this library is not included by default in the element.
You need to add this dependency manually.

```html
<!-- Component sources -->
<link rel="import" href="bower_components/arc-request-logic/arc-request-logic.html">
<!-- Request / response actions -->
<link rel="import" href="bower_components/request-hooks-logic/request-hooks-logic.html">
<!-- Variables manager and variables model to handle storing variables in request actions -->
<link rel="import" href="bower_components/variables-manager/variables-manager.html">
<link rel="import" href="bower_components/arc-models/variables-model.html">
<!-- Variables processor (optional dependency but required, there's many ways to include it into the web app and including it into the component is not the most efficient one) -->
<link rel="import" href="bower_components/jexl/jexl.html">
<!-- URL history model to store request URL in history -->
<link rel="import" href="bower_components/arc-models/url-history-model.html">

<arc-request-logic></arc-request-logic>
```

## Example usage

### From custom event

```javascript
const request = {
  id: '763b4b86-f00e-4e05-96de-8dd0875c0f59',
  url: 'https://api.domain.com/',
  method: 'POST',
  headers: 'content-type: application/json',
  payload: '{"test": true}',
  responseActions: [{...}] // see https://github.com/advanced-rest-client/request-hooks-logic
}

document.body.addEventListener('api-response', (e) => {
  const detail = e.detail;
  if (detail.id === request.id) {
    return;
  }
  console.log(detail.isError);
  console.log(detail.response);
});

document.body.dispatchEvent(new CustomEvent('api-request', {
  bubbles: true,
  cancelable: true,
  detail: request
});
```

### From component's API

The `api-response` event always has to be handled. The promise API results when the request has been pushed to the transport library.

```javascript
const node = document.querySelector('arc-request-logic');
node.processRequest(request)
.then(() => {
  console.log('Request sent to the transport library.');
});
```

### Middleware

Handle `before-request` custom event to alter request properties before send.
When the handler is synchronous then there's no need for additional steps.

If the handler is asynchronous then add a `Promise` to the `promises` array on detail object and resolve it when ready. It is possible to set `timeout` property on the promise to extend default timeout for `before-request` event processing which is set to 2000ms.

```javascript
document.body.addEventListener('before-request', (e) => {
  cont p = new Promise((resolve) => {
    sync processUrl(e.detail); // set new URL on the detail object as objects are passed by reference
    resolve();
  });
  p.timeout = 3500;
  e.detail.promises.push(p);
});

document.body.dispatchEvent(new CustomEvent('api-request', {
  bubbles: true,
  cancelable: true,
  detail: request
});
```

Mind that other handlers may interact with the same properties. Even though there's no race conditions per so in JavaScript you may get different values between processing different parts of request if the event loop is releases.

### API components

This components is a part of [API components ecosystem](https://elements.advancedrestclient.com/)
