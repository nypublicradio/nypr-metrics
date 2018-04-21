import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import sinon from 'sinon';
import config from 'ember-get-config';

module('Unit | Service | data pipeline', function(hooks) {
  setupTest(hooks);

  // Replace this with your real tests.
  test('it exists', function(assert) {
    let service = this.owner.lookup('service:data-pipeline');
    assert.ok(service);
  });

  test('it reports the proper data for an item view', function(assert) {
    let testData = {cms_id: 1, item_type: 'story'};
    let expected = Object.assign({
      browser_id: 'secrets',
      client: config.clientSlug,
      external_referrer: document.referrer,
      referrer: null,
      url: location.toString(),
      site_id: config.siteId
    }, testData);

    let service = this.owner.factoryFor('service:data-pipeline').create({
      browserId: 'secrets',
      authorize(fetchOptions) {
        fetchOptions['client'] = 'wnyc_web'; // fake authentication from client
        return fetchOptions;
      },
      _send(data) {
        assert.deepEqual(data, expected, 'passes in correct data to send');
      },
      _legacySend() {}
    });

    service.reportItemView(testData);
  });

  test('it reports the proper data for on demand listen actions', function(assert) {
    let clock = sinon.useFakeTimers();
    let expected = {
      audio_type: 'on_demand',
      browser_id: 'secrets',
      client: config.clientSlug,
      cms_id: 1,
      current_audio_position: 0,
      delta: 0,
      external_referrer: document.referrer,
      item_type: 'story',
      referrer: null,
      site_id: config.siteId,
      url: location.toString()
    };
    let testData = {cms_id: 1, item_type: 'story'};

    let service = this.owner.factoryFor('service:data-pipeline').create({
      browserId: 'secrets',
      authorize(fetchOptions) {
        fetchOptions['client'] = 'wnyc_web'; // fake authentication from client
      },
      _legacySend() {}
    });

    service._send = function(data) {
      let thisData = Object.assign({action: 'start'}, expected);
      assert.deepEqual(data, thisData, 'sendStart passes in correct data');
    };
    service.reportListenAction('start', Object.assign({audio_type: 'on_demand', current_audio_position: 0}, testData));

    service._send = function(data) {
      let thisData = Object.assign({action: 'pause'}, expected);
      assert.deepEqual(data, thisData, 'sendPause passes in correct data');
    };
    service.reportListenAction('pause', Object.assign({audio_type: 'on_demand', current_audio_position: 0}, testData));

    service._send = function(data) {
      let thisData = Object.assign({action: 'resume'}, expected);
      assert.deepEqual( data, thisData, 'sendResume passes in correct data');
    };
    service.reportListenAction('resume', Object.assign({audio_type: 'on_demand', current_audio_position: 0}, testData));

    service._send = function(data) {
      let thisData = Object.assign({action: 'skip_15_forward'}, expected);
      assert.deepEqual(data, thisData, 'sendSkipForward passes in correct data');
    };
    service.reportListenAction('forward_15', Object.assign({audio_type: 'on_demand', current_audio_position: 0}, testData));

    service._send = function(data) {
      let thisData = Object.assign({action: 'skip_15_back'}, expected);
      assert.deepEqual(data, thisData, 'sendSkipBackward passes in correct data');
    };
    service.reportListenAction('back_15', Object.assign({audio_type: 'on_demand', current_audio_position: 0}, testData));

    service._send = function(data) {
      let thisData = Object.assign({action: 'window_close'}, expected);
      assert.deepEqual(data, thisData, 'sendWindowClose passes in correct data');
    };
    service.reportListenAction('close', Object.assign({audio_type: 'on_demand', current_audio_position: 0}, testData));

    service._send = function(data) {
      let thisData = Object.assign({action: 'finish'}, expected);
      assert.deepEqual(data, thisData, 'sendFinish passes in correct data');
    };
    service.reportListenAction('finish', Object.assign({audio_type: 'on_demand', current_audio_position: 0}, testData));

    service._send = function(data) {
      let thisData = Object.assign({action: 'set_position'}, expected);
      assert.deepEqual(data, thisData, 'sendSetPosition passes in correct data');
    };
    service.reportListenAction('position', Object.assign({audio_type: 'on_demand', current_audio_position: 0}, testData));

    clock.restore();
  });

  test('data pipeline tracks delta properly', function(assert) {
    assert.expect(6);

    let currentCall = 0;
    let now = Date.now();
    let clock = sinon.useFakeTimers(now);
    let deltaShouldbe = 500;
    let service = this.owner.factoryFor('service:data-pipeline').create({
      browserId: 'secrets',
      _send({delta}) {
        switch(currentCall) {
          case 1:
            // start
            assert.equal(delta, 0, 'delta should be 0 on start and resumes');
            break;
          case 2:
            // pause
            assert.equal(delta, deltaShouldbe, 'delta should be updated as time ticks');
            break;
          case 3:
            // position
            assert.equal(delta, 0, 'delta should be 0 if not playing');
            break;
          case 4:
            // resume
            assert.equal(delta, 0, 'delta should be 0 on start and resumes');
            break;
          case 5:
            // postion
            assert.equal(delta, deltaShouldbe, 'delta should be updated as time ticks');
            break;
          case 6:
            // interrupt
            assert.equal(delta, deltaShouldbe, 'delta should be updated as time ticks');
            break;
        }
      },
      _legacySend() {}
    });
    currentCall++;
    service.reportListenAction('start');

    clock.tick(deltaShouldbe);

    currentCall++;
    service.reportListenAction('pause');

    currentCall++;
    service.reportListenAction('position');

    clock.tick(1000);
    currentCall++;
    service.reportListenAction('resume');

    clock.tick(deltaShouldbe);
    currentCall++;
    service.reportListenAction('position');

    deltaShouldbe *= 2;
    clock.tick(deltaShouldbe);
    currentCall++;
    service.reportListenAction('interrupt');

    clock.restore();
  });
});
