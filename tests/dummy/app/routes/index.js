import Route from 'ember-route';
import service from 'ember-service/inject';

export default Route.extend({
  dataLayer: service('nypr-metrics/data-layer'),
  afterModel(model) {
    this.get('dataLayer').setForType('story', model);
  }
})
