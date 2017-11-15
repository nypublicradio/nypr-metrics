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
