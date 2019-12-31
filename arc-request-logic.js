/**
@license
Copyright 2018 The Advanced REST client authors <arc@mulesoft.com>
Licensed under the Apache License, Version 2.0 (the "License"); you may not
use this file except in compliance with the License. You may obtain a copy of
the License at
http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
License for the specific language governing permissions and limitations under
the License.
*/
import { LitElement } from 'lit-element';
import { EventsTargetMixin } from '@advanced-rest-client/events-target-mixin/events-target-mixin.js';
import { HeadersParserMixin } from '@advanced-rest-client/headers-parser-mixin/headers-parser-mixin.js';
import '@advanced-rest-client/variables-evaluator/variables-evaluator.js';

/**
 * @typedef {Object} RequestObject
 * @property {string} url
 * @property {string} method
 * @property {string=} headers
 * @property {string|blob|FormData|null} payload
 * @property {Object=} auth
 * @property {string=} authType
 * @property {Object=} config
 */
/**
 * `arc-request-logic`
 *
 * A request logic for Advanced REST Client excluding HTTP transport.
 *
 * ## Styling
 *
 * `<arc-request-logic>` provides the following custom properties and mixins for styling:
 *
 * Custom property | Description | Default
 * ----------------|-------------|----------
 * `--arc-request-logic` | Mixin applied to this elment | `{}`
 *
 * @customElement
 * @demo demo/index.html
 * @memberof ApiElements
 * @appliesMixin EventsTargetMixin
 */
class ArcRequestLogic extends EventsTargetMixin(HeadersParserMixin(LitElement)) {
  static get properties() {
    return {
      /**
       * Number of milliseconds after which the `before-request` event handlers
       * will be cancelled and the request continue without waiting for the
       * result. When set to `0`, `null`, `undefined` or `false` the timeoout
       * is not applied and the element waits with the request until
       * `continue-request` event is fired.
       */
      handlersTimeout: { type: Number },
      /**
       * When set variables parsing is not performed.
       * Actions are eqecuted even when this is set.
       */
      variablesDisabled: { type: Boolean },
      /**
       * A map of currently handled requests.
       * Keys are requests IDs generated in the request editor.
       * @type {Object}
       */
      _queue: { type: Object },
      /**
       * A reference name to the Jexl object.
       * Use dot notation to access it from the `window` object.
       * To set class pointer use `jexl` property.
       */
      jexlPath: { type: String },
      /**
       * A Jexl class reference.
       * If this value is set it must be a pointer to the Jexl class and
       * `jexlPath` is ignored.
       * This property is set automatically when `jexlPath` is processed.
       */
      jexl: { type: Object }
    };
  }
  /**
   * Returns a reference to the `variables-evaluator` element.
   * @return {Element}
   */
  get evalElement() {
    if (!this._eval) {
      this._eval = document.createElement('variables-evaluator');
      this._eval.noBeforeRequest = true;
      this._eval.eventTarget = this.eventsTarget;
      this._eval.jexlPath = this.jexlPath;
      this._eval.jexl = this.jexl;
      this.shadowRoot.appendChild(this._eval);
    }
    return this._eval;
  }

  constructor() {
    super();
    this._apiRequestHandler = this._apiRequestHandler.bind(this);
    this._continueRequestHandler = this._continueRequestHandler.bind(this);
    this._resendHandler = this._resendHandler.bind(this);
    this._reportHandler = this._reportHandler.bind(this);

    this.handlersTimeout = 2000;
    this._queue = {};
  }

  _attachListeners(node) {
    node.addEventListener('api-request', this._apiRequestHandler);
    node.addEventListener('continue-request', this._continueRequestHandler);
    node.addEventListener('resend-auth-request', this._resendHandler);
    node.addEventListener('report-response', this._reportHandler);
  }

