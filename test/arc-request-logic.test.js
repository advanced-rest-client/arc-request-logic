import { fixture, assert, html } from '@open-wc/testing';
import { DataGenerator } from '@advanced-rest-client/arc-data-generator/arc-data-generator.js';
import sinon from 'sinon';
import '@advanced-rest-client/arc-models/client-certificate-model.js';
import '../arc-request-logic.js';
import './demo-transport.js';

describe('<arc-request-logic>', function() {
  async function basicFixture() {
    return await fixture(`<arc-request-logic jexlpath="ArcVariables.JexlDev"></arc-request-logic>`);
  }

  async function varsDisabledFixture() {
    return await fixture(`<arc-request-logic variablesdisabled jexlpath="ArcVariables.JexlDev"></arc-request-logic>`);
  }

  async function certificatesFixture() {
    const element = await fixture(html`<div>
      <client-certificate-model></client-certificate-model>
      <arc-request-logic variablesdisabled jexlpath="ArcVariables.JexlDev"></arc-request-logic>
    </div>`);
    return element.querySelector('arc-request-logic');
  };

  before(() => {
    const transport = document.createElement('demo-transport');
    document.body.appendChild(transport);
  });

  after(() => {
    const transport = document.querySelector('demo-transport');
    document.body.removeChild(transport);
  });

  function untilTransportRequest(element) {
    return new Promise((resolve) => {
      element.addEventListener('transport-request', function f(e) {
        element.removeEventListener('transport-request', f);
        resolve(e);
      });
    });
  }

  const request = {
    id: 'test-id',
    url: 'https://domain.com/${test1}',
    headers: 'content-length: 0\nx-test: true\nx-var: ${test2}',
    method: 'POST',
    payload: '${test1}',
    responseActions: [{
      source: 'response.headers.status.${test4}',
      action: 'assign-variable',
      destination: 'myVar-${test3}'
    }],
    requestActions: {
      variables: [{
        enabled: true,
        value: 'test-value',
        variable: 'test-var'
      }, {
        enabled: true,
        variable: 'v2',
        value: '${test1}'
      }, {
        enabled: false,
        variable: 'v3',
        value: '${test2}'
      }]
    }
  };

  describe('get evalElement()', () => {
    let element;
    beforeEach(async () => {
      element = await basicFixture();
    });

    it('Returns variables-evaluator element', () => {
      const result = element.evalElement;
      assert.equal(result.nodeName, 'VARIABLES-EVALUATOR');
    });

    it('Inserts element into the DOM', () => {
      const result = element.evalElement;
      assert.ok(result);
      const node = element.shadowRoot.querySelector('variables-evaluator');
      assert.equal(node.nodeName, 'VARIABLES-EVALUATOR');
    });

    it('Eval has noBeforeRequest property', () => {
      const result = element.evalElement;
      assert.isTrue(result.noBeforeRequest);
    });

    it('Eval has eventTarget property', () => {
      const result = element.evalElement;
      assert.isTrue(result.eventTarget === element.eventsTarget);
    });

    it('Returns the same element', () => {
      const result1 = element.evalElement;
      const result2 = element.evalElement;
      assert.isTrue(result1 === result2);
    });
  });

  describe('_apiRequestHandler()', () => {
    let element;
    beforeEach(async () => {
      element = await basicFixture();
    });

    function fire() {
      const e = new CustomEvent('api-request', {
        bubbles: true,
        cancelable: true,
        detail: {
          id: 'test',
          url: 'http://test',
          method: 'GET',
          headers: ''
        }
      });
      document.body.dispatchEvent(e);
      return e;
    }

    it('Handles api-request event', (done) => {
      element.addEventListener('transport-request', function f() {
        element.removeEventListener('transport-request', f);
        done();
      });
      const e = fire();
      assert.isTrue(e.defaultPrevented);
    });

    it('Calls processRequest()', (done) => {
      const spy = sinon.spy(element, 'processRequest');
      element.addEventListener('transport-request', function f() {
        element.removeEventListener('transport-request', f);
        done();
      });
      const e = fire();
      assert.isTrue(spy.called);
      assert.isTrue(spy.args[0][0] === e.detail);
    });

    it('Calls _reportUrlHistory()', (done) => {
      const spy = sinon.spy(element, '_reportUrlHistory');
      element.addEventListener('transport-request', function f() {
        element.removeEventListener('transport-request', f);
        setTimeout(() => {
          assert.isTrue(spy.called);
          assert.equal(spy.args[0][0], 'http://test');
          done();
        });
      });
      fire();
    });
  });

  describe('_reportUrlHistory()', () => {
    const value = 'https://domain.com';
    let element;
    beforeEach(async () => {
      element = await basicFixture();
    });

    it('Dispatches url-history-store event', () => {
      const spy = sinon.spy();
      element.addEventListener('url-history-store', spy);
      element._reportUrlHistory(value);
      assert.isTrue(spy.called);
    });

    it('Returns the event', () => {
      const result = element._reportUrlHistory(value);
      assert.typeOf(result, 'customevent');
    });

    it('Event is cancelable', () => {
      const result = element._reportUrlHistory(value);
      assert.isTrue(result.cancelable);
    });

    it('Event is composed', () => {
      const result = element._reportUrlHistory(value);
      if (result.composed !== undefined) {
        assert.isTrue(result.composed);
      }
    });

    it('Event has value set', () => {
      const result = element._reportUrlHistory(value);
      assert.equal(result.detail.value, value);
    });
  });

  describe('processRequest()', () => {
    let element;
    let request;
    beforeEach(async () => {
      element = await basicFixture();
      request = {
        id: 'test',
        url: 'http://test',
        method: 'GET',
        headers: ''
      };
    });

    it('Calls _prepareEventRequest()', (done) => {
      const spy = sinon.spy(element, '_prepareEventRequest');
      element.processRequest(request);
      element.addEventListener('transport-request', function f() {
        element.removeEventListener('transport-request', f);
        assert.isTrue(spy.called);
        // For a moment this are different objects.
        assert.deepEqual(spy.args[0][0], request);
        done();
      });
    });

    it('Adds request to the queue', (done) => {
      element.processRequest(request);
      element.addEventListener('transport-request', function f() {
        element.removeEventListener('transport-request', f);
        assert.deepEqual(element._queue[request.id].id, request.id);
        done();
      });
    });

    it('Calls _beforeProcessVariables()', (done) => {
      const spy = sinon.spy(element, '_beforeProcessVariables');
      element.processRequest(request);
      element.addEventListener('transport-request', function f() {
        element.removeEventListener('transport-request', f);
        assert.isTrue(spy.called);
        assert.deepEqual(spy.args[0][0].id, request.id);
        done();
      });
    });

    it('Returns a promise', () => {
      const result = element.processRequest(request);
      assert.typeOf(result.then, 'function');
      return result;
    });
  });

  describe('_prepareEventRequest()', function() {
    let result;
    let element;
    beforeEach(async function() {
      element = await basicFixture();
      const _request = Object.assign({}, request);
      result = element._prepareEventRequest(_request);
    });

    it('Copies request object properties', function() {
      assert.equal(result.url, request.url);
      assert.equal(result.headers, request.headers);
      assert.equal(result.method, request.method);
    });

    it('Generated object is a copy', function() {
      result.url = 'test';
      assert.notEqual(result.url, request.url);
    });

    it('Adds promises array', function() {
      assert.typeOf(result.promises, 'array');
    });

    it('Removes payload for GET', function() {
      const _request = Object.assign({}, request);
      _request.payload = 'test';
      _request.method = 'GET';
      result = element._prepareEventRequest(_request);
      assert.isUndefined(result.payload);
    });

    it('Removes payload for HEAD', function() {
      const _request = Object.assign({}, request);
      _request.payload = 'test';
      _request.method = 'HEAD';
      result = element._prepareEventRequest(_request);
      assert.isUndefined(result.payload);
    });

    it('Do not removes payload for POST', function() {
      const _request = Object.assign({}, request);
      _request.payload = 'test';
      _request.method = 'POST';
      result = element._prepareEventRequest(_request);
      assert.equal(result.payload, 'test');
    });
  });

  describe('_beforeProcessVariables()', function() {
    const contextFactory = function(e) {
      e.preventDefault();
      e.detail.variables = [{
        variable: 'test1',
        value: 'value1',
        enabled: true
      }, {
        variable: 'test2',
        value: 'value2 ${test1}',
        enabled: true
      }, {
        variable: 'test3',
        value: 'value3 ${test4}',
        enabled: true
      }, {
        variable: 'test4',
        value: 'value4',
        enabled: true
      }, {
        variable: 'test5',
        value: 'value5',
        enabled: false
      }];
    };

    before(function() {
      window.addEventListener('environment-current', contextFactory);
    });

    after(function() {
      window.removeEventListener('environment-current', contextFactory);
    });

    let element;
    beforeEach(async function() {
      element = await basicFixture();
    });

    it('Processes all variables', async () => {
      const r = Object.assign({}, request);
      element._queue[r.id] = r;
      const result = await element._beforeProcessVariables(r);
      assert.equal(result.url, 'https://domain.com/value1');
      assert.equal(result.headers, 'content-length: 0\nx-test: true\nx-var: value2 value1');
      assert.equal(result.payload, 'value1');
    });

    it('Calls _preparePreRequestVariables()', async () => {
      const r = Object.assign({}, request);
      element._queue[r.id] = r;
      const spy = sinon.spy(element, '_preparePreRequestVariables');
      await  element._beforeProcessVariables(r)
      assert.isTrue(spy.called);
      assert.deepEqual(spy.args[0][0], r);
    });

    it('Calls _notifyVariablesChange()', async () => {
      const r = Object.assign({}, request);
      element._queue[r.id] = r;
      const spy = sinon.spy(element, '_notifyVariablesChange');
      await element._beforeProcessVariables(r)
      assert.isTrue(spy.called);
      assert.typeOf(spy.args[0][0], 'object');
    });

    it('Calls processBeforeRequest()', async () => {
      const r = Object.assign({}, request);
      element._queue[r.id] = r;
      const spy = sinon.spy(element.evalElement, 'processBeforeRequest');
      await  element._beforeProcessVariables(r)
      assert.isTrue(spy.called);
      assert.deepEqual(spy.args[0][0], r);
      assert.typeOf(spy.args[0][1], 'object');
    });
  });

  describe('Variables disabled', function() {
    let element;

    beforeEach(async () => {
      element = await varsDisabledFixture();
    });

    it('Does not evaluates variables', async () => {
      const _request = Object.assign({}, request);
      const result = await element._beforeProcessVariables(_request);
      assert.equal(result.url, request.url);
      assert.equal(result.headers, request.headers);
      assert.equal(result.payload, request.payload);
    });
  });

  describe('_preparePreRequestVariables()', function() {
    const contextFactory = function(e) {
      e.preventDefault();
      e.detail.variables = [{
        variable: 'test1',
        value: 'value1',
        enabled: true
      }, {
        variable: 'test2',
        value: 'value2 ${test1}',
        enabled: true
      }, {
        variable: 'test3',
        value: 'value3 ${test4}',
        enabled: true
      }, {
        variable: 'test4',
        value: 'value4',
        enabled: true
      }, {
        variable: 'v3',
        value: 'value5',
        enabled: false
      }];
    };

    before(function() {
      window.addEventListener('environment-current', contextFactory);
    });

    after(function() {
      window.removeEventListener('environment-current', contextFactory);
    });

    let element;
    beforeEach(async function() {
      element = await basicFixture();
    });

    it('Returns Promise', function() {
      const _request = Object.assign({}, request);
      const result = element._preparePreRequestVariables(_request);
      assert.typeOf(result.then, 'function');
      return result;
    });

    it('Evaluates variables', function() {
      const _request = Object.assign({}, request);
      return element._preparePreRequestVariables(_request)
      .then(function(result) {
        assert.equal(result.v2, 'value1');
      });
    });

    it('Contains list of variables', function() {
      const _request = Object.assign({}, request);
      return element._preparePreRequestVariables(_request)
      .then(function(result) {
        assert.equal(result['test-var'], 'test-value');
        assert.equal(result.v2, 'value1');
      });
    });

    it('Disabled variable is not present', function() {
      const _request = Object.assign({}, request);
      return element._preparePreRequestVariables(_request)
      .then(function(result) {
        assert.isUndefined(result.v3);
      });
    });

    it('Contains two items', function() {
      const _request = Object.assign({}, request);
      return element._preparePreRequestVariables(_request)
      .then(function(result) {
        assert.lengthOf(Object.keys(result), 2);
      });
    });

    it('Returns undefined when no actions', function() {
      return element._preparePreRequestVariables({})
      .then(function(result) {
        assert.isUndefined(result);
      });
    });

    it('Returns undefined when no variables in actions', function() {
      return element._preparePreRequestVariables({
        requestActions: {}
      })
      .then(function(result) {
        assert.isUndefined(result);
      });
    });
  });

  describe('_notifyVariablesChange()', function() {
    const vars = {
      v1: 't1',
      v2: '${test1}'
    };
    let element;
    beforeEach(async function() {
      element = await basicFixture();
    });

    it('Fires event when variable to be set', function() {
      const spy = sinon.spy();
      element.addEventListener('variable-update-action', spy);
      element._notifyVariablesChange(vars);
      assert.equal(spy.callCount, 2);
    });

    it('Event detail contains valid properties', function() {
      let eventData;
      element.addEventListener('variable-update-action', function clb(e) {
        element.removeEventListener('variable-update-action', clb);
        eventData = e.detail;
      });
      element._notifyVariablesChange(vars);
      assert.equal(eventData.variable, 'v1');
      assert.equal(eventData.value, 't1');
    });

    it('Does not fire events for empty object', function() {
      const spy = sinon.spy();
      element.addEventListener('variable-update-action', spy);
      element._notifyVariablesChange({});
      assert.isFalse(spy.called);
    });

    it('Does not fire events for missing object', function() {
      const spy = sinon.spy();
      element.addEventListener('variable-update-action', spy);
      element._notifyVariablesChange();
      assert.isFalse(spy.called);
    });
  });

  describe('_dispatchBeforeRequest()', () => {
    let element;
    const request = {url: 'test'};
    beforeEach(async function() {
      element = await basicFixture();
    });

    it('Dispatches before-request event', () => {
      const spy = sinon.spy();
      element.addEventListener('before-request', spy);
      element._dispatchBeforeRequest(request);
      assert.isTrue(spy.called);
    });

    it('Returns the event', () => {
      const result = element._dispatchBeforeRequest(request);
      assert.typeOf(result, 'customevent');
    });

    it('Event is cancelable', () => {
      const result = element._dispatchBeforeRequest(request);
      assert.isTrue(result.cancelable);
    });

    it('Event is composed', () => {
      const result = element._dispatchBeforeRequest(request);
      if (result.composed !== undefined) {
        assert.isTrue(result.composed);
      }
    });

    it('Event has detail set', () => {
      const result = element._dispatchBeforeRequest(request);
      assert.deepEqual(result.detail, request);
    });
  });

  describe('_beforeRequest()', () => {
    let element;
    const request = {url: 'http:domain.com', method: 'GET', id: 'test-id', promises: []};
    let copy;
    beforeEach(async () => {
      element = await basicFixture();
      copy = Object.assign({}, request);
      element._queue[copy.id] = copy;
    });

    afterEach(() => {
      if (element._queue[request.id] && element._queue[request.id]._currentTimeout) {
        clearTimeout(element._queue[request.id]._currentTimeout);
      }
      request.promises = [];
      element._queue = {};
    });

    it('Calls _dispatchBeforeRequest()', () => {
      const spy = sinon.spy(element, '_dispatchBeforeRequest');
      element._beforeRequest(copy);
      assert.isTrue(spy.called);
      assert.deepEqual(spy.args[0][0], copy);
    });

    it('Calls _reportCancelation() when event is cancelled', () => {
      const spy = sinon.spy(element, '_reportCancelation');
      element.addEventListener('before-request', function f(e) {
        element.removeEventListener('before-request', f);
        e.preventDefault();
        e.detail.reason = 'test-reason';
      });
      element._beforeRequest(copy);
      assert.isTrue(spy.called);
      assert.deepEqual(spy.args[0][0], 'test-reason');
    });

    it('Returns a promise', () => {
      element._continueRequest = () => {};
      const result = element._beforeRequest(copy);
      assert.typeOf(result.then, 'function');
      return result;
    });

    it('Sets _beforePromisesResolved to false', () => {
      element.addEventListener('before-request', function f(e) {
        element.removeEventListener('before-request', f);
        const p = Promise.resolve();
        p.timeout = 10;
        e.detail.promises.push(p);
      });
      const result = element._beforeRequest(copy);
      assert.isFalse(element._queue[copy.id]._beforePromisesResolved);
      return result;
    });

    it('Sets _currentTimeout', () => {
      element.addEventListener('before-request', function f(e) {
        element.removeEventListener('before-request', f);
        const p = Promise.resolve();
        p.timeout = 10;
        e.detail.promises.push(p);
      });
      const result = element._beforeRequest(copy);
      assert.typeOf(element._queue[copy.id]._currentTimeout, 'number');
      return result;
    });

    it('Sets _awaitingContinue', () => {
      element.addEventListener('before-request', function f(e) {
        element.removeEventListener('before-request', f);
        const p = Promise.resolve();
        p.timeout = 0;
        e.detail.promises.push(p);
      });
      const result = element._beforeRequest(copy);
      assert.isTrue(element._queue[copy.id]._awaitingContinue);
      return result;
    });

    it('Sets _beforePromisesResolved to true when ready', () => {
      element.addEventListener('before-request', function f(e) {
        element.removeEventListener('before-request', f);
        const p = Promise.resolve();
        p.timeout = 10;
        e.detail.promises.push(p);
      });
      let arg;
      element._continueRequest = (request) => arg = request;
      return element._beforeRequest(copy)
      .then(() => {
        assert.isTrue(arg._beforePromisesResolved);
      });
    });

    it('Calls _continueRequest()', () => {
      element.addEventListener('before-request', function f(e) {
        element.removeEventListener('before-request', f);
        const p = Promise.resolve();
        p.timeout = 10;
        e.detail.promises.push(p);
      });
      const spy = sinon.spy(element, '_continueRequest');
      return element._beforeRequest(copy)
      .then(() => {
        assert.isTrue(spy.called);
      });
    });

    it('Won\'t call _continueRequest() when _cancelled flag is set', () => {
      element.addEventListener('before-request', function f(e) {
        element.removeEventListener('before-request', f);
        const p = Promise.resolve();
        p.timeout = 10;
        e.detail.promises.push(p);
      });
      const spy = sinon.spy(element, '_continueRequest');
      const result = element._beforeRequest(copy);
      element._queue[request.id]._cancelled = true;
      return result
      .then(() => {
        assert.isFalse(spy.called);
      });
    });

    it('Won\'t call _continueRequest() when _beforeTimedOut flag is set', () => {
      element.addEventListener('before-request', function f(e) {
        element.removeEventListener('before-request', f);
        const p = Promise.resolve();
        p.timeout = 10;
        e.detail.promises.push(p);
      });
      const spy = sinon.spy(element, '_continueRequest');
      const result = element._beforeRequest(copy);
      element._queue[request.id]._beforeTimedOut = true;
      return result
      .then(() => {
        assert.isFalse(spy.called);
      });
    });

    it('Won\'t call _continueRequest() when _awaitingContinue flag is set', () => {
      element.addEventListener('before-request', function f(e) {
        element.removeEventListener('before-request', f);
        const p = Promise.resolve();
        p.timeout = 10;
        e.detail.promises.push(p);
      });
      const spy = sinon.spy(element, '_continueRequest');
      const result = element._beforeRequest(copy);
      element._queue[request.id]._awaitingContinue = true;
      return result
      .then(() => {
        assert.isFalse(spy.called);
      });
    });

    it('Calls _reportError() when promise error', () => {
      element.addEventListener('before-request', function f(e) {
        element.removeEventListener('before-request', f);
        const p = Promise.reject(new Error('test-error'));
        p.timeout = 10;
        e.detail.promises.push(p);
      });
      const spy = sinon.spy(element, '_reportError');
      return element._beforeRequest(copy)
      .then(() => {
        assert.isTrue(spy.called);
        assert.equal(spy.args[0][0], request.id);
        assert.typeOf(spy.args[0][1], 'error');
      });
    });

    it('Calls _onBeforeRequestTimeout() when timeout', () => {
      element.addEventListener('before-request', function f(e) {
        element.removeEventListener('before-request', f);
        const p = new Promise((resolve) => {
          setTimeout(() => resolve(), 15);
        });
        p.timeout = 5;
        e.detail.promises.push(p);
      });
      element.handlersTimeout = 1;
      const spy = sinon.spy(element, '_onBeforeRequestTimeout');
      return element._beforeRequest(copy)
      .then(() => {
        assert.isTrue(spy.called);
        assert.equal(spy.args[0][0], request.id);
      });
    });
  });

  describe('_disaptchResponse()', () => {
    let element;
    const response = 'test-detail';
    beforeEach(async () => {
      element = await basicFixture();
    });

    it('Dispatches url-history-store event', () => {
      const spy = sinon.spy();
      element.addEventListener('api-response', spy);
      element._disaptchResponse(response);
      assert.isTrue(spy.called);
    });

    it('Returns the event', () => {
      const result = element._disaptchResponse(response);
      assert.typeOf(result, 'customevent');
    });

    it('Event is not cancelable', () => {
      const result = element._disaptchResponse(response);
      assert.isFalse(result.cancelable);
    });

    it('Event is composed', () => {
      const result = element._disaptchResponse(response);
      if (result.composed !== undefined) {
        assert.isTrue(result.composed);
      }
    });

    it('Event has detail', () => {
      const result = element._disaptchResponse(response);
      assert.equal(result.detail, response);
    });
  });

  describe('_reportError()', () => {
    let element;
    const request = {url: 'http:domain.com', method: 'GET', id: 'test-id'};
    let error;
    beforeEach(async () => {
      element = await basicFixture();
      element._queue[request.id] = Object.assign({}, request);
      error = new Error('test-error');
    });

    it('Does nothing when request is not found', () => {
      element._reportError('some', error);
      assert.typeOf(element._queue[request.id], 'object');
    });

    it('Removes request from the queue', () => {
      element._reportError(request.id, error);
      assert.isUndefined(element._queue[request.id]);
    });

    it('Calls _disaptchResponse()', () => {
      const spy = sinon.spy(element, '_disaptchResponse');
      element._reportError(request.id, error);
      assert.isTrue(spy.called);
    });

    it('Event has isError set', () => {
      const spy = sinon.spy(element, '_disaptchResponse');
      element._reportError(request.id, error);
      assert.isTrue(spy.args[0][0].isError);
    });

    it('Event has error set', () => {
      const spy = sinon.spy(element, '_disaptchResponse');
      element._reportError(request.id, error);
      assert.isTrue(spy.args[0][0].error === error);
    });

    it('Event has loadingTime set', () => {
      const spy = sinon.spy(element, '_disaptchResponse');
      element._reportError(request.id, error);
      assert.equal(spy.args[0][0].loadingTime, 0);
    });

    it('Event has request set', () => {
      const spy = sinon.spy(element, '_disaptchResponse');
      element._reportError(request.id, error);
      assert.deepEqual(spy.args[0][0].request, request);
    });
  });

  describe('_computeHandlersTimeout()', function() {
    let element;
    beforeEach(async () => {
      element = await basicFixture();
    });

    it('Uses default timeout when no arguments', function() {
      const result = element._computeHandlersTimeout();
      assert.equal(result, element.handlersTimeout);
    });

    it('Returns highest time from the array of objects', function() {
      const args = [{
        'timeout': 2500
      }, {
        'timeout': 3500
      }, {
        'timeout': 2700
      }];
      const result = element._computeHandlersTimeout(args);
      assert.equal(result, args[1].timeout);
    });

    it('Returns default time for lower timeouts in argument object', function() {
      const args = [{
        'timeout': 100
      }, {
        'timeout': 200
      }, {
        'timeout': 300
      }];
      const result = element._computeHandlersTimeout(args);
      assert.equal(result, element.handlersTimeout);
    });

    it('Returns -1 when handlersTimeout is removed', function() {
      element.handlersTimeout = 0;
      const result = element._computeHandlersTimeout();
      assert.equal(result, -1);
    });

    it('Returns -1 when any of timeouts in array is 0', function() {
      assert.isAbove(element.handlersTimeout, 0);
      const args = [{
        'timeout': 100
      }, {
        'timeout': 0
      }, {
        'timeout': 300
      }];
      const result = element._computeHandlersTimeout(args);
      assert.equal(result, -1);
    });
  });

  describe('_clearBeforeRequestTimeout', function() {
    let element;
    beforeEach(async function() {
      element = await basicFixture();
      const _r = Object.assign({}, request);
      element._queue[request.id] = _r;
    });

    it('Clears the variable', function() {
      element._queue[request.id]._currentTimeout = 'test';
      element._clearBeforeRequestTimeout(request.id);
      assert.isUndefined(element._queue[request.id]._currentTimeout);
    });

    it('Do nothing when variable is empty', function() {
      element._clearBeforeRequestTimeout(request.id);
      // Basically it doesn't throws an error.
      assert.isUndefined(element._queue[request.id]._currentTimeout);
    });

    it('Clears existing timeout', function(done) {
      let errored = false;
      element._queue[request.id]._currentTimeout = window.setTimeout(function() {
        errored = true;
        done(new Error('Do not clears the timeout.'));
      }, 10);
      element._clearBeforeRequestTimeout(request.id);
      window.setTimeout(function() {
        assert.isFalse(errored);
        done();
      }, 15);
    });
  });

  describe('_continueRequestHandler()', () => {
    let element;
    beforeEach(async function() {
      element = await basicFixture();
      const _r = Object.assign({}, request);
      element._queue[request.id] = _r;
    });

    it('Does nothing when request not defined', () => {
      const spy = sinon.spy(element, 'continueRequest');
      element._continueRequestHandler({
        detail: {
          id: 'other'
        }
      });
      assert.isFalse(spy.called);
    });

    it('Calls continueRequest()', () => {
      const spy = sinon.spy(element, 'continueRequest');
      element._continueRequestHandler({
        detail: {
          id: request.id
        }
      });
      assert.isTrue(spy.called);
      assert.deepEqual(spy.args[0][0], request);
    });
  });

  describe('continueRequest()', () => {
    let element;
    let request;
    beforeEach(async function() {
      element = await basicFixture();
      request = {
        url: 'http:domain.com',
        method: 'GET',
        id: 'test-id',
        _beforePromisesResolved: true
      };
      element._queue[request.id] = request;
    });

    it('Does nothing when _awaitingContinue flag is set', () => {
      request._awaitingContinue = false;
      const spy = sinon.spy(element, '_continueRequest');
      element.continueRequest(request);
      assert.isFalse(spy.called);
    });

    it('Does nothing when _beforePromisesResolved flag is not set', () => {
      request._awaitingContinue = true;
      request._beforePromisesResolved = false;
      const spy = sinon.spy(element, '_continueRequest');
      element.continueRequest(request);
      assert.isFalse(spy.called);
    });

    it('Re-sets _awaitingContinue flag', () => {
      request._awaitingContinue = true;
      request._beforePromisesResolved = false;
      element.continueRequest(request);
      assert.isFalse(element._awaitingContinue);
    });

    it('Calls _continueRequest()', () => {
      request._awaitingContinue = true;
      request._beforePromisesResolved = true;
      const spy = sinon.spy(element, '_continueRequest');
      element.continueRequest(request);
      assert.isTrue(spy.called);
    });
  });

  describe('_continueRequest()', () => {
    let element;
    let request;
    beforeEach(async function() {
      element = await basicFixture();
      request = {
        url: 'http:domain.com',
        method: 'GET',
        id: 'test-id'
      };
      element._queue[request.id] = request;
    });

    it('Calls _clearBeforeRequestTimeout()', () => {
      const spy = sinon.spy(element, '_clearBeforeRequestTimeout');
      element._continueRequest(request);
      assert.isTrue(spy.called);
      assert.equal(spy.args[0][0], request.id);
    });

    [
      'promises', 'reason', '_beforePromisesResolved', '_awaitingContinue',
      '_beforeTimedOut', '_currentTimeout', '_cancelled'
    ].forEach((prop) => {
      it('Clears ' + prop + ' property', async () => {

        request[prop] = 'test-value';
        element._continueRequest(request);
        const e = await untilTransportRequest(element);
        assert.isUndefined(e.detail[prop]);
      });
    });
  });

  describe('_resendHandler()', () => {
    let element;
    let request;
    beforeEach(async function() {
      element = await basicFixture();
      request = {
        url: 'http:domain.com',
        method: 'GET',
        id: 'test-id'
      };
      element._queue[request.id] = request;
    });

    it('Does nothing when request not in the queue', () => {
      const spy = sinon.spy(element, 'processRequest');
      element._resendHandler({
        detail: {
          id: 'other'
        }
      });
      assert.isFalse(spy.called);
    });

    it('Calls processRequest()', () => {
      const spy = sinon.spy(element, 'processRequest');
      element._resendHandler({
        detail: {
          id: request.id
        }
      });
      assert.isTrue(spy.called);
    });
  });

  describe('_reportHandler()', () => {
    let element;
    let request;
    beforeEach(async function() {
      element = await basicFixture();
      request = {
        url: 'http:domain.com',
        method: 'GET',
        id: 'test-id'
      };
      element._queue[request.id] = request;
    });

    it('Does nothing when request not in the queue', () => {
      const spy = sinon.spy(element, '_reportResponse');
      element._reportHandler({
        detail: {
          id: 'other'
        }
      });
      assert.isFalse(spy.called);
    });

    it('Removes element from the queue', () => {
      element._reportHandler({
        detail: {
          id: request.id
        }
      }, {});
      assert.isUndefined(element._queue[request.id]);
    });

    it('Calls _reportResponse()', () => {
      const spy = sinon.spy(element, '_reportResponse');
      element._reportHandler({
        detail: {
          id: request.id
        }
      }, {});
      assert.isTrue(spy.called);
    });
  });

  describe('_reportResponse()', () => {
    let element;
    let request;
    let response;
    beforeEach(async function() {
      element = await basicFixture();
      request = {
        url: 'http:domain.com',
        method: 'GET',
        id: 'test-id'
      };
      response = {
        request: {
          url: 'http:domain.com',
          method: 'GET'
        },
        response: {
          status: 200,
          statusText: 'OK',
          url: 'http:domain.com/',
          header: 'content-type: none',
          payload: '{}'
        }
      };
      element._queue[request.id] = request;
    });

    it('Resolves promise when no response actions', () => {
      const result = element._reportResponse(request, response);
      assert.typeOf(result.then, 'function');
    });

    it('Calls _processResponseActions() when has actions', () => {
      request.responseActions = [{}];
      const spy = sinon.spy(element, '_processResponseActions');
      return element._reportResponse(request, response)
      .then(() => {
        assert.isTrue(spy.called, 'Function is called');
        assert.deepEqual(spy.args[0][0], request.responseActions, 'actions argument is set');
        assert.deepEqual(spy.args[0][1], response.request, 'request argument is set');
        assert.deepEqual(spy.args[0][2], response.response, 'response argument is set');
      });
    });
  });

  describe('_processResponseActions()', () => {
    let element;
    let request;
    let response;
    let actions;
    beforeEach(async function() {
      element = await basicFixture();
      request = {
        url: 'http:domain.com',
        method: 'GET'
      };
      response = {
        status: 200,
        statusText: 'OK',
        url: 'http:domain.com/',
        header: 'content-type: none',
        payload: '{}'
      };
      actions = [{}];
    });

    it('Dispatches "run-response-actions" event', () => {
      const spy = sinon.spy();
      element.addEventListener('run-response-actions', spy);
      element._processResponseActions(actions, request, response);
      assert.isTrue(spy.called, 'Event is dispatched');
      const {detail} = spy.args[0][0];
      assert.deepEqual(detail.actions, actions, 'actions is set');
      assert.deepEqual(detail.request, request, 'request is set');
      assert.deepEqual(detail.response, response, 'response is set');
    });

    it('Returns result of the event', () => {
      element.addEventListener('run-response-actions', function f(e) {
        element.removeEventListener('run-response-actions', f);
        e.preventDefault();
        e.detail.result = Promise.resolve('test');
      });
      return element._processResponseActions(actions, request, response)
      .then((result) => {
        assert.equal(result, 'test');
      });
    });
  });

  describe('_prepareTransportObject()', function() {
    let element;
    const orig = {
      a: 'v1',
      b: 'v2',
      c: 'v3',
      id: 1
    };

    beforeEach(async function() {
      element = await basicFixture();
    });

    it('Creates copy of the object', function() {
      const result = element._prepareTransportObject(Object.assign({}, orig));
      assert.deepEqual(result, orig);
    });

    it('Values are immutable', function() {
      const result = element._prepareTransportObject(Object.assign({}, orig));
      try {
        result.a = 'a1';
        result.b = 'a2';
        result.c = 'a3';
      } catch (_) {
        assert.isTrue(true, 'stupid linter');
      }
      assert.equal(result.a, orig.a);
      assert.equal(result.b, orig.b);
      assert.equal(result.c, orig.c);
      assert.notEqual(result.a, 'a1');
      assert.notEqual(result.b, 'a2');
      assert.notEqual(result.c, 'a3');
    });
  });

  describe('Before request event', () => {
    let element;
    beforeEach(async function() {
      element = await basicFixture();
    });
    const contextFactory = function(e) {
      e.preventDefault();
      e.detail.variables = [{
        variable: 'test1',
        value: 'value1',
        enabled: true
      }, {
        variable: 'test2',
        value: 'value2 ${test1}',
        enabled: true
      }, {
        variable: 'test3',
        value: 'value3 ${test4}',
        enabled: true
      }, {
        variable: 'test4',
        value: 'value4',
        enabled: true
      }, {
        variable: 'test5',
        value: 'value5',
        enabled: false
      }];
    };

    before(function() {
      window.addEventListener('environment-current', contextFactory);
    });

    after(function() {
      window.removeEventListener('environment-current', contextFactory);
    });

    it('Dispatches before-request custom event', (done) => {
      element.addEventListener('before-request', () => {
        done();
      });
      element.processRequest(request);
    });

    it('before-request has evaluated variables', (done) => {
      element.addEventListener('before-request', (e) => {
        assert.equal(e.detail.url, 'https://domain.com/value1', 'URL is set');
        assert.equal(e.detail.headers,
          'content-length: 0\nx-test: true\nx-var: value2 value1', 'Headers are set');
        assert.equal(e.detail.payload, 'value1', 'Payload is set');
        done();
      });
      element.processRequest(request);
    });

    it('before-request event is cancelable', (done) => {
      element.addEventListener('before-request', (e) => {
        assert.isTrue(e.cancelable);
        done();
      });
      element.processRequest(request);
    });

    it('Dispatches transport-request event', (done) => {
      element.addEventListener('transport-request', () => {
        done();
      });
      element.processRequest(request);
    });
  });

  describe('Full request flow', () => {
    describe('Without middleware', () => {
      before(() => {
        document.querySelector('demo-transport').enabled = true;
      });

      after(() => {
        document.querySelector('demo-transport').enabled = false;
      });

      let element;
      let requests;
      beforeEach(async function() {
        element = await basicFixture();
        requests = [{
          id: 'r1',
          url: location.href,
          method: 'GET',
          headers: 'x-test: true'
        }, {
          id: 'r2',
          url: 'http://domain',
          method: 'POST',
          headers: 'x-test: true',
          payload: 'test'
        }];
      });

      it('Runs the flow from the event', (done) => {
        element.addEventListener('api-response', function f(e) {
          element.removeEventListener('api-response', f);
          assert.isFalse(e.cancelable, 'Event is not cancelable');
          const detail = e.detail;
          assert.equal(detail.id, 'r1');
          assert.typeOf(detail.request, 'object');
          assert.typeOf(detail.response, 'object');
          assert.typeOf(detail.loadingTime, 'number');
          assert.typeOf(detail.isXhr, 'boolean');
          done();
        });

        document.body.dispatchEvent(new CustomEvent('api-request', {
          bubbles: true,
          cancelable: true,
          detail: requests[0]
        }));
      });

      it('Runs the flow from function call', (done) => {
        element.addEventListener('api-response', function f(e) {
          element.removeEventListener('api-response', f);
          assert.isFalse(e.cancelable, 'Event is not cancelable');
          const detail = e.detail;
          assert.equal(detail.id, 'r1');
          assert.typeOf(detail.request, 'object');
          assert.typeOf(detail.response, 'object');
          assert.typeOf(detail.loadingTime, 'number');
          assert.typeOf(detail.isXhr, 'boolean');
          done();
        });
        element.processRequest(Object.assign({}, requests[0]));
      });

      it('Runs the flow when response error', (done) => {
        element.addEventListener('api-response', function f(e) {
          element.removeEventListener('api-response', f);
          assert.isFalse(e.cancelable, 'Event is not cancelable');
          const detail = e.detail;
          assert.equal(detail.id, 'r2');
          assert.equal(detail.isError, true);
          assert.typeOf(detail.request, 'object');
          assert.isUndefined(detail.response);
          assert.typeOf(detail.loadingTime, 'number');
          assert.typeOf(detail.isXhr, 'boolean');
          done();
        });
        element.processRequest(requests[1]);
      });
    });
  });

  describe('Authorization data processing', () => {
    describe('Basic authorization', () => {
      let request;
      let element;
      beforeEach(async () => {
        element = await varsDisabledFixture();
        request = {
          url: 'https://api.domain.com',
          method: 'GET',
          auth: {
            username: 'uname',
            password: 'passwd',
          },
          authType: 'basic'
        };
      });

      it('adds authorization header to non existing headers', async () => {
        const spy = sinon.spy();
        element.addEventListener('transport-request', spy);
        await element.processRequest(request);
        const eventRequest = spy.args[0][0].detail;
        assert.equal(eventRequest.headers, 'authorization: Basic dW5hbWU6cGFzc3dk');
      });

      it('adds authorization header to existing headers', async () => {
        request.headers = 'accept: */*';
        const spy = sinon.spy();
        element.addEventListener('transport-request', spy);
        await element.processRequest(request);
        const eventRequest = spy.args[0][0].detail;
        assert.equal(eventRequest.headers, 'accept: */*\nauthorization: Basic dW5hbWU6cGFzc3dk');
      });

      it('replaces existing authorization header', async () => {
        request.headers = 'authorization: test';
        const spy = sinon.spy();
        element.addEventListener('transport-request', spy);
        await element.processRequest(request);
        const eventRequest = spy.args[0][0].detail;
        assert.equal(eventRequest.headers, 'authorization: Basic dW5hbWU6cGFzc3dk');
      });
    });

    describe('OAuth 2', () => {
      let request;
      let element;
      beforeEach(async () => {
        element = await varsDisabledFixture();
        request = {
          url: 'https://api.domain.com',
          method: 'GET',
          auth: {
            tokenType: 'Bearer-test',
            deliveryMethod: 'header',
            deliveryName: 'authorization-test',
            accessToken: 'test-token'
          },
          authType: 'oauth 2'
        };
      });

      it('adds authorization header to non existing headers', async () => {
        const spy = sinon.spy();
        element.addEventListener('transport-request', spy);
        await element.processRequest(request);
        const eventRequest = spy.args[0][0].detail;
        assert.equal(eventRequest.headers, 'authorization-test: Bearer-test test-token');
      });

      it('adds authorization header to existing headers', async () => {
        request.headers = 'accept: */*';
        const spy = sinon.spy();
        element.addEventListener('transport-request', spy);
        await element.processRequest(request);
        const eventRequest = spy.args[0][0].detail;
        assert.equal(eventRequest.headers, 'accept: */*\nauthorization-test: Bearer-test test-token');
      });

      it('replaces existing authorization header', async () => {
        request.headers = 'authorization-test: test';
        const spy = sinon.spy();
        element.addEventListener('transport-request', spy);
        await element.processRequest(request);
        const eventRequest = spy.args[0][0].detail;
        assert.equal(eventRequest.headers, 'authorization-test: Bearer-test test-token');
      });

      it('uses default tokenType', async () => {
        delete request.auth.tokenType;
        const spy = sinon.spy();
        element.addEventListener('transport-request', spy);
        await element.processRequest(request);
        const eventRequest = spy.args[0][0].detail;
        assert.equal(eventRequest.headers, 'authorization-test: Bearer test-token');
      });

      it('uses default deliveryName', async () => {
        delete request.auth.deliveryName;
        const spy = sinon.spy();
        element.addEventListener('transport-request', spy);
        await element.processRequest(request);
        const eventRequest = spy.args[0][0].detail;
        assert.equal(eventRequest.headers, 'authorization: Bearer-test test-token');
      });

      it('ignores for unsupported deliveryMethod', async () => {
        request.auth.deliveryMethod = 'params';
        const spy = sinon.spy();
        element.addEventListener('transport-request', spy);
        await element.processRequest(request);
        const eventRequest = spy.args[0][0].detail;
        assert.isUndefined(eventRequest.headers);
      });
    });

    describe('Client certificate', () => {
      let certs;
      before(async () => {
        certs = await DataGenerator.insertCertificatesData({});
      });

      after(async () => {
        await DataGenerator.destroyClientCertificates();
      });

      let request;
      beforeEach(async () => {
        request = {
          url: 'https://api.domain.com',
          method: 'GET',
          auth: {
            id: certs[0]._id
          },
          authType: 'client certificate'
        };
      });

      it('ignores when model is not in the DOM', async () => {
        const element = await varsDisabledFixture();
        element.processRequest(request);
        const e = await untilTransportRequest(element);
        const eventRequest = e.detail;
        assert.isUndefined(eventRequest.headers);
      });

      it('ignores when unknown certificate ID', async () => {
        const element = await varsDisabledFixture();
        request.auth.id = 'unknown';
        element.processRequest(request);
        const e = await untilTransportRequest(element);
        const eventRequest = e.detail;
        assert.isUndefined(eventRequest.headers);
      });

      it('adds certificate to the configuration', async () => {
        const element = await certificatesFixture();
        element.processRequest(request);
        const e = await untilTransportRequest(element);
        const eventRequest = e.detail;
        const cert = eventRequest.clientCertificate;
        assert.typeOf(cert, 'object', 'has certificate configuration');
        assert.equal(cert.type, certs[0].type, 'has type');
        assert.typeOf(cert.cert, 'array', 'has cert');
        assert.typeOf(cert.key, 'array', 'has key');
      });
    });
  });
});
