import { module } from 'qunit';
import { setupTest } from 'ember-qunit';
import test from 'ember-sinon-qunit/test-support/test';

module('Unit | Service | nypr metrics/data layer', function(hooks) {
  setupTest(hooks);

  hooks.beforeEach(function() {
    window.dataLayer = [];
  });

  // Replace this with your real tests.
  test('it exists', function(assert) {
    let service = this.owner.lookup('service:nypr-metrics/data-layer');
    assert.ok(service);
  });

  test('it sets the expected dataLayer values for a story', function() {
    const story = {
      appearances: {
        authors: [{ name: 'Foo Bar' }, { name: 'Fuzz Buzz'} ]
      },
      newsdate: '2017-01-01',
      showTitle: 'Baz Buz',
      show: 'baz-buz',
      title: 'Bing Bang',
      template: 'default',
      nprAnalyticsDimensions: [...new Array(4),'news', ...new Array(2), '1', null, true, null, null, 150, '5'],
      itemType: 'episode',
      cmsPK: 500,
      tags: ['politics', 'entertainment'],
      series: [{title: 'Boo Series'}, {title: 'Baz'}]
    };

    this.mock(window.dataLayer).expects('push').once().withArgs({
      'Viewed Authors': 'Foo Bar, Fuzz Buzz',
      'Viewed Date Published': story.newsdate,
      'Viewed Show Title': story.showTitle,
      'Viewed Container Slug': story.show,
      'Viewed Story Title': story.title,
      'Viewed Story Template': 'default',
      'Viewed Story Series': 'Boo Series, Baz',
      'Viewed Item Type': 'episode',
      'Viewed ID': '500',
      'Viewed Story Major Tags': 'news',
      'Viewed Story Tags': 'politics,entertainment',
      'Viewed Org ID': '1',
      'Viewed Has Audio': true,
      'Viewed Story Word Count': 150,
      'Viewed NPR ID': '5'
    });

    let service = this.owner.lookup('service:nypr-metrics/data-layer');
    service.setForType('story', story);
  });

  test('it clears the expected dataLayer values for a story', function() {
    this.mock(window.dataLayer).expects('push').once().withArgs({
      'Viewed Authors': null,
      'Viewed Date Published': null,
      'Viewed Show Title': null,
      'Viewed Container Slug': null,
      'Viewed Story Title': null,
      'Viewed Story Template': null,
      'Viewed Story Series': null,
      'Viewed Item Type': null,
      'Viewed ID': null,
      'Viewed Story Major Tags': null,
      'Viewed Story Tags': null,
      'Viewed Org ID': null,
      'Viewed Has Audio': null,
      'Viewed Story Word Count': null,
      'Viewed NPR ID': null,
    });

    let service = this.owner.lookup('service:nypr-metrics/data-layer');
    service.clearForType('story');
  });

  test('it sets the expected dataLayer values for a show', function() {
    const show = {
      title: 'Foo Show',
      slug: 'fooshow',
      itemType: 'show',
      cmsPK: 100,
    };

    this.mock(window.dataLayer).expects('push').once().withArgs({
      'Viewed Show Title': show.title,
      'Viewed Container Slug': show.slug,
      'Viewed Item Type': 'show',
      'Viewed ID': '100',
      'Viewed Story Major Tags': 'none',
      'Viewed Story Tags': 'none',
      'Viewed Org ID': '0',
      'Viewed Has Audio': '0',
      'Viewed Story Word Count': 'none',
      'Viewed NPR ID': 'none',
    });

    let service = this.owner.lookup('service:nypr-metrics/data-layer');
    service.setForType('show', show);
  });

  test('it clears the expected dataLayer values for a show', function() {
    this.mock(window.dataLayer).expects('push').once().withArgs({
      'Viewed Show Title': null,
      'Viewed Container Slug': null,
      'Viewed Item Type': null,
      'Viewed ID': null,
      'Viewed Org ID': null,
      'Viewed Has Audio': null,
      'Viewed NPR ID': null,
      'Viewed Article Channel Title': null,
      'Viewed Series Title': null,
      'Viewed Story Major Tags': null,
      'Viewed Story Tags': null,
      'Viewed Story Word Count': null,
      'Viewed Tag Title': null,
    });

    let service = this.owner.lookup('service:nypr-metrics/data-layer');
    service.clearForType('show');
  });

  test('it sets the expected dataLayer value for logged in states', function(assert) {
    let spy = this.spy(window.dataLayer, 'push');

    let service = this.owner.lookup('service:nypr-metrics/data-layer');
    service.setLoggedIn(true);
    service.setLoggedIn(false);

    assert.ok(spy.firstCall.calledWith({ 'Logged In': 'true' }));
    assert.ok(spy.secondCall.calledWith({ 'Logged In': 'false' }));

    service.setLoggedIn('something else');
    assert.equal(spy.callCount, 2, 'invalid arguments are not pushed into the dataLayer');
  });

  test('it sets the exepcted dataLayer value for member status', function(assert) {
    let spy = this.spy(window.dataLayer, 'push');

    let service = this.owner.lookup('service:nypr-metrics/data-layer');
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

    let service = this.owner.lookup('service:nypr-metrics/data-layer');
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
      },
      url: 'http://ondemand.mp3'
    };

    const streamSound = {
      metadata: {
        contentModelType: 'stream',
        contentModel: {
          name: 'Stream Name',
          currentShow: {
            episodeTitle: 'Foo Episode',
            showTitle: 'Bar Show',
          }
        },
      },
      url: 'http://livestream.aac'
    };

    let spy = this.spy(window.dataLayer, 'push');

    let service = this.owner.lookup('service:nypr-metrics/data-layer');
    service.audioTracking('play', onDemandSound);
    service.audioTracking('play', streamSound);

    service.audioTracking('pause', onDemandSound);
    service.audioTracking('pause', streamSound);

    service.audioTracking('end', onDemandSound);

    let calls = spy.getCalls();

    assert.ok(calls[0].calledWith({
      event: 'On Demand Audio Playback',
      'Audio Playback State': 'play',
      'Audio Story Title': onDemandSound.metadata.contentModel.title,
      'Audio Show Title': onDemandSound.metadata.contentModel.showTitle,
      'Audio URL': 'http://ondemand.mp3',
      'Audio Playback Source': null,
    }), 'on demand play');

    assert.ok(calls[1].calledWith({
      event: 'Livestream Audio Playback',
      'Audio Playback State': 'play',
      'Audio Story Title': 'Foo Episode',
      'Audio Show Title': 'Bar Show',
      'Audio Stream Title': 'Stream Name',
      'Audio URL': 'http://livestream.aac',
      'Audio Playback Source': null,
    }), 'livestream play');

    assert.ok(calls[2].calledWith({
      event: 'On Demand Audio Playback',
      'Audio Playback State': 'pause',
      'Audio Story Title': onDemandSound.metadata.contentModel.title,
      'Audio Show Title': onDemandSound.metadata.contentModel.showTitle,
      'Audio Playback Source': null,
      'Audio URL': 'http://ondemand.mp3',
    }), 'on demand pause');

    assert.ok(calls[3].calledWith({
      event: 'Livestream Audio Playback',
      'Audio Playback State': 'pause',
      'Audio Story Title': 'Foo Episode',
      'Audio Show Title': 'Bar Show',
      'Audio Stream Title': 'Stream Name',
      'Audio Playback Source': null,
      'Audio URL': 'http://livestream.aac',
    }), 'livestream pause');

    assert.ok(calls[4].calledWith({
      event: 'On Demand Audio Playback',
      'Audio Playback State': 'end',
      'Audio Story Title': onDemandSound.metadata.contentModel.title,
      'Audio Show Title': onDemandSound.metadata.contentModel.showTitle,
      'Audio Playback Source': null,
      'Audio URL': 'http://ondemand.mp3',
    }), 'on demand end');
  });

  test('it sets the expected arbitrary values on the dataLayer', function(assert) {
    let stub = this.stub(window.dataLayer, 'push');

    let service = this.owner.lookup('service:nypr-metrics/data-layer');
    service.push('Foo Data Key', 'Foo Data Value');
    service.push({'Key as an Object': 'Value as an object', 'For Adding': 'Multiple Values'});
    service.clear('Foo Data Key');
    service.clear('Foo', 'Bar', 'Baz');

    assert.ok(stub.getCall(0).calledWith({'Foo Data Key': 'Foo Data Value'}), 'can set with a string key/value pair');
    assert.ok(stub.getCall(1).calledWith({'Key as an Object': 'Value as an object', 'For Adding': 'Multiple Values'}), 'can set with an object');
    assert.ok(stub.getCall(2).calledWith({'Foo Data Key': null}), 'can clear a single key');
    assert.ok(stub.getCall(3).calledWith({'Foo': null, 'Bar': null, 'Baz': null}), 'can clear multiple keys');
  });
});
