import Service from 'ember-service';
import service from 'ember-service/inject';

export default Service.extend({
  hifi: service(),

  init() {
    this.listenForTrackChanges();
    this._super(...arguments);
  },

  listenForTrackChanges() {
    let audioEndedSound, audioPausedSound;
    this.get('hifi').on('audio-ended', (sound) => {
      audioEndedSound = sound;
    });

    this.get('hifi').on('audio-paused', (sound) => {
      sound.one('audio-played', (s) => {
        audioPausedSound = null;
      });
      audioPausedSound = sound;
    })

    this.get('hifi').on('current-sound-changed', ({previousSound, currentSound}) => {

      // let previousId = currentSound.get('metadata.contentId');
      // let data = Object.assign(previousModel.get('analyticsData'), {
      //   current_audio_position: sound.get('position')
      // });

      // send listen analytic for audio play
      // resume or new play

      if (previousSound && previousSound != audioEndedSound && previousSound != audioPausedSound) {
        console.log('send interrupt event!');
        // send interrupt event for previousSound
      }

      // send play event for currentSound
    });
  }

});
