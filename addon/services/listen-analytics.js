import Ember from 'ember';
import Service, { inject } from '@ember/service';
import { A } from '@ember/array';
import $ from 'jquery';
import { get, set, getWithDefault } from '@ember/object';
import { reads } from '@ember/object/computed';
import { bind, debounce } from '@ember/runloop';
import { classify as upperCamelize } from '@ember/string';

const TWO_MINUTES     = 1000 * 60 * 2;

export default Service.extend({
  hifi        : inject(),
  dataPipeline: inject(),
  metrics     : inject(),
  dataLayer   : inject('nypr-metrics/data-layer'),
  poll        : inject(),
  currentSound: reads('hifi.currentSound'),
  sessionPing : TWO_MINUTES,

  init() {
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
    let currentType     = get(currentSound, 'metadata.contentModelType');
    let currentContext  = get(currentSound, 'metadata.playContext');

    let previousType;
    if (previousSound) {
      previousType    = get(previousSound, 'metadata.contentModelType');
    }

    if (previousType === 'stream' && currentType === 'stream' && currentSound !== previousSound) {
      this._onStreamSwitch(previousSound, currentSound);
    }
    else if (previousType === 'bumper' && currentContext === 'queue') {
      this._onQueueAutoplay();
    }
  },

  _onCurrentSoundInterrupted(currentSound) {
    let type = get(currentSound, 'metadata.contentModelType');

    if (type === 'story') { // on demand
      this._onDemandInterrupted(currentSound);
    }
    else if (type === 'stream') {
      this._onStreamInterrupted(currentSound);
    }
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
      this.get('dataLayer').trigger('Audio Bumper Play');
    }
  },

  _onAudioEnded(sound) {
    let type = get(sound, 'metadata.contentModelType');

    if (type !== 'bumper') {
      this._sendListenAction(sound, 'finish');
      this._pushToDataLayer({sound, type:'end'})
    }
  },

  _onAudioPaused(sound) {
    let type = get(sound, 'metadata.contentModelType');

    if (type === 'bumper') {
      this._onBumperPause(sound);
    }
    else if (type === 'stream') {
      this._onStreamPause(sound);
    }
    else if (type === 'story') {
      this._onDemandPause(sound);
    }
  },

  _onDemandPlay(sound) {
    let action      = get(sound, 'hasPlayed') ? 'resume' : 'start';
    let story       = get(sound, 'metadata.contentModel');
    let playContext = getWithDefault(sound, 'metadata.playContext', "");

    this._sendListenAction(sound, action);
    this._trackPlayerEventForNpr({
      category: 'Engagement',
      action: 'On_demand_audio_play',
      label: get(story, 'audio'),
      story
    });

    if (action === 'start' && (playContext === 'queue' || playContext === 'history')) {
      let showTitle = get(story, 'showTitle') || get(story, 'headers.brand.title');
      let storyTitle = get(story, 'title');

      this._trackPlayerEvent({
        action: 'Played Story from Queue',
        label: `${showTitle}|${storyTitle}`,
        story
      });
    }

    this._pushToDataLayer({sound, type: get(sound, 'hasPlayed') ? 'resume' : 'play'})
  },

  _onDemandPause(sound) {
    let story       = get(sound, 'metadata.contentModel');

    this._trackPlayerEventForNpr({
      category: 'Engagement',
      action: 'On_demand_audio_pause',
      label: get(story, 'audio'),
      story
    });

    this._sendListenAction(sound, 'pause');
    this._pushToDataLayer({sound, type:'pause'})
  },

  _onDemandInterrupted(sound) {
    this._sendListenAction(sound, 'interrupt');
  },

  _onStreamInterrupted(sound) {
    this._sendListenAction(sound, 'interrupt');
  },

  _onStreamPlay(sound) {
    let previousId   = get(this, 'currentSound.metadata.contentId');
    let stream      = get(sound, 'metadata.contentModel');
    let streamId    = get(stream, 'id');
    let streamName  = get(stream, 'name');

    if (streamId !== previousId) {
      this._pushToDataLayer({sound, type:'play'})
    } else {
      this._pushToDataLayer({sound, type:'resume'})
    }

    this._sendListenAction(sound, 'start');

    this._trackPlayerEventForNpr({
      category: 'Engagement',
      action: 'Stream_Play',
      label: `Streaming_${streamName}`
    });
  },

  _onStreamSwitch(previousSound, currentSound) {
    let previousStream = previousSound.get('metadata.contentModel');
    let currentStream  = currentSound.get('metadata.contentModel');
    let prevStreamName = get(previousStream, 'name');
    let currentStreamName = get(currentStream, 'name');

    if (prevStreamName !== currentStreamName) {
      this._trackPlayerEvent({
        action: 'Switched Stream to Stream',
        label: `from ${prevStreamName} to ${currentStreamName}`
      });

      this._trackPlayerEventForNpr({
        category: 'Engagement',
        action: 'Stream_Change',
        label: `Streaming_${currentStreamName}`
      });
    }
  },

  _onStreamPause(sound) {
    let stream      = get(sound, 'metadata.contentModel');

    this._trackPlayerEventForNpr({
      category: 'Engagement',
      action: 'Stream_Pause',
      label: `Streaming_${get(stream, 'name')}`
    });

    this._sendListenAction(sound, 'pause');
    this._pushToDataLayer({sound, type:'pause'})
  },

  _onBumperPause(sound) {
    let bumperSetting = get(sound, 'metadata.autoPlayChoice');

    this._trackPlayerEvent({
      action: 'Paused Bumper',
      label: `${bumperSetting}|Continuous Play`
    });

    this._sendListenAction(sound, 'pause');
  },

  _onQueueAutoplay() {
    this._trackPlayerEvent({
      action: 'Launched Queue',
      label: 'Continuous Play'
    });
  },

  _onPlayerPing() {
    if (get(this, 'hifi.isPlaying')) {
      get(this, 'dataLayer').getDataLayer().push({event: 'playerPing'});
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
    this._trackPlayerEvent({
      action: 'Sound Error',
      label: message
    });

    this._pushToDataLayer({type:'audioError', errorType: "Sound Error", errorDetails: message});

    if (failures && failures.length) {
      failures.forEach(failed => this._trackCodecFailure(failed));
    }
  },

  trackDismissAutoplayNotification() {
    this._trackPlayerEvent({
      action: 'Continuous Play Notification',
      label: 'Click to Close Notification'
    });
  },

  trackAddToQueue(story, region) {
    this._trackPlayerEvent({
      action: 'Add Story to Queue',
      withRegion: true,
      region,
      withAnalytics: true,
      story
    });
  },

  trackStreamData() {
    console.warn('trackStreamData called'); // eslint-disable-line
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
    let story = get(sound, 'metadata.contentModel');
    let action = `Codec Failure | ${connectionName}`;
    let label = `reason: ${error} | bad url: ${url} | ${sound ? `good url: ${get(sound, 'url')}` : 'no successful url'}`;

    this._trackPlayerEvent({story, action, label});
    this._pushToDataLayer({type:'audioError', errorType: action, errorDetails: label})
  },

  _trackPlayerEvent(options) {
    let {action, label, withRegion, region, withAnalytics} = options;
    let analyticsCode  = '';
    let story          = options.story || get(this, 'currentAudio');
    let category       = options.category || 'Persistent Player';

    // Ignore event if it's missing a region but should have one.
    // Assume it was fired from player internals and shouldn't be logged.
    if (withRegion && !region) { return; }
    region = withRegion ? region + ':' : '';
    if (withAnalytics) {
      analyticsCode = get(story, 'analyticsCode');
    }
    if (withRegion || withAnalytics) {
      label = `${region}${analyticsCode}`;
    }

    let metrics = get(this, 'metrics');
    metrics.trackEvent('GoogleAnalytics', {category, action, label});
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
    queue.forEach(({type, sound, errorType, errorDetails}, index) => {
      if (type === 'pause' && queue.slice(index).find(info => info.type === 'end')) {
        return;
      }
      else if (type === 'audioError') {
        get(this, 'dataLayer').audioErrorTracking(errorType, errorDetails);
      }
      else {
        get(this, 'dataLayer').audioTracking(type, sound);
      }
    });

    if (!get(this, 'isDestroying')) {
      set(this, 'dataLayerQueue', A());
    }
  },

  _trackPlayerEventForNpr(options) {
    let metrics = get(this, 'metrics');
    metrics.trackEvent('NprAnalytics', options);
  },

  _formatContext(context) {
    if (context === 'Continuous Play') {
      return context;
    } else if (context === 'nav') {
      return 'Navigation';
    } else if (context){
      return upperCamelize(context);
    }
  }
});
