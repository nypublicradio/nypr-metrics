import Ember from 'ember';
import { moduleFor, test } from 'ember-qunit';
import sinon from 'sinon';
import hifiNeeds from 'dummy/tests/helpers/hifi-needs';
import { dummyHifi } from 'dummy/tests/helpers/hifi-integration-helpers';

moduleFor('service:listen-analytics', 'Unit | Service | listen analytics', {
  needs: [...hifiNeeds],
  beforeEach() {
    this.register('service:hifi', dummyHifi);
    this.inject.service('hifi');

    let pipeline = Ember.Service.extend({
      reportListenAction: function() {}
    });

    let metrics = Ember.Service.extend({
      trackEvent: function() {}
    });

    this.register('service:data-pipeline', pipeline);
    this.inject.service('dataPipeline', pipeline);

    this.register('service:metrics', metrics);
    this.inject.service('metrics', metrics);

  },
  afterEach() {
  }
});

test("it sets up the player ping", function(assert) {
  let counter = 0;
  this.clock = sinon.useFakeTimers();

  this.subject({
    poll: {
      addPoll({label}) {
        counter++;
        assert.equal(label, 'playerPing', 'the correct poll was added');
      }
    }
  });

  this.clock.tick(200000);
  assert.equal(counter, 1, 'service should only call addPoll once');
  this.clock.restore();
});

test('it calls _onAudioPlayed when audio is played', function(assert) {
  let interceptor = {
    listenForTrackChanges: function() {},
    _onAudioEnded: function() {},
    _onAudioPlayed: function() {},
    _onAudioPaused: function() {},
  }

  let spy = sinon.stub(interceptor, '_onAudioPlayed');

  let service = this.subject(interceptor);
  let hifi = service.get('hifi');

  hifi.trigger('audio-played', {});
  hifi.trigger('audio-played', {});

  assert.equal(spy.callCount, 2);
});

test('it calls _onAudioPaused when audio is paused', function(assert) {
  let interceptor = {
    listenForTrackChanges: function() {},
    _onAudioEnded: function() {},
    _onAudioPlayed: function() {},
    _onAudioPaused: function() {},
  }

  let spy = sinon.stub(interceptor, '_onAudioPaused');

  let service = this.subject(interceptor);
  let hifi = service.get('hifi');

  hifi.trigger('audio-paused', {});
  hifi.trigger('audio-paused', {});

  assert.equal(spy.callCount, 2);
});

test('it calls _onAudioEnded when audio is ended', function(assert) {
  let interceptor = {
    listenForTrackChanges: function() {},
    _onAudioEnded: function() {},
    _onAudioPlayed: function() {},
    _onAudioPaused: function() {},
  }

  let spy = sinon.stub(interceptor, '_onAudioEnded');
  let service = this.subject(interceptor);
  let hifi = service.get('hifi');

  hifi.trigger('audio-ended', {});
  hifi.trigger('audio-ended', {});

  assert.equal(spy.callCount, 2);
});

test('it calls _onDemandInterrupted when audio is interrupted', function(assert) {
  let interceptor = {
    _onDemandInterrupted: function() {}
  }

  let interruptSpy = sinon.stub(interceptor, '_onDemandInterrupted');
  let service = this.subject(interceptor);
  let hifi = service.get('hifi');

  let metadata1 = {
    contentModelType: 'story',
    contentId: 1,
    contentModel: {}
  }

  let metadata2 = {
    contentModelType: 'story',
    contentId: 2,
    contentModel: {}
  }

  hifi.play('/good/15000/test1.mp3', {metadata1}).then(() => {
    hifi.play('/good/12000/test2.mp3', {metadata2}).then(() => {
      assert.equal(interruptSpy.callCount, 1, "on demand interrupted should have been called")
    });
  });
});

test('it does not call _onDemandInterrupted when audio is paused beforehand', function(assert) {
  let interceptor = {
    _onDemandInterrupted: function() {}
  }

  let interruptSpy = sinon.stub(interceptor, '_onDemandInterrupted');
  let service = this.subject(interceptor);
  let hifi = service.get('hifi');

  let metadata1 = {
    contentModelType: 'story',
    contentId: 1,
    contentModel: {}
  }

  let metadata2 = {
    contentModelType: 'story',
    contentId: 2,
    contentModel: {}
  }

  hifi.play('/good/15000/test1.mp3', {metadata1}).then(({sound}) => {
    sound.pause();
    hifi.play('/good/12000/test2.mp3', {metadata2}).then(() => {
      assert.equal(interruptSpy.callCount, 0, "on demand interrupted should not have been called")
    });
  });
});

test('it calls _onStreamSwitch when audio is switched from one stream to another', function(assert) {
  let service = this.subject({});
  let spy = sinon.stub(service, '_onStreamSwitch');
  let hifi = service.get('hifi');

  let EventedObject = Ember.Object.extend(Ember.Evented);

  let stream1 = EventedObject.create({
    name: 'stream 1',
    metadata: {
      contentModel: {
        forListenAction: function(){
          return Ember.RSVP.Promise.resolve({});
        }
      },
      contentModelType: 'stream',
      contentId: 1
    }
  });

  let stream2 = EventedObject.create({
    name: 'stream 2',
    metadata: {
      contentModel: {
        forListenAction: function(){
          return Ember.RSVP.Promise.resolve({});
        }
      },
      contentModelType: 'stream',
      contentId: 2
    }
  });

  let story = EventedObject.create({
    metadata: {
      contentModel: {
        forListenAction: function(){
          return Ember.RSVP.Promise.resolve({});
        }
      },
      contentModelType: 'story',
      contentId: 3
    }
  });

  hifi.trigger('current-sound-changed', story);
  assert.equal(spy.callCount, 0, "should not trigger when playing first story");

  hifi.trigger('current-sound-changed', stream1, story);
  assert.equal(spy.callCount, 0, "should not trigger when switching from story to stream");

  hifi.trigger('current-sound-changed', stream1, stream1);
  assert.equal(spy.callCount, 0, "should not trigger when switching from the same stream to stream");

  hifi.trigger('current-sound-changed', stream2, stream1);
  assert.equal(spy.callCount, 1, "should trigger when switching from stream to stream");
});
