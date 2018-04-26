import Service from '@ember/service';
import { get } from '@ember/object';

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
          'Authors': null,
          'Date Published': null,
          'Show Name': null,
          'Story Title': null,
          'Story Template': null,
          'Item Type': null,
          'ID': null,
          'Major Tags': null,
          'Tags': null,
          'Org ID': null,
          'Has Audio': null,
          'Word Count': null,
          'NPR ID': null,
        });
        break;
      case 'show':
        dataLayer.push({
          'Show Name': null,
          'Item Type': null,
          'ID': null,
          'Major Tags': null,
          'Tags': null,
          'Org ID': null,
          'Has Audio': null,
          'Word Count': null,
          'NPR ID': null,
          'Article Channel Name': null,
          'Series Name': null,
          'Tag Name': null,
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

    values['Authors'] = get(story, 'appearances.authors').map(a => a.name).join(', ');
    values['Date Published'] = get(story, 'newsdate');
    values['Show Name'] = get(story, 'showTitle') || get(story, 'channelTitle') || 'NPR Article?';
    values['Story Title'] = get(story, 'title')
    values['Story Template'] = get(story, 'template');

    // for NPR
    let nprVals = get(story, 'nprAnalyticsDimensions');
    values['Item Type'] = get(story, 'itemType');
    values['ID'] = get(story, 'cmsPK').toString();
    values['Major Tags'] = nprVals[4];
    values['Tags'] = get(story, 'tags').join(',');
    values['Org ID'] = nprVals[7]
    values['Has Audio'] = nprVals[9];
    values['Word Count'] = nprVals[12];
    values['NPR ID'] = nprVals[13];

    return values;
  },

  _valuesForContainer(container) {
    let values = {};

    switch(get(container, 'itemType'))  {
      case 'show':
        values['Show Name'] = get(container, 'title')
        break;
      case 'series':
        values['Series Name'] = get(container, 'title')
        break;
      case 'articlechannel':
        values['Article Channel Name'] = get(container, 'title')
        break;
      case 'tag':
        values['Tag Name'] = get(container, 'title');
    }

    // for NPR
    values['Item Type'] = get(container, 'itemType');
    values['ID'] = get(container, 'cmsPK').toString();
    values['Major Tags'] = 'none';
    values['Tags'] = 'none';
    values['Org ID'] = '0';
    values['Has Audio'] = '0';
    values['Word Count'] = 'none';
    values['NPR ID'] = 'none';

    return values;
  },

  _audioEventForType(soundObject) {
    let { contentModelType:type, contentModel:model, playContext:source } = get(soundObject, 'metadata');

    if (!['discover', 'Continuous Play', 'queue'].includes(source)) {
      source = null;
    }

    switch(type) {
      case 'story': // on demand
        return {
          event: 'On Demand Audio Playback',
          'Audio Story Title': get(model, 'title'),
          'Audio Show Title': get(model, 'showTitle'),
          'Playback Source': source,
        };
      case 'stream':
        return {
          event: 'Livestream Audio Playback',
          'Audio Story Title': get(model, 'currentShow.episodeTitle'),
          'Audio Show Title': get(model, 'currentShow.showTitle'),
          'Audio Stream Name': get(model, 'name'),
          'Playback Source': source,
        };
    }
  }
});
