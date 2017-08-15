# nypr-metrics

## Client Integration

Client app should extend `data-pipeline` service and add an `authorize` method, and a `browserId` property, like so:


```javascript

import DataPipeline from 'nypr-metrics/services/data-pipeline';
import Ember from 'ember';
import computed from 'ember-computed';

export default DataPipeline.extend({
  session: Ember.inject.service(),
  browserId: computed.readOnly('session.data.browserId'),
  authorize(fetchOptions) {
    this.get('session').authorize('authorizer:nypr', (header, value) => {
      fetchOptions.headers[header] = value;
    });

    return fetchOptions;
  }

})
```
