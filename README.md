# nypr-metrics

## Required Config Values

Name | Type | Description
--- | --- | ---
`platformEventsAPI` | String | Used by the `data-pipeline` service to fire platform events.
`siteName` | String | Used by the `npr-analytics` metrics adapter as a data point.
`metricsAdapters` | Array | Holds adapter specific options

## Optional Config

The `eager-load-services` initializer depends on audio-related addons to be installed. If you are not using it, the initializer maybe opted out by adding `disableEagerListenAnalytics: true` to your app's `config/environment.js` file like so:

```js
// config/environment.js
module.exports = function(environment) {
  let ENV = {
    ...
    'nypr-metrics': {
      disableEagerListenAnalytics: true,
    }
    ...
  }
  ...
};
```


## metrics-adapters/npr-analytics
The `npr-analytics` metrics adapter is designed to work with the `ember-metrics` addon, which is installed as part of the `nypr-metrics` addon as well. A config object for this metrics adapter **must** be added to the `metricsAdapters` array, like so:
```js
// config/environment.js
module.exports = function(environment) {
  let ENV = {
    ...
    metricsAdapters: [{
      name: 'NprAnalytics',
      config: {
        id: 'UA-18188937-11',
        cookieDomain: 'auto',
        name: 'npr'
      }
    }]
    ...
  };
  ...
};
```
This will allow the web client to comply with NPR's reporting standards.

### Methods
#### `trackPage`

Send a page view to the NPR account for the given page path and title.
**Parameters**

Name | Type | Description
--- | --- | ---
`options` | Object | An options object with two keys: `page` and `title`
`options.page` | String | The current page pathname and any query strings. Must start with a forward slash (`/`)
`options.title` | String | The current page's title

#### `trackEvent`

Fires an event to the NPR google analytics back end
**Parameters**

Name | Type | Description
--- | --- | ---
`options` | Object | An options object with three keys: `category`, `action`, `label`
`options.category` | String | The category value for the event
`options.action` | String | The action value for the event
`options.label` | String | The label value for the event

#### `setDimensions`
Sets the required dimensions on the NPR analytics tracker. Only needs to be called on detail routes. The `Show`, `Channel`, and `Story` models found in `nypr-publisher-lib` have an `nprAnalyticsDimensions` attribute which can be passed directly to this method.

**Parameters**

Name | Type | Description
--- | --- | ---
`options` | Object | An options object with one key: `nprVals`
`options.nprVals` | Array | An array of values to be set on the NPR tracker. Can accept the `nprAnalyticsDimensions` attribute directly.


## service/data-layer
The `data-layer` service provides a higher-level API to the `dataLayer` provided by Google Tag Manager. The API surface is tailored specifically for NYPR use-cases and can be easily extended as new requirements arise.

**NOTE**
This service is injected under the `nypr-metrics` namespace in order to maintain a clear distinction between the global `window.dataLayer` and this particular service. So, you'd inject it like this:
```js
dataLayer: service('nypr-metrics/data-layer')
```

**NOTE**
This service only provides an API to Google Tag Manager's `dataLayer`. It is up to the end-user to actually implement GTM in their application, perhaps through an instance initializer and environment variable such as this:
```js
// app/instance-initializers/google-tag-manager.js
import config from '../config/environment';

export function initialize(/* appInstance */) {
  if (typeof window !== 'undefined' && config.environment !== 'test') {
    (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer',config.googleTagManager);
  }
}

export default {
  initialize
};
```

And don't forget to add the preview window iframe to your index.html
```html
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=<YOUR GTM CONTAINER ID>"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->
```

### Methods
#### `setForType(type, instance)`

Set particular `dataLayer` variables based on the given `type`.

**Parameters**

Name | Type | Description
--- | --- | ---
`type` | String | The type of `instance` from which to pull values for the `dataLayer`. Determines specific logic and key names get pushed into the `dataLayer`.
`instance` | Object/Model | The thing going into the `dataLayer`.


#### `clearForType(type)`

Clears the `dataLayer` values for the given `type`.

**Parameters**

Name | Type | Description
--- | --- | ---
`type` | String | Each type sets different values; this ensures only a given types variables are cleared.

#### `setLoggedIn(state)`

Set the `dataLayer` variable to indicate the user's logged-in status.

**Parameters**

Name | Type | Description
--- | --- | ---
`state` | Boolean | `true` for logged in, `false` if not

#### `setMemberStatus(state)`

Set the `dataLayer` variable to indicate the user's membership status.

**Parameters**

Name | Type | Description
--- | --- | ---
`state` | String | `Nonmember`, `One-Time Donor`, `Sustainer`

#### `setPageTitle(title)`

Set the `dataLayer` variable for the current page title.

**Parameters**

Name | Type | Description
--- | --- | ---
`title` | String | The page title.

#### `audioTracking(eventName, soundObject)`

Fires an audio event via the `dataLayer`.

**Parameters**

Name | Type | Description
--- | --- | ---
`eventName` | String | `play`, `pause`, `end`, `resume`
`soundObject` | Sound | A sound object as generated by `ember-hifi`

#### `push(key, value)`

If there isn't a specific method for your use-case, you can use this to set arbitrary `dataLayer` variables.

**Parameters**

Name | Type | Description
--- | --- | ---
`key` | String | Key under which this value will be stored in the `dataLayer`.
`value` | Any | The value to save. Can be any valid JavaScript value, but keep in mind that uses complicated values directly in GA Tags is not supported.

#### `clear(key[, key, ...])`

Sets the given `key` to `null` in the `dataLayer`, effectively clearing the value until it is set again. Accepts multiple keys.

**Parameters**

Name | Type | Description
--- | --- | ---
`key` | String | The `dataLayer` variable name to clear

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

## Publishing

This addon is published to npm using semver. See the [wiki](https://wiki2.wnyc.org/index.php?title=WebClient:Developer_Guide) for more instructions.
