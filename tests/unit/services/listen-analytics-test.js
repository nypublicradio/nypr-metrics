import Ember from "ember";
import { moduleFor, test } from "ember-qunit";
import sinon from "sinon";
import hifiNeeds from "dummy/tests/helpers/hifi-needs";
import { dummyHifi } from "dummy/tests/helpers/hifi-integration-helpers";
import wait from "ember-test-helpers/wait";

moduleFor("service:listen-analytics", "Unit | Service | listen analytics", {
  needs: [...hifiNeeds],
  beforeEach() {
    this.register("service:hifi", dummyHifi);
    this.inject.service("hifi");

    let pipeline = Ember.Service.extend({
      reportListenAction: function() {}
    });

    let metrics = Ember.Service.extend({
      trackEvent: function() {}
    });

    this.register("service:data-pipeline", pipeline);
    this.inject.service("dataPipeline");

    this.register("service:metrics", metrics);
    this.inject.service("metrics");
  }
});

test("it sets up the player ping", function(assert) {
  let counter = 0;
  this.clock = sinon.useFakeTimers();

  this.subject({
    poll: {
      addPoll({ label }) {
        counter++;
        assert.equal(label, "playerPing", "the correct poll was added");
      }
    }
  });

  this.clock.tick(200000);
  assert.equal(counter, 1, "service should only call addPoll once");
  this.clock.restore();
});

test("it calls _onAudioPlayed when audio is played", function(assert) {
  let interceptor = {
    listenForTrackChanges: function() {},
    _onAudioEnded: function() {},
    _onAudioPlayed: function() {},
    _onAudioPaused: function() {}
  };

  let spy = sinon.stub(interceptor, "_onAudioPlayed");

  let service = this.subject(interceptor);
  let hifi = service.get("hifi");

  hifi.trigger("audio-played", {});
  hifi.trigger("audio-played", {});

  assert.equal(spy.callCount, 2);
});

test("it calls _onAudioPaused when audio is paused", function(assert) {
  let interceptor = {
    listenForTrackChanges: function() {},
    _onAudioEnded: function() {},
    _onAudioPlayed: function() {},
    _onAudioPaused: function() {}
  };

  let spy = sinon.stub(interceptor, "_onAudioPaused");

  let service = this.subject(interceptor);
  let hifi = service.get("hifi");

  hifi.trigger("audio-paused", {});
  hifi.trigger("audio-paused", {});

  assert.equal(spy.callCount, 2);
});

test("it calls _onAudioEnded when audio is ended", function(assert) {
  let interceptor = {
    listenForTrackChanges: function() {},
    _onAudioEnded: function() {},
    _onAudioPlayed: function() {},
    _onAudioPaused: function() {}
  };

  let spy = sinon.stub(interceptor, "_onAudioEnded");
  let service = this.subject(interceptor);
  let hifi = service.get("hifi");

  hifi.trigger("audio-ended", {});
  hifi.trigger("audio-ended", {});

  assert.equal(spy.callCount, 2);
});

test("it calls _onDemandInterrupted when audio is interrupted", function(
  assert
) {
  let interceptor = {
    _onDemandInterrupted: function() {}
  };

  let interruptSpy = sinon.stub(interceptor, "_onDemandInterrupted");
  let service = this.subject(interceptor);
  let hifi = service.get("hifi");

  let metadata1 = {
    contentModelType: "story",
    contentId: 1,
    contentModel: {}
  };

  let metadata2 = {
    contentModelType: "story",
    contentId: 2,
    contentModel: {}
  };

  hifi.play("/good/15000/test1.mp3", { metadata1 }).then(() => {
    hifi.play("/good/12000/test2.mp3", { metadata2 }).then(() => {
      assert.equal(
        interruptSpy.callCount,
        1,
        "on demand interrupted should have been called"
      );
    });
  });
});

test("it does not call _onDemandInterrupted when audio is paused beforehand", function(
  assert
) {
  let interceptor = {
    _onDemandInterrupted: function() {}
  };

  let interruptSpy = sinon.stub(interceptor, "_onDemandInterrupted");
  let service = this.subject(interceptor);
  let hifi = service.get("hifi");

  let metadata1 = {
    contentModelType: "story",
    contentId: 1,
    contentModel: {}
  };

  let metadata2 = {
    contentModelType: "story",
    contentId: 2,
    contentModel: {}
  };

  hifi.play("/good/15000/test1.mp3", { metadata1 }).then(({ sound }) => {
    sound.pause();
    hifi.play("/good/12000/test2.mp3", { metadata2 }).then(() => {
      assert.equal(
        interruptSpy.callCount,
        0,
        "on demand interrupted should not have been called"
      );
    });
  });
});

