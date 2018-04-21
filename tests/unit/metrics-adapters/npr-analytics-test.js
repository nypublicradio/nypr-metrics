import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';

module('npr-analytics adapter', function(hooks) {
  setupTest(hooks);

  const NPR_KEY = '1234567890';

  test('it inits itself against the window.ga object', function(assert) {
    window.ga = function(command, key) {
      assert.equal(command, 'create');
      assert.equal(key, NPR_KEY);
    };
    let adapter = this.owner.factoryFor('metrics-adapter:npr-analytics').create({config: {id: NPR_KEY}});
    assert.ok(adapter);
  });

  test('it fails gracefully if window.ga does not exist', function(assert) {
    delete window.ga;
    let adapter = this.owner.factoryFor('metrics-adapter:npr-analytics').create({config: {id: NPR_KEY}});
    assert.ok(adapter);
  });

  test('it fires the correct pageview event', function(assert) {
    let adapter = this.owner.factoryFor('metrics-adapter:npr-analytics').create({config: {id: NPR_KEY}});
    window.ga = function(command, {hitType}) {
      if (command === 'npr.send') {
        assert.equal(command, 'npr.send', 'should prefix send with npr label');
        assert.equal(hitType, 'pageview', 'should send an npr pageview');
      }
    };
    adapter.trackPage({ page: '/foo', title: 'foo' });
  });

  test('it fires the correct trackEvent event', function(assert) {
    let adapter = this.owner.factoryFor('metrics-adapter:npr-analytics').create({config: {id: NPR_KEY}});
    window.ga = function(command, hitType) {
      if (command === 'npr.send') {
        assert.equal(command, 'npr.send', 'should prefix send with npr label');
        assert.equal(hitType, 'event', 'should send an npr event');
      }
    };
    adapter.trackEvent({ category: 'foo', action: 'bar', label: 'baz' });
  });
});
