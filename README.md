# nypr-metrics

## service/listen-analytics
The `listen-analytics` service coordinates analytics tracking related to listening activities.  It listens to events fired by `ember-hifi` and makes calls to methods on the `data-pipeline` service and available `ember-metrics` adapters. It reads state directly off of `ember-hifi.`

### event queues
Due to a timing issue with firing the `audio-ended` event, the service queues up events and uses a debounced function to fire off queued events. We do this because when a piece of audio finishes, the `<audio/>` element will fire first a `pause` event and then an `ended` event successively. When the queue flushes, it checks to see if the pending events are in a `pause -> ended` pattern, and if so it only fires the `ended` event. There's a queue for both listen actions (sent to `data-pipeline`) and google analytics.

### metadata
A recent update to `ember-hifi` allows consumers to attach arbitrary data to a `metadata` property on generated sound objects. `listen-analytics` expects a few properties on that `metadata` object for tracking purposes.
* `analytics`: an object with arbitrary metadata to be passed to the data-pipeline
* `contentModel`: a stream or story ember-data record
* `contentModelType`: string representing the ember-data model type
* `playContext`: a string representing where in the DOM the click to play this sound originally happened, e.g. 'StoryHeader', 'HomePage', if applicable
* `autoplayChoice`
Google Analytics events still include the `analyticsCode`, but this will soon be replaced by a simple string formatted as `<show title> | <story title>`.`

## service/data-pipeline
This service packages up data and fires it off to the platform events microservice. The service is configured to look for a `browserId` property on itself and include it in outgoing requests. It will also call an `authorize` method which the client can use to update the passed in `fetchOptions`. 

## Client Integration

To integrate with the `data-pipeline,` there is a simple strategy an upstream app can do. Import the service from the addon and re-export it within the app's namespace, adding a `browserId` computed and an `authorize` method.


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

## instance-initialzers/eager-load-services

This instance initializer is an affordance for upstream apps so the the `listen-analytics` service can attach event listeners as soon as possible.