test("it calls _onStreamSwitch when audio is switched from one stream to another", function(
  assert
) {
  let service = this.subject({});
  let spy = sinon.stub(service, "_onStreamSwitch");
  let hifi = service.get("hifi");

  let EventedObject = Ember.Object.extend(Ember.Evented);

  let stream1 = EventedObject.create({
    name: "stream 1",
    metadata: {
      contentModel: {
        forListenAction: function() {
          return Ember.RSVP.Promise.resolve({});
        }
      },
      contentModelType: "stream",
      contentId: 1
    }
  });

  let stream2 = EventedObject.create({
    name: "stream 2",
    metadata: {
      contentModel: {
        forListenAction: function() {
          return Ember.RSVP.Promise.resolve({});
        }
      },
      contentModelType: "stream",
      contentId: 2
    }
  });

  let story = EventedObject.create({
    metadata: {
      contentModel: {
        forListenAction: function() {
          return Ember.RSVP.Promise.resolve({});
        }
      },
      contentModelType: "story",
      contentId: 3
    }
  });

  hifi.trigger("current-sound-changed", story);
  assert.equal(spy.callCount, 0, "should not trigger when playing first story");

  hifi.trigger("current-sound-changed", stream1, story);
  assert.equal(
    spy.callCount,
    0,
    "should not trigger when switching from story to stream"
  );

  hifi.trigger("current-sound-changed", stream1, stream1);
  assert.equal(
    spy.callCount,
    0,
    "should not trigger when switching from the same stream to stream"
  );

  hifi.trigger("current-sound-changed", stream2, stream1);
  assert.equal(
    spy.callCount,
    1,
    "should trigger when switching from stream to stream"
  );
});

test("service passes correct attrs to data pipeline to report an on_demand listen action", function(
  assert
) {
  let done = assert.async();
  let reportStub = sinon.stub();
  let interceptor = {
    dataPipeline: {
      reportListenAction: reportStub
    }
  };

  let service = this.subject(interceptor);
  let hifi = service.get("hifi");

  let metadata1 = {
    contentModelType: "story",
    contentId: 1,
    contentModel: {

    },
    analytics: {
      audio_type: "on_demand",
      cms_id: 1,
      item_type: "episode"
    }
  };

  let metadata2 = {
    contentModelType: "story",
    contentId: 2,
    contentModel: {

    },
    analytics: {
      audio_type: "on_demand",
      cms_id: 2,
      item_type: "episode"
    }
  };

  hifi.play("/good/45000/test1.mp3", { metadata: metadata1 }).then(() => {
    hifi.fastForward(20000);
    hifi.rewind(15000);
    hifi.set("position", hifi.get("position") + 2000);
    hifi.togglePause();
    hifi.togglePause();

    hifi.play("/good/10000/test2.mp3", { metadata: metadata2 }).then(() => {
      hifi.set("position", hifi.get("position") + 10000);
      wait(1000).then(() => {
        let reportCalls = reportStub.getCalls();

        let expectedCalls = [
          [
            "start",
            {
              audio_type: "on_demand",
              cms_id: 1,
              item_type: "episode",
              current_audio_position: 0
            }
          ],
          [
            "forward_15",
            {
              audio_type: "on_demand",
              cms_id: 1,
              item_type: "episode",
              current_audio_position: 0
            }
          ],
          // 'current_audio_position should be time when action happened, not target time'

          [
            "back_15",
            {
              audio_type: "on_demand",
              cms_id: 1,
              item_type: "episode",
              current_audio_position: 20000
            }
          ],
          // 'current_audio_position should be time when action happened, not target time'

          [
            "position",
            {
              audio_type: "on_demand",
              cms_id: 1,
              item_type: "episode",
              current_audio_position: 5000
            }
          ],
          // 'current_audio_position should be time when action happened, not target time'

          [
            "pause",
            {
              audio_type: "on_demand",
              cms_id: 1,
              item_type: "episode",
              current_audio_position: 7000
            }
          ],
          [
            "resume",
            {
              audio_type: "on_demand",
              cms_id: 1,
              item_type: "episode",
              current_audio_position: 7000
            }
          ],
          [
            "interrupt",
            {
              audio_type: "on_demand",
              cms_id: 1,
              item_type: "episode",
              current_audio_position: 7000
            }
          ],
          [
            "pause",
            {
              audio_type: "on_demand",
              cms_id: 1,
              item_type: "episode",
              current_audio_position: 7000
            }
          ],

          // now we're dealing with story 2
          [
            "start",
            {
              audio_type: "on_demand",
              cms_id: 2,
              item_type: "episode",
              current_audio_position: 0
            }
          ],
          [
            "position",
            {
              audio_type: "on_demand",
              cms_id: 2,
              item_type: "episode",
              current_audio_position: 0
            }
          ],
          // 'current_audio_position should be time when action happened, not target time'

          [
            "finish",
            {
              audio_type: "on_demand",
              cms_id: 2,
              item_type: "episode",
              current_audio_position: 10000
            }
          ]
        ];

        assert.deepEqual(
          reportCalls.map(r => r.args[0]),
          expectedCalls.map(e => e[0]),
          `should have the specified calls`
        );

        reportCalls.forEach((reportCall, index) => {
          assert.deepEqual(
            reportCall.args,
            expectedCalls[index],
            `${expectedCalls[index][0]} should have the correct arguments`
          );
        });

        done();
      });
    });
  });
});
