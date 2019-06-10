# nypr-metrics Changelog

## 0.6.0
- [ENHANCEMENT] add values for gothamist articles
- [CHORE] remove bower

## 0.5.4
- [ENHANCEMENT] make `eager-load-services` opt-outable

## 0.5.3
- [ENHANCEMENT] add list position tracking support to on demand audio analytics

## 0.5.2
- [BUGFIX] rename `eager-load-services` so that it isn't clobbered by an instance initializer of the same name from `nypr-audio-services`

## 0.5.1
- [ENHANCEMENT] include Container slug in GTM variables

## 0.5.0
- [ENHANCEMENT] Fastboot compatibility

## 0.4.0
- [ENHANCEMENT] major analytics upgrade
- [ENHANCEMENT] package metrics for NPR
- [CHORE] remove metrics-adapters
- [ENHANCEMENT] package metrics for new GTM spec
- [FEATURE] new `data-layer` APIs: `trigger`, `send404`
- [ENHANCEMENT] integrate `data-layer` with other analytics services

## 0.3.2
- [BUGFIX] send close event synchronously

## 0.3.1
- [BUGFIX] Fixed a missing `super` call in an init

## 0.3.0
- [CHORE] Update to Ember 3.0 and new module syntax

## 0.2.6
- [ENHANCEMENT] Send audio errors to GTM

## 0.2.5
- [BUGFIX] Fix incorrect casing of passed in autoPlayChoice variable

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
