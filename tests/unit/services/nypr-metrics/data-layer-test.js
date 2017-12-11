import { moduleFor } from 'ember-qunit';
import test from 'ember-sinon-qunit/test-support/test';

moduleFor('service:nypr-metrics/data-layer', 'Unit | Service | nypr metrics/data layer', {
  beforeEach() {
    window.dataLayer = [];
  }
});

// Replace this with your real tests.
test('it exists', function(assert) {
  let service = this.subject();
  assert.ok(service);
});

test('it sets the expected dataLayer values for a story', function() {
  const story = {
    appearances: {
      authors: [{ name: 'Foo Bar' }, { name: 'Fuzz Buzz'} ]
    },
    newsdate: '2017-01-01',
    showTitle: 'Baz Buz',
    title: 'Bing Bang'
  };
  
  this.mock(window.dataLayer).expects('push').once().withArgs({
    'Authors': 'Foo Bar, Fuzz Buzz',
    'Date Published': story.newsdate,
    'Show Name': story.showTitle,
    'Story Title': story.title
  });
  
  let service = this.subject();
  service.setForType('story', story);
});

test('it clears the expected dataLayer values for a story', function() {
  this.mock(window.dataLayer).expects('push').once().withArgs({
    'Authors': null,
    'Date Published': null,
    'Show Name': null,
    'Story Title': null,
  });
  
  let service = this.subject();
  service.clearForType('story');
});

test('it sets the expected dataLayer values for a show', function() {
  const show = {
    title: 'Foo Show'
  };
  
  this.mock(window.dataLayer).expects('push').once().withArgs({
    'Show Name': show.title,
  });
  
  let service = this.subject();
  service.setForType('show', show);
});

test('it clears the expected dataLayer values for a show', function() {
  this.mock(window.dataLayer).expects('push').once().withArgs({
    'Show Name': null,
  });
  
  let service = this.subject();
  service.clearForType('show');
});

test('it sets the expected dataLayer value for logged in states', function(assert) {
  let spy = this.spy(window.dataLayer, 'push');
  
  let service = this.subject();
  service.setLoggedIn(true);
  service.setLoggedIn(false);
  
  assert.ok(spy.firstCall.calledWith({ 'Logged In': true }));
  assert.ok(spy.secondCall.calledWith({ 'Logged In': false }));
  
  service.setLoggedIn('something else');
  assert.equal(spy.callCount, 2, 'invalid arguments are not pushed into the dataLayer');
});

test('it sets the exepcted dataLayer value for member status', function(assert) {
  let spy = this.spy(window.dataLayer, 'push');
  
  let service = this.subject();
  service.setMemberStatus('Nonmember');
  service.setMemberStatus('One-Time Donor');
  service.setMemberStatus('Sustainer');
  
  assert.ok(spy.firstCall.calledWith({ 'Member Status': 'Nonmember' }));
  assert.ok(spy.secondCall.calledWith({ 'Member Status': 'One-Time Donor' }));
  assert.ok(spy.thirdCall.calledWith({ 'Member Status': 'Sustainer' }));
  
  service.setMemberStatus('something else');
  assert.equal(spy.callCount, 3, 'invalid arguments are not pushed into the dataLayer');
});

test('it sets the exepcted dataLayer value for page title', function(assert) {
  let spy = this.spy(window.dataLayer, 'push');
  
  let service = this.subject();
  service.setPageTitle('Foo Title');
  
  assert.ok(spy.firstCall.calledWith({ 'Page Title': 'Foo Title' }));
});

test('it pushes the expected values into the dataLayer for audio events', function(assert) {
  const onDemandSound = {
    metadata: {
      contentModelType: 'story',
      contentModel: {
        showTitle: 'Foo Show',
        title: 'Foo Title'
      }
    }
  };
  
  const streamSound = {
    metadata: {
      contentModelType: 'stream',
      contentModel: {}
    }
  };
  
  let spy = this.spy(window.dataLayer, 'push');
  
  let service = this.subject();
  service.audioTracking('play', onDemandSound);
  service.audioTracking('play', streamSound);
  
  service.audioTracking('pause', onDemandSound);
  service.audioTracking('pause', streamSound);
  
  service.audioTracking('end', onDemandSound);
  
  let calls = spy.getCalls();
  
  assert.ok(calls[0].calledWith({
    event: 'On Demand Audio Playback',
    'Playback State': 'play',
    'Audio Story Title': onDemandSound.metadata.contentModel.title,
    'Audio Show Title': onDemandSound.metadata.contentModel.showTitle
  }));
  
  assert.ok(calls[1].calledWith({
    event: 'Livestream Audio Playback',
    'Playback State': 'play'
  }));
  
  assert.ok(calls[2].calledWith({
    event: 'On Demand Audio Playback',
    'Playback State': 'pause',
    'Audio Story Title': onDemandSound.metadata.contentModel.title,
    'Audio Show Title': onDemandSound.metadata.contentModel.showTitle
  }));
  
  assert.ok(calls[3].calledWith({
    event: 'Livestream Audio Playback',
    'Playback State': 'pause'
  }));
  
  assert.ok(calls[4].calledWith({
    event: 'On Demand Audio Playback',
    'Playback State': 'end',
    'Audio Story Title': onDemandSound.metadata.contentModel.title,
    'Audio Show Title': onDemandSound.metadata.contentModel.showTitle
  }));
});

test('it sets the expected arbitrary values on the dataLayer', function(assert) {
  let stub = this.stub(window.dataLayer, 'push');
  
  let service = this.subject();
  service.push('Foo Data Key', 'Foo Data Value');
  service.push({'Key as an Object': 'Value as an object', 'For Adding': 'Multiple Values'});
  service.clear('Foo Data Key');
  service.clear('Foo', 'Bar', 'Baz');
  
  assert.ok(stub.getCall(0).calledWith({'Foo Data Key': 'Foo Data Value'}), 'can set with a string key/value pair');
  assert.ok(stub.getCall(1).calledWith({'Key as an Object': 'Value as an object', 'For Adding': 'Multiple Values'}), 'can set with an object');
  assert.ok(stub.getCall(2).calledWith({'Foo Data Key': null}), 'can clear a single key');
  assert.ok(stub.getCall(3).calledWith({'Foo': null, 'Bar': null, 'Baz': null}), 'can clear multiple keys');
});