  _detachListeners(node) {
    node.removeEventListener('api-request', this._apiRequestHandler);
    node.removeEventListener('continue-request', this._continueRequestHandler);
    node.removeEventListener('resend-auth-request', this._resendHandler);
    node.removeEventListener('report-response', this._reportHandler);
  }
  /**
   * A handler for the `api-request` event. It processes the request
   * and sends it to the transport library.
   * @param {CustomEvent} e
   */
  _apiRequestHandler(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const request = e.detail;
    this.processRequest(request);
    setTimeout(() => this._reportUrlHistory(request.url));
  }
  /**
   * Dispatches `url-history-store` custom event which is a part of request logic
   * to store URL history.
   * @param {String} value Request URL
   * @return {CustomEvent} Disaptched event
   */
  _reportUrlHistory(value) {
    const e = new CustomEvent('url-history-store', {
      bubbles: true,
      composed: true,
      cancelable: true,
      detail: {
        value
      }
    });
    this.dispatchEvent(e);
    return e;
  }
  /**
   * Processes the request by executing request actions and evaluating
   * variables. When ready it sends the request to the transport.
   * @param {Object} request ARC request object
   * @return {Promise}
   */
  async processRequest(request) {
    let copy = this._prepareEventRequest(request);
    this._queue[copy.id] = copy;
    copy = await this._beforeProcessVariables(copy);
    await this._beforeRequest(copy);
    return copy;
  }
  /**
   * Prepares a request object to be used to send it with the `before-request`
   * event. This is a "shallow" copy of the `request` property. It only creates
   * a copy of the primitive values of the object. If the `payload` is an
   * object (`FormData` or `File`) then it will be passed by reference instead
   * of copying the object.
   *
   * It adds `promises` property to the object that is required by the
   * `before-request` event.
   *
   * @param {Object} request ARC request object
   * @return {Object} Copy of the `request` property.
   */
  _prepareEventRequest(request) {
    const shallowCopy = Object.assign({}, request);
    shallowCopy.promises = [];
    if (['GET', 'HEAD'].indexOf(request.method) !== -1) {
      delete shallowCopy.payload;
    }
    return shallowCopy;
  }
  /**
   * Before the request object can be sent to any `before-request` handler
   * it must be first evaluated by variables evaluator. It is the only way to
   * ensure that the handler will receive actuall request data.
   *
   * @param {Object} request ARC request object
   * @return {Promise}
   */
  async _beforeProcessVariables(request) {
    try {
      const override = await this._preparePreRequestVariables(request);
      this._notifyVariablesChange(override);
      if (!this.variablesDisabled) {
        request = await this.evalElement.processBeforeRequest(request, override);
      }
    } catch (_) {
      // ...
    }
    return request;
  }
  /**
   * Prepares scripts context override values for variables evaluator.
   * If there are actions defined for the `beforeRequest` key then it will
   * get list of variables and create the override object.
   *
   * @param {Object} request ARC request object
   * @return {Promise} Promise resolved to an object of variables
   * or undefined if actions not defined.
   */
  async _preparePreRequestVariables(request) {
    const actions = request.requestActions;
    if (!actions) {
      return;
    }
    const vars = actions.variables;
    if (!vars || !vars.length) {
      return;
    }
    const result = {};
    vars.forEach((item) => {
      if (item.enabled === false) {
        return;
      }
      result[item.variable] = item.value;
    });
    const _eval = this.evalElement;
    return await _eval.evaluateVariables(result);
  }
  /**
   * Notifies listeners when variable update action changes
   * @param {Object} obj Map of variables to update
   */
  _notifyVariablesChange(obj) {
    if (!obj) {
      return;
    }
    Object.keys(obj).forEach((key) => {
      const detail = {
        variable: key,
        value: obj[key]
      };
      this.dispatchEvent(new CustomEvent('variable-update-action', {
        composed: true,
        bubbles: true,
        detail
      }));
    });
  }
  /**
   * Dispatches `before-request` custom event.
   * @param {Object} request ARC request object after variables evaluation.
   * @return {CustomEvent}
   */
  _dispatchBeforeRequest(request) {
    const e = new CustomEvent('before-request', {
      composed: true,
      bubbles: true,
      cancelable: true,
      detail: request
    });
    this.dispatchEvent(e);
    return e;
  }

  /**
   * Handles the before request logic.
   * @param {Object} request ARC request object after variables evaluation.
   * @return {Promise}
   */
  async _beforeRequest(request) {
    const ID = request.id;
    const bre = this._dispatchBeforeRequest(request);
    if (bre.defaultPrevented) {
      this._reportCancelation(bre.detail.reason);
      return;
    }
    const p = bre.detail.promises;
    if (p && p.length) {
      this._queue[ID]._beforePromisesResolved = false;
      const timeout = this._computeHandlersTimeout(p);
      if (timeout > 0) {
        this._queue[ID]._currentTimeout =
          window.setTimeout(() => this._onBeforeRequestTimeout(ID), timeout);
      } else {
        this._queue[ID]._awaitingContinue = true;
      }
      try {
        await Promise.all(p);
      } catch (cause) {
        this._reportError(ID, cause);
        return;
      }
    }

    if (!this._queue[ID]) {
      return;
    }
    this._queue[ID]._beforePromisesResolved = true;
    if (this._queue[ID]._beforeTimedOut || this._queue[ID]._cancelled) {
      return;
    }
    if (!this._queue[ID]._awaitingContinue) {
      this._continueRequest(request);
    }
  }
  /**
   * Dispatches `api-response` event
   * @param {Object} detail The detail object with ARC's `api-response` object.
   * @return {CustomEvent}
   */
  _disaptchResponse(detail) {
    const e = new CustomEvent('api-response', {
      bubbles: true,
      composed: true,
      detail
    });
    this.dispatchEvent(e);
    return e;
  }

