import { Promise as EmberPromise } from 'rsvp';
import Evented from '@ember/object/evented';
import EmberObject from '@ember/object';
import Service from '@ember/service';
import { module, test } from 'qunit';
import { setupTest } from "ember-qunit";
import { settled } from '@ember/test-helpers';
import { run, later } from '@ember/runloop';
import sinon from "sinon";
import { dummyHifi } from "dummy/tests/helpers/hifi-integration-helpers";

module("Unit | Service | listen analytics", function(hooks) {
  setupTest(hooks);

  hooks.beforeEach(function() {
    this.owner.register("service:hifi", dummyHifi);
    this.hifi = this.owner.lookup('service:hifi');

    let pipeline = Service.extend({
      reportListenAction: function() {}
    });

    this.owner.register("service:data-pipeline", pipeline);
    this.dataPipeline = this.owner.lookup('service:dataPipeline');
  });

  test("it sets up the player ping", function(assert) {
    let counter = 0;
    this.clock = sinon.useFakeTimers();

    this.owner.factoryFor("service:listen-analytics").create({
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

    let service = this.owner.factoryFor("service:listen-analytics").create(interceptor);
    let hifi = service.get("hifi");

    run(() => {
      hifi.trigger("audio-played", {});
      hifi.trigger("audio-played", {});
    });

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

    let service = this.owner.factoryFor("service:listen-analytics").create(interceptor);
    let hifi = service.get("hifi");

    run(() => {
      hifi.trigger("audio-paused", {});
      hifi.trigger("audio-paused", {});
    });

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
    let service = this.owner.factoryFor("service:listen-analytics").create(interceptor);
    let hifi = service.get("hifi");

    run(() => {
      hifi.trigger("audio-ended", {});
      hifi.trigger("audio-ended", {});
    });

    assert.equal(spy.callCount, 2);
  });

  test("it calls _sendListenAction with 'interrupt' when audio is interrupted", function(
    assert
  ) {
    let interceptor = {
      _sendListenAction: function() {}
    };

    let interruptSpy = sinon.stub(interceptor, "_sendListenAction");
    let service = this.owner.factoryFor("service:listen-analytics").create(interceptor);
    let hifi = service.get("hifi");
    let done = assert.async();

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

    run(() => {
      hifi.play("/good/15000/test1.mp3", { metadata: metadata1 }).then(() => {
        hifi.play("/good/12000/test2.mp3", { metadata: metadata2 }).then(() => {
          let call = interruptSpy.getCalls().find(call => call.args.includes('interrupt'));
          assert.ok(
            call,
            "on demand interrupted should have been called"
          );
          done();
        });
      });
    });
  });

  test("it does not call _sendListenAction with 'interrupt' when audio is paused beforehand", function(
    assert
  ) {
    let done = assert.async();
    let interceptor = {
      _sendListenAction: function() {}
    };

    let interruptSpy = sinon.stub(interceptor, "_sendListenAction");
    let service = this.owner.factoryFor("service:listen-analytics").create(interceptor);
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

    hifi.play("/good/15000/test1.mp3", { metadata: metadata1 }).then(({ sound }) => {
      sound.pause();
      hifi.play("/good/12000/test2.mp3", { metadata: metadata2 }).then(() => {
        interruptSpy.getCalls().forEach(call => assert.notOk(call.args.includes('interrupt')));
        done();
      });
    });
  });

  test("it calls _onStreamSwitch when audio is switched from one stream to another", function(
    assert
  ) {
    let service = this.owner.factoryFor("service:listen-analytics").create({});
    let spy = sinon.stub(service, "_onStreamSwitch");
    let hifi = service.get("hifi");

    let EventedObject = EmberObject.extend(Evented);

    let stream1 = EventedObject.create({
      name: "stream 1",
      metadata: {
        contentModel: {
          forListenAction: function() {
            return EmberPromise.resolve({});
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
            return EmberPromise.resolve({});
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
            return EmberPromise.resolve({});
          }
        },
        contentModelType: "story",
        contentId: 3
      }
    });

    run(() => {
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

    let service = this.owner.factoryFor("service:listen-analytics").create(interceptor);
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
        return settled().then(() => {
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

  test("service does not record the pause action immediately preceding an end action", function(
      assert
    ) {

    let done = assert.async();
    let reportStub = sinon.stub();
    let interceptor = {
      dataPipeline: {
        reportListenAction: reportStub
      }
    };

    let service = this.owner.factoryFor("service:listen-analytics").create(interceptor);
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

    let sound1, sound2;

    hifi.load("/good/1000/test.mp3", {metadata: metadata1}).then(({sound}) => {
      sound1= sound;
      hifi.load("/good/1000/test2.mp3", {metadata: metadata2}).then(({sound}) => {
        sound2 = sound;

        service._sendListenAction(sound1, 'start');
        service._sendListenAction(sound1, 'pause');
        service._sendListenAction(sound2, 'pause');
        service._sendListenAction(sound1, 'finish');

        settled().then(() => {
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
              "pause",
              {
                audio_type: "on_demand",
                cms_id: 2,
                item_type: "episode",
                current_audio_position: 0
              }
            ],
            [
              "finish",
              {
                audio_type: "on_demand",
                cms_id: 1,
                item_type: "episode",
                current_audio_position: 0
              }
            ]
          ];

          assert.deepEqual(reportCalls.map(r => r.args[0]), expectedCalls.map(e => e[0]), `should have the specified calls`);

          reportCalls.forEach((reportCall, index) => {
            assert.deepEqual(reportCall.args, expectedCalls[index], `${expectedCalls[index][0]} should have the correct arguments`
            );
          });

          done();
        });
      });
    });
  });

  test("it calls dataLayer.trackAudio with the correct params", function(assert) {
    let done = assert.async();
    let EventedObject = EmberObject.extend(Evented);
    const onDemand = EventedObject.create({
      metadata: {
        contentModelType: 'story',
        contentModel: {
          showTitle: 'Foo Show',
          title: 'Foo Title'
        }
      }
    });

    const stream = EventedObject.create({
      metadata: {
        contentModelType: 'stream',
        contentModel: {
          id: 1
        }
      }
    });

    let spy = sinon.spy();
    let service = this.owner.factoryFor("service:listen-analytics").create({
      dataLayer: {
        audioTracking: spy
      }
    });
    let hifi = service.get("hifi");

    run(() => {
      hifi.trigger('audio-played', onDemand);
      hifi.trigger('audio-played', stream);

      hifi.trigger('audio-paused', onDemand);
      hifi.trigger('audio-paused', stream);
    });

    later(() => {
      onDemand.set('hasPlayed', true);
      hifi.trigger('audio-played', onDemand);
      hifi.trigger('audio-ended', onDemand);
    }, 150);

    settled().then(() => {
      let calls = spy.getCalls();
      assert.ok(calls[0].calledWith('play', onDemand), 'on demand play');
      assert.ok(calls[1].calledWith('play', stream), 'stream play');

      assert.ok(calls[2].calledWith('pause', onDemand), 'on demand pause');
      assert.ok(calls[3].calledWith('pause', stream), 'stream pause');

      onDemand.set('hasPlayed', true);
      assert.ok(calls[4].calledWith('resume', onDemand), 'on demand resume');
      assert.ok(calls[5].calledWith('end', onDemand), 'on demand end');
      done();
    });
  });

  test("service reports a close event synchronously", function(assert) {
    let reportStub = sinon.stub();

    this.dataPipeline.set('reportListenAction', reportStub);
    let service = this.owner.lookup('service:listen-analytics')
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


    hifi.load("/good/1000/test.mp3", {metadata: metadata1}).then(({sound}) => {
      service._sendListenAction(sound, 'start');
      service._sendListenAction(sound, 'close');

      let expectedCall = [
        "close",
        {
          audio_type: "on_demand",
          cms_id: 1,
          item_type: "episode",
          current_audio_position: 0
        }
      ];

      assert.ok(reportStub.calledOnce);
      assert.deepEqual(reportStub.firstCall.args, expectedCall, 'close should have the correct arguments');
    });
  });
});
