import Ember from 'ember';
import Service from 'ember-service';
import service from 'ember-service/inject';
import computed from 'ember-computed';
import get from 'ember-metal/get';
import set from 'ember-metal/set';
import { bind, debounce } from 'ember-runloop';
import { classify as upperCamelize } from 'ember-string';
const { getWithDefault } = Ember;

const TWO_MINUTES     = 1000 * 60 * 2;

export default Service.extend({
  hifi        : service(),
  dataPipeline: service(),
  metrics     : service(),
  poll        : service(),
  currentSound: computed.reads('hifi.currentSound'),
  sessionPing : TWO_MINUTES,

  init() {
    get(this, 'poll').addPoll({
      interval: get(this, 'sessionPing'),
      callback: bind(this, '_onPlayerPing'),
      label: 'playerPing'
    });

    if (!Ember.testing) {
      Ember.$(window).on('beforeunload', () => {
        if (this.get('currentSound')) {
          this._sendListenAction(this.get('currentSound'), 'close');
        }
      });
    }

    this.set('listenActionQueue', Ember.A());
    this.set('googleQueue', Ember.A());

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
      this._onBumperPlay(sound);
    }
  },

  _onAudioEnded(sound) {
    let story = get(sound, 'metadata.contentModel');
    let playContext = getWithDefault(sound, 'metadata.playContext', "");

    this._trackPlayerEvent({
      story,
      action: 'Finished Story',
      withRegion: true,
      withAnalytics: true,
      region: upperCamelize(playContext)
    });

    this._sendListenAction(sound, 'finish');
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
    let fromClick   = get(sound, 'metadata.fromClick');

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

    if (!fromClick) {
      this._trackPlayerEvent({
        action: `Played Story "${get(story, 'title')}"`,
        withRegion: true,
        region: upperCamelize(playContext),
        withAnalytics: true,
        story
      });
    }
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
    let playContext = get(sound, 'metadata.playContext');
    let streamId    = get(stream, 'id');
    let streamName  = get(stream, 'name');

    let label = streamName;
    if (playContext === 'nav' || playContext === 'Continuous Play') {
      label += `|${this._formatContext(playContext)}`;
    }

    if (streamId !== previousId) {
      this._trackPlayerEvent({
        action: 'Launched Stream',
        label,
      });
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
  },

  _onBumperPause(sound) {
    let bumperSetting = get(sound, 'metadata.autoplayChoice');

    this._trackPlayerEvent({
      action: 'Paused Bumper',
      label: `${bumperSetting}|Continuous Play`
    });

    this._sendListenAction(sound, 'pause');
  },

  _onBumperPlay() {
    this._trackPlayerEvent({
      action: 'Continuous Play Notification',
      label: 'Audio Bumper',
    });
  },

  _onQueueAutoplay() {
    this._trackPlayerEvent({
      action: 'Launched Queue',
      label: 'Continuous Play'
    });
  },

  _onPlayerPing() {
    get(this, 'metrics').trackEvent('GoogleAnalytics', {
      category: 'Persistent Player',
      action: '2 Minute Ping',
      value: get(this, 'hifi.isPlaying') ? 1 : 0
    });
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
      failures.forEach(failed => this._trackCodecFailure(failed, sound));
    }
  },

  trackSoundFailure({message, failures}) {
    this._trackPlayerEvent({
      action: 'Sound Error',
      label: message
    });
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

  trackStreamData(sound) {
    let stream     = get(sound, 'metadata.contentModel');
    let showTitle  = get(stream, 'currentShow.show_title') || get(stream, 'currentShow.title');
    let streamName = get(stream, 'name');

    Ember.RSVP.Promise.resolve(get(stream, 'story')).then(story => {
      let storyTitle = story ? get(story, 'title') : 'no title';

      this._trackPlayerEvent({
        action: `Streamed Show "${showTitle}" on ${streamName}`,
        label: storyTitle
      });

      if (story) {
        this._trackPlayerEvent({
          action: `Streamed Story "${storyTitle}" on "${streamName}"`,
          withAnalytics: true,
          story
        });
      }
    });
  },


  /* Tracking helpers ---------------------------------------------------------
    --------------------------------------------------------------------------*/

  _sendListenAction(sound, type) {
    let position = sound.get('position');

    if (sound.get('metadata.analytics')) {
      let analyticsData = Object.assign({
        current_audio_position: position
      }, sound.get('metadata.analytics'));
      let queue = get(this, 'listenActionQueue')
      queue.push({sound, type, analyticsData});
      debounce(this, '_flushListenActions', 100);
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
      set(this, 'listenActionQueue', Ember.A());
    }
  },

  _trackCodecFailure({connectionName, error, url}, sound) {
    this._trackPlayerEvent({
      story: get(sound, 'metadata.contentModel'),
      action: `Codec Failure | ${connectionName}`,
      label: `reason: ${error} | bad url: ${url} | ${sound ? `good url: ${get(sound, 'url')}` : 'no successful url'}`
    });
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

    let queue = get(this, 'googleQueue');
    queue.push({category, action, label});
    debounce(this, '_flushGoogle', 100);
  },

  _flushGoogle() {
    let queue = get(this, 'googleQueue');

    if (queue.length === 0) {
      return;
    }
    queue.forEach(({category, action, label}, index) => {
      if (action.match(/Pause/) && queue.slice(index).find(info => info.action.match(/Finish/))) {
        return;
      }
      else {
        let metrics = get(this, 'metrics');
        metrics.trackEvent('GoogleAnalytics', {category, action, label});
      }
    });

    if (!get(this, 'isDestroying')) {
      set(this, 'googleQueue', Ember.A());
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
