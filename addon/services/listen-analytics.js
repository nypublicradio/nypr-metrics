import Ember from 'ember';
import Service, { inject } from '@ember/service';
import { A } from '@ember/array';
import $ from 'jquery';
import { get, set } from '@ember/object';
import { reads } from '@ember/object/computed';
import { bind, debounce } from '@ember/runloop';

const TEN_MINUTES     = 1000 * 60 * 10;

export default Service.extend({
  hifi        : inject(),
  dataPipeline: inject(),
  dataLayer   : inject('nypr-metrics/data-layer'),
  poll        : inject(),
  fastboot    : inject(),
  currentSound: reads('hifi.currentSound'),
  isFastBoot  : reads('fastboot.isFastBoot'),
  sessionPing : TEN_MINUTES,

  init() {
    if (get(this, 'isFastBoot')) {
      return;
    }
    get(this, 'poll').addPoll({
      interval: get(this, 'sessionPing'),
      callback: bind(this, '_onPlayerPing'),
      label: 'playerPing'
    });

    if (!Ember.testing) {
      $(window).on('beforeunload', () => {
        if (this.get('currentSound')) {
          this._sendListenAction(this.get('currentSound'), 'close');
        }
      });
    }

    this.set('listenActionQueue', A());
    this.set('dataLayerQueue', A());

    get(this, 'hifi').on('audio-played',               bind(this, '_onAudioPlayed'));
    get(this, 'hifi').on('audio-paused',               bind(this, '_onAudioPaused'));
    get(this, 'hifi').on('audio-ended',                bind(this, '_onAudioEnded'));
    get(this, 'hifi').on('audio-position-will-change', bind(this, '_onAudioPositionWillChange'));
    get(this, 'hifi').on('audio-will-rewind',          bind(this, '_onAudioWillRewind'));
    get(this, 'hifi').on('audio-will-fast-forward',    bind(this, '_onAudioWillFastForward'));
    get(this, 'hifi').on('current-sound-interrupted',  bind(this, '_onCurrentSoundInterrupted'));
    get(this, 'hifi').on('current-sound-changed',      bind(this, '_onCurrentSoundChanged'));

    this._super(...arguments);
  },

  /* Monitoring hifi events and then logging analytics -------------------------
    ---------------------------------------------------------------------------*/

  /* Internal actions for logging events. Don't call these from the outside
    ----------------------------------------------------------------------------------*/

  _onCurrentSoundChanged(currentSound, previousSound) {
    let currentType = get(currentSound, 'metadata.contentModelType');

    let previousType;
    if (previousSound) {
      previousType = get(previousSound, 'metadata.contentModelType');
    }

    if (previousType === 'stream' && currentType === 'stream' && currentSound !== previousSound) {
      this._onStreamSwitch(previousSound, currentSound);
    }
  },

  _onCurrentSoundInterrupted(currentSound) {
    this._sendListenAction(currentSound, 'interrupt');
  },

  _onAudioPlayed(sound) {
    let type = get(sound, 'metadata.contentModelType');

    if (type === 'story') { // on demand
      this._onDemandPlay(sound);
    }
    else if (type === 'stream') {
      this._onStreamPlay(sound);
    }
    else if (type === 'bumper') {
      get(this, 'dataLayer').push({
        event: 'Audio Bumper',
        'Audio Playback State': 'play'
      });
    }
  },

  _onAudioEnded(sound) {
    let contentType = get(sound, 'metadata.contentModelType');

    this._sendListenAction(sound, 'finish');
    this._pushToDataLayer({sound, type: 'end', bumper: contentType === 'bumper'});
  },

  _onAudioPaused(sound) {
    let contentType = get(sound, 'metadata.contentModelType');

    this._sendListenAction(sound, 'pause');
    this._pushToDataLayer({sound, type: 'pause', bumper: contentType === 'bumper'});
  },

  _onDemandPlay(sound) {
    let action      = get(sound, 'hasPlayed') ? 'resume' : 'start';
    this._sendListenAction(sound, action);
    this._pushToDataLayer({sound, type: get(sound, 'hasPlayed') ? 'resume' : 'play'})
  },

  _onStreamPlay(sound) {
    let previousId   = get(this, 'currentSound.metadata.contentId');
    let stream      = get(sound, 'metadata.contentModel');
    let streamId    = get(stream, 'id');

    if (streamId !== previousId) {
      this._pushToDataLayer({sound, type:'play'})
    } else {
      this._pushToDataLayer({sound, type:'resume'})
    }

    this._sendListenAction(sound, 'start');
  },

  _onStreamSwitch(previousSound, currentSound) {
    let previousStream = previousSound.get('metadata.contentModel');
    let currentStream  = currentSound.get('metadata.contentModel');
    let prevStreamName = get(previousStream, 'name');
    let currentStreamName = get(currentStream, 'name');

    get(this, 'dataLayer').push({
      event: 'Audio Stream Change',
      'Audio Previous Stream': prevStreamName,
      'Audio Stream Title': currentStreamName,
    });
  },

  _onPlayerPing() {
    if (get(this, 'hifi.isPlaying')) {
      get(this, 'dataLayer').trigger('playerPing');
    }
  },

  _onAudioPositionWillChange(sound) {
    this._sendListenAction(sound, 'position');
  },

  _onAudioWillRewind(sound) {
    this._sendListenAction(sound, 'back_15');
  },

  _onAudioWillFastForward(sound) {
    this._sendListenAction(sound, 'forward_15');
  },

  /*  Called externally -------------------------------------------------------
    --------------------------------------------------------------------------*/

  trackAllCodecFailures(failures, sound) {
    if (failures && failures.length) {
      failures.forEach(failed => {
        this._trackCodecFailure(failed, sound)
      });
    }
  },

  trackSoundFailure({message, failures}) {
    this._pushToDataLayer({type:'audioError', errorType: "Sound Error", errorDetails: message});

    if (failures && failures.length) {
      failures.forEach(failed => this._trackCodecFailure(failed));
    }
  },

  /* Tracking helpers ---------------------------------------------------------
    --------------------------------------------------------------------------*/

  _sendListenAction(sound, type) {
    let position = sound.get('position');

    if (sound.get('metadata.analytics')) {
      let analyticsData = Object.assign({
        current_audio_position: position
      }, sound.get('metadata.analytics'));

      if (type === 'close') {
        // window is closing, no time to waste
        this.get('dataPipeline').reportListenAction(type, analyticsData);
      } else {
        let queue = get(this, 'listenActionQueue')
        queue.push({sound, type, analyticsData});
        debounce(this, '_flushListenActions', 100);
      }
    }
  },

  _flushListenActions() {
    let queue = get(this, 'listenActionQueue');

    if (queue.length === 0) {
      return;
    }

    queue.forEach(({sound, type, analyticsData}, index) => {
      if (type === 'pause' && queue.slice(index).find(info => {
        return (info.sound.url === sound.url) && (info.type === 'finish');
      })) {
        // ignore pause if it's followed by a finish
      }
      else {
        this.get('dataPipeline').reportListenAction(type, analyticsData);
      }
    });

    if (!get(this, 'isDestroying')) {
      set(this, 'listenActionQueue', A());
    }
  },

  _trackCodecFailure({connectionName, error, url}, sound) {
    let action = `Codec Failure | ${connectionName}`;
    let label = `reason: ${error} | bad url: ${url} | ${sound ? `good url: ${get(sound, 'url')}` : 'no successful url'}`;

    this._pushToDataLayer({type:'audioError', errorType: action, errorDetails: label})
  },

  _pushToDataLayer(data) {
    let queue = get(this, 'dataLayerQueue');
    queue.push(data);
    debounce(this, '_flushDataLayer', 100);
  },

  _flushDataLayer() {
    let queue = get(this, 'dataLayerQueue');

    if (queue.length === 0) {
      return;
    }
    queue.forEach(({type, sound, errorType, errorDetails, bumper}, index) => {
      if (type === 'pause' && queue.slice(index).find(info => info.type === 'end')) {
        return;
      }
      else if (type === 'audioError') {
        get(this, 'dataLayer').audioErrorTracking(errorType, errorDetails);
      }
      else if (bumper) {
        get(this, 'dataLayer').push({
          event:                  'Audio Bumper',
          'Audio Playback State': type,
        });
      }
      else {
        get(this, 'dataLayer').audioTracking(type, sound);
      }
    });

    if (!get(this, 'isDestroying')) {
      set(this, 'dataLayerQueue', A());
    }
  },
});
