[![Published on NPM](https://img.shields.io/npm/v/@advanced-rest-client/arc-request-logic.svg)](https://www.npmjs.com/package/@advanced-rest-client/arc-request-logic)

[![Build Status](https://travis-ci.org/advanced-rest-client/arc-request-logic.svg?branch=stage)](https://travis-ci.org/advanced-rest-client/arc-request-logic)

[![Published on webcomponents.org](https://img.shields.io/badge/webcomponents.org-published-blue.svg)](https://www.webcomponents.org/element/advanced-rest-client/arc-request-logic)


# arc-request-logic

A request logic for Advanced REST Client excluding HTTP transport.

This component is responsible for handing `api-request` event, handing variables processing, request actions, `before-request` event, dispatching URL history store event, communicating with transport library, and finally dispatching `api-response` event. If the transport library it the hearth of the application then this component is it's brain.

This library uses `@advanced-rest-client/variables-evaluator` which depend on `Jexl` (version 2.x) and this library is not included by default in the element.
You need to add this dependency manually.

## Example:

```html
<arc-request-logic></arc-request-logic>
```

## API components

This components is a part of [API components ecosystem](https://elements.advancedrestclient.com/)

## Usage

### Installation
```
npm install --save @advanced-rest-client/arc-request-logic
```

### In an html file

```html
<html>
  <head>
    <script type="module">
      import './node_modules/@advanced-rest-client/arc-request-logic/arc-request-logic.js';
    </script>
  </head>
  <body>
    <arc-request-logic></arc-request-logic>
  </body>
</html>
```

### In a Polymer 3 element

```js
import {PolymerElement, html} from './node_modules/@polymer/polymer/polymer-element.js';
import './node_modules/@advanced-rest-client/arc-request-logic/arc-request-logic.js';

class SampleElement extends PolymerElement {
  static get template() {
    return html`
    <arc-request-logic></arc-request-logic>
    `;
  }
}
customElements.define('sample-element', SampleElement);
```

### Installation

```sh
git clone https://github.com/advanced-rest-client/arc-request-logic
cd api-url-editor
npm install
npm install -g polymer-cli
```

### Running the demo locally

```sh
polymer serve --npm
open http://127.0.0.1:<port>/demo/
```

### Running the tests
```sh
polymer test --npm
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