  /**
   * Common function to report error in the process.
   * @param {String} id Request original ID.
   * @param {Error} cause An error object
   */
  _reportError(id, cause) {
    const request = this._queue[id];
    if (!request) {
      return;
    }
    delete this._queue[id];
    this._disaptchResponse({
      isError: true,
      error: cause,
      loadingTime: 0,
      request
    });
  }
  /**
   * Computes timeout for the before-request event handlers.
   * It reads a `timeout` property from a promise. If set, it returns a highest
   * value for the timeout or default value defined in the `handlersTimeout`
   * property. If `handlersTimeout` is falsy or any timeout property equals
   * zero (`0`) then this function returns -1 meaning no timeout.
   *
   * @param {Array} promises Array of promises returned by the handlers.
   * @return {Number} -1 for no timeout or positive number of milliseconds
   * for the `before-request` event to be handled by all handlers.
   */
  _computeHandlersTimeout(promises) {
    let timeout = this.handlersTimeout;
    if (!timeout) {
      return -1;
    }
    if (!promises || !promises.length) {
      return timeout;
    }
    for (let i = 0, len = promises.length; i < len; i++) {
      if (promises[i].timeout !== undefined) {
        if (promises[i].timeout === 0) {
          return -1;
        }
        if (promises[i].timeout > timeout) {
          timeout = promises[i].timeout;
        }
      }
    }
    if (timeout === 0) {
      timeout = -1;
    }
    return timeout;
  }
  /**
   * Clears the before-request timeout timer.
   * @param {String} id Request ID
   */
  _clearBeforeRequestTimeout(id) {
    if (this._queue[id]._currentTimeout) {
      window.clearTimeout(this._queue[id]._currentTimeout);
      this._queue[id]._currentTimeout = undefined;
    }
  }
  /**
   * Called when the `before-request` timeout fired.
   * It continues the request with current values in the `_requestCopy`
   * property that has been sent with the `before-request` event.
   *
   * @param {String} id Request ID
   */
  _onBeforeRequestTimeout(id) {
    this._queue[id]._currentTimeout = undefined;
    this._queue[id]._beforeTimedOut = true;
    this._continueRequest(this._queue[id]);
  }
  /**
   * Handler for `continue-request` custom event.
   * Calls `continueRequest()` function.
   * @param {CustomEvent} e
   */
  _continueRequestHandler(e) {
    const request = this._queue[e.detail.id];
    if (!request) {
      return;
    }
    this.continueRequest(request);
  }
  /**
   * It continues the request flow if all promises for the `before-request`
   * has been resolved.
   * It do nothing if current request doesn't expect this event to be handled
   * (no timeout set to 0).
   *
   * @param {Object} request ARC request object
   */
  continueRequest(request) {
    if (!request._awaitingContinue) {
      return;
    }
    if (!request._beforePromisesResolved) {
      this._awaitingContinue = false;
      return;
    }
    this._continueRequest(request);
  }
  /**
   * Called when before request block finished (whatever the output) and the
   * request can now be send to the transport library.
   *
   * @param {Object} request The request object
   */
  async _continueRequest(request) {
    this._clearBeforeRequestTimeout(request.id);
    // request = Object.assign({}, request);
    delete request.promises;
    delete request.reason;
    delete request._beforePromisesResolved;
    delete request._awaitingContinue;
    delete request._beforeTimedOut;
    delete request._currentTimeout;
    delete request._cancelled;
    await this._processAuth(request);
    // Changes to the `_requestCopy` object won't affect sent object.
    // However changes made to FormData or File object of the payload property
    // or to the `auth` object will affect send object because those are
    // references to an object.
    const copy = this._prepareTransportObject(request);
    this.dispatchEvent(new CustomEvent('transport-request', {
      composed: true,
      bubbles: true,
      detail: copy
    }));
  }
  /**
   * Creates an immutable request data object to be send to the transport
   * library.
   * @param {Object} request Request object.
   * @return {Object} Immutable request object.
   */
  _prepareTransportObject(request) {
    const configuration = {};
    Object.keys(request).forEach((key) => {
      configuration[key] = {
        value: request[key],
        writable: false,
        enumerable: true
      };
    });
    return Object.create(Object.prototype, configuration);
  }
  /**
   * Handler for `resend-auth-request` custom event to resend the request
   * when needed.
   * @param {CustomEvent} e
   */
  _resendHandler(e) {
    const request = this._queue[e.detail.id];
    if (!request) {
      return;
    }
    this.processRequest(request);
  }
  /**
   * Handler for `report-response` event dispatched by the transport library.
   * Reports the response using ARC events API and cleans data.
   * @param {CustomEvent} e
   */
  _reportHandler(e) {
    const request = this._queue[e.detail.id];
    if (!request) {
      return;
    }
    delete this._queue[e.detail.id];
    this._reportResponse(request, e.detail);
  }
  /**
   * Handles response actions if any and dispatches `api-response` event.
   * @param {Object} request ArcRequest object
   * @param {Object} arcResponse ArcResponse object
   * @return {Promise}
   */
  async _reportResponse(request, arcResponse) {
    const ra = request.responseActions;
    if (ra && ra.length) {
      try {
        await this._processResponseActions(ra, arcResponse.request, arcResponse.response);
      } catch (_) {
        // ...
      }
    }
    this._disaptchResponse(arcResponse);
  }
  /**
   * Executes response action before displaying the results.
   *
   * @param {Array} actions list of actions to execute
   * @param {Request} request
   * @param {Response} response
   * @return {Promise}
   */
  async _processResponseActions(actions, request, response) {
    const e = new CustomEvent('run-response-actions', {
      composed: true,
      bubbles: true,
      cancelable: true,
      detail: {
        actions,
        request,
        response
      }
    });
    this.dispatchEvent(e);
    if (e.defaultPrevented) {
      return e.detail.result;
    }
  }
  /**
   * Reports cancelation by any of pre-request handlers.
   * @param {Error} reason Error object for the reason.
   */
  _reportCancelation(reason) {
    reason = reason || 'The request has been canceled';
    this._reportError(new Error(reason));
  }

