import Route from '@ember/route';
import { inject } from '@ember/service';

export default Route.extend({
  dataLayer: inject('nypr-metrics/data-layer'),
  afterModel(model) {
    this.get('dataLayer').setForType('story', model);
  }
})
