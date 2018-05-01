import Service from '@ember/service';
import { get } from '@ember/object';
import config from 'ember-get-config';

const DEFAULT_NPR_VALS = ['NYPR', ...Array(7), config.siteName, null, document.title, ...Array(3)];

export default Service.extend({
  push(key, value) {
    let dataLayer = this.getDataLayer();
    if (typeof key === 'object') {
      dataLayer.push(key);
    } else {
      dataLayer.push({[key]: value});
    }
  },

  clear(...keys) {
    let dataLayer = this.getDataLayer();
    let toClear = {};
    keys.forEach(k => toClear[k] = null);
    dataLayer.push(toClear);
  },

  trigger(eventName) {
    this.push('event', eventName);
  },

  setForType(type, instance) {
    let dataLayer = this.getDataLayer();
    let values;
    switch(type) {
      case 'story':
        values = this._valuesForStory(instance);
        break;
      case 'articlechannel':
      case 'series':
      case 'show':
      case 'tag':
        values = this._valuesForContainer(instance);
        break;
      default:
        values = {};
    }

    dataLayer.push(values);
  },

  clearForType(type) {
    let dataLayer = this.getDataLayer();
    switch(type) {
      case 'story':
        dataLayer.push({
          'Viewed Authors': null,
          'Viewed Date Published': null,
          'Viewed Has Audio': null,
          'Viewed ID': null,
          'Viewed Item Type': null,
          'Viewed NPR ID': null,
          'Viewed Org ID': null,
          'Viewed Show Title': null,
          'Viewed Story Major Tags': null,
          'Viewed Story Template': null,
          'Viewed Story Title': null,
          'Viewed Story Series': null,
          'Viewed Story Tags': null,
          'Viewed Story Word Count': null,
        });
        break;
      case 'show':
        dataLayer.push({
          'Viewed Article Channel Title': null,
          'Viewed Has Audio': null,
          'Viewed ID': null,
          'Viewed Item Type': null,
          'Viewed NPR ID': null,
          'Viewed Org ID': null,
          'Viewed Tag Title': null,
          'Viewed Show Title': null,
          'Viewed Series Title': null,
          'Viewed Story Major Tags': null,
          'Viewed Story Tags': null,
          'Viewed Story Word Count': null,
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
      'Logged In': state.toString()
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

  sendPageView() {
    let dataLayer = this.getDataLayer();
    dataLayer.push({event: 'Page View'});
  },

  send404() {
    let dataLayer = this.getDataLayer();
    dataLayer.push({event: '404'});
  },

  audioTracking(type, soundObject) {
    if (!['play', 'pause', 'resume', 'end', 'schedule'].includes(type)) {
      return;
    }
    let dataLayer = this.getDataLayer();
    let event = this._audioEventForType(soundObject);
    event['Audio Playback State'] = type;
    dataLayer.push(event);
  },

  errorTracking(event, path) {
    let dataLayer = this.getDataLayer();
    dataLayer.push({
      event,
      'Bad URL Path': path
    });
  },

  audioErrorTracking(errorType, errorDetails) {
    let dataLayer = this.getDataLayer();
    dataLayer.push({
      event: 'audioError',
      errorType,
      errorDetails
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
    let nprVals = get(story, 'nprAnalyticsDimensions') || DEFAULT_NPR_VALS;

    values['Viewed Authors'] = get(story, 'appearances.authors').map(a => a.name).join(', ');
    values['Viewed Date Published'] = get(story, 'newsdate');
    values['Viewed Show Title'] = get(story, 'showTitle') || get(story, 'channelTitle') || 'NPR Article?';
    values['Viewed Story Title'] = get(story, 'title')
    values['Viewed Story Template'] = get(story, 'template');
    values['Viewed Story Series'] = get(story, 'series').map(s => s.title).join(', ');

    // for NPR
    values['Viewed Item Type'] = get(story, 'itemType');
    values['Viewed ID'] = get(story, 'cmsPK').toString();
    values['Viewed Story Major Tags'] = nprVals[4];
    values['Viewed Story Tags'] = get(story, 'tags').join(',');
    values['Viewed Org ID'] = nprVals[7]
    values['Viewed Has Audio'] = nprVals[9];
    values['Viewed Story Word Count'] = nprVals[12];
    values['Viewed NPR ID'] = nprVals[13];

    return values;
  },

  _valuesForContainer(container) {
    let values = {};

    switch(get(container, 'itemType'))  {
      case 'show':
        values['Viewed Show Title'] = get(container, 'title')
        break;
      case 'series':
        values['Viewed Series Title'] = get(container, 'title')
        break;
      case 'articlechannel':
        values['Viewed Article Channel Title'] = get(container, 'title')
        break;
      case 'tag':
        values['Viewed Tag Title'] = get(container, 'title');
    }

    // for NPR
    values['Viewed Item Type'] = get(container, 'itemType');
    values['Viewed ID'] = get(container, 'cmsPK').toString();
    values['Viewed Story Major Tags'] = 'none';
    values['Viewed Story Tags'] = 'none';
    values['Viewed Org ID'] = '0';
    values['Viewed Has Audio'] = '0';
    values['Viewed Story Word Count'] = 'none';
    values['Viewed NPR ID'] = 'none';

    return values;
  },

  _audioEventForType(soundObject) {
    let { contentModelType:type, contentModel:model, playContext:source } = get(soundObject, 'metadata');

    if (!['discover', 'Continuous Play', 'queue', 'history'].includes(source)) {
      source = null;
    }

    switch(type) {
      case 'story': // on demand
        return {
          event: 'On Demand Audio Playback',
          'Audio Story Title': get(model, 'title'),
          'Audio Show Title': get(model, 'showTitle'),
          'Audio URL': get(soundObject, 'url'),
          'Audio Playback Source': source,
        };
      case 'stream':
        return {
          event: 'Livestream Audio Playback',
          'Audio Story Title': get(model, 'currentShow.episodeTitle'),
          'Audio Show Title': get(model, 'currentShow.showTitle'),
          'Audio Stream Title': get(model, 'name'),
          'Audio URL': get(soundObject, 'url'),
          'Audio Playback Source': source,
        };
    }
  }
});
