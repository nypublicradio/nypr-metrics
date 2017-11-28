import Service from 'ember-service';
import get from 'ember-metal/get';

export default Service.extend({
  setForType(type, instance) {
    let dataLayer = this.getDataLayer();
    let values;
    switch(type) {
      case 'story':
        values = this._valuesForStory(instance);
        break;
      case 'show':
        values = this._valuesForShow(instance);
        break;
    }
    
    dataLayer.push(values);
  },
  
  clearForType(type) {
    let dataLayer = this.getDataLayer();
    switch(type) {
      case 'story':
        dataLayer.push({
          'Authors': null,
          'Date Published': null,
          'Show Name': null,
          'Story Title': null,
        });
        break;
      case 'show':
        dataLayer.push({
          'Show Name': null
        });
        break;
    }
  },
  
  setLoggedIn(state) {
    if (![true, false].includes(state)) {
      return;
    }
    let dataLayer = this.getDataLayer();
    dataLayer.push({
      'Logged In': state
    });
  },
  
  setMemberStatus(status) {
    if (!['Nonmember', 'One-Time Donor', 'Sustainer'].includes(status)) {
      return;
    }
    
    let dataLayer = this.getDataLayer();
    dataLayer.push({
      'Member Status': status
    });
  },
  
  setPageTitle(title) {
    let dataLayer = this.getDataLayer();
    dataLayer.push({ 'Page Title': title });
  },
  
  audioTracking(type, soundObject) {
    if (!['play', 'pause', 'resume', 'end'].includes(type)) {
      return;
    }
    let dataLayer = this.getDataLayer();
    let event = this._audioEventForType(soundObject);
    event['Playback State'] = type;
    dataLayer.push(event);
  },
  
  errorTracking(event, path) {
    let dataLayer = this.getDataLayer();
    dataLayer.push({
      event,
      'Bad URL Path': path
    });
  },
  
  getDataLayer() {
    if (!window.dataLayer) {
      console.warn('No global dataLayer available'); // eslint-disable-line
      return [];
    } else {
      return window.dataLayer;
    }
  },
  
  _valuesForStory(story) {
    let values = {};
    
    values['Authors'] = get(story, 'appearances.authors').map(a => a.name).join(', ');
    values['Date Published'] = get(story, 'newsdate');
    values['Show Name'] = get(story, 'showTitle') || get(story, 'channelTitle');
    values['Story Title'] = get(story, 'title')
    
    return values;
  },
  
  _valuesForShow(show) {
    return {
      'Show Name': get(show, 'title')
    };
  },
  
  _audioEventForType(soundObject) {
    let { contentModelType:type, contentModel:model } = get(soundObject, 'metadata');
    switch(type) {
      case 'story': // on demand
        return {
          event: 'On Demand Audio Playback',
          'Audio Story Title': get(model, 'title'),
          'Audio Show Title': get(model, 'showTitle')
        };
      case 'stream':
        return {
          event: 'Livestream Audio Playback'
        };
    }
  }
});