  /**
   * Processes raw authorization configuration to transform it, if possible,
   * into correct authorization configuration.
   *
   * Currently this method processes authorization for:
   * - oauth 2
   * - basic
   * - client certificates.
   *
   * @param {RequestObject} request
   * @return {Promise}
   */
  async _processAuth(request) {
    switch (request.authType) {
      case 'client certificate': await this._processClientCertificate(request); break;
      case 'basic': await this._processBasicAuth(request); break;
      case 'oauth 2': await this._processOAuth2(request); break;
    }
  }

  /**
   * Adds `clientCertificate` property from authorization configuration.
   * This requires `client-certificates-model` to be present in the DOM.
   *
   * @param {RequestObject} request
   * @return {Promise}
   */
  async _processClientCertificate(request) {
    const { auth } = request;
    if (!auth || !auth.id) {
      return;
    }
    const e = new CustomEvent('client-certificate-get', {
      bubbles: true,
      cancelable: true,
      composed: true,
      detail: {
        id: auth.id
      }
    });
    this.dispatchEvent(e);
    try {
      const result = await e.detail.result;
      if (!result) {
        return;
      }
      request.clientCertificate = {
        type: result.type,
        cert: [result.cert],
      };
      if (result.key) {
        request.clientCertificate.key = [result.key];
      }
    } catch (e) {
      // ...
    }
  }

  /**
   * Adds `authorization` header for basic authentication.
   * @param {RequestObject} request
   * @return {Promise}
   */
  async _processBasicAuth(request) {
    const { auth } = request;
    if (!auth || !auth.username) {
      return;
    }
    const { username, password } = auth;
    let headers = this.headersToJSON(request.headers || '');
    const value = btoa(`${username}:${password || ''}`);
    headers = this.replaceHeaderValue(headers, 'authorization', `Basic ${value}`);
    request.headers = this.headersToString(headers);
  }

  /**
   * Processes authorization data for OAuth 2 authorization.
   * @param {RequestObject} request
   * @return {Promise}
   */
  async _processOAuth2(request) {
    const { auth } = request;
    if (!auth) {
      return;
    }
    const { accessToken, tokenType='Bearer', deliveryMethod='header', deliveryName='authorization' } = auth;
    if (!accessToken) {
      return;
    }

    if (deliveryMethod !== 'header') {
      // TODO (pawel): add support for query parameters delivery method.
      // Because the authorization panel does not support it right now it is
      // not implemented, yet.
      return;
    }
    let headers = this.headersToJSON(request.headers || '');
    const value = `${tokenType} ${accessToken}`;
    headers = this.replaceHeaderValue(headers, deliveryName, value);
    request.headers = this.headersToString(headers);
  }

  /**
   * Dispatched when request is made. This is handled by `urlhistory-model`
   * to store URL history data.
   *
   * @event url-history-store
   * @param {String} value The URL to store.
   */

  /**
   * @event variable-update-action
   */
  /**
   * @event before-request
   */
  /**
   * @event api-response
   */
  /**
   * @event transport-request
   * @param {RequestObject}
   */
  /**
   * @event run-response-actions
   * @param {Array<Object>} actions
   * @param {RequestObject} request
   * @param {Object} response
   */
  /**
   * Dispatched when requesting client certificate data from a data store.
   * @event client-certificate-get
   * @param {String} id
   */
}
window.customElements.define('arc-request-logic', ArcRequestLogic);
