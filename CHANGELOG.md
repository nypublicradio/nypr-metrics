# nypr-metrics Changelog

## 0.2.4
- [ENHANCEMENT] Adds npr analytics metrics adapter

## 0.2.3
- [ENHANCEMENT] Adds `push` and `clear` methods to `dataLayer`.

## 0.2.2
- [ENHANCEMENT] Adds `sendPageView` method. We can't rely on GTM to trigger this based on a "History Change" event because the document title is not updated until afterwards. So upstream consumers can use this to fire a pageview event from the code. It should be fired in an `afterRender` queue so the title has been updated.

## 0.2.1
- [ENHANCEMENT] Adds `errorTracking` method for 404 and 500 errors

## 0.2.0
- [ENHANCEMENT] Adds audio tracking API for audio events to push into the data layer

## 0.1.0
- [BUGFIX] Tests on Circle were failing consistently without a local repro. Finally fixed it by removing the bower dependency.
- [ENHANCEMENT] Upgrade `ember-cli` to 2.16.2
- [FEATURE] Adds the `data-layer` service to support `dataLayer` access and GTM

## 0.0.1

- [ENHANCEMENT] Adds versioning
