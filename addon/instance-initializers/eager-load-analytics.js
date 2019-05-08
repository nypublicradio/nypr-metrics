import config from 'ember-get-config';
// We want this service to start listening immediately without
// needing the consumer to inject it somewhere

export function initialize(appInstance) {
  if (config['nypr-metrics'] && config['nypr-metrics'].disableEagerListenAnalytics) {
    return;
  }
  appInstance.inject('controller:application', '_listenAnalytics', 'service:listen-analytics');

  // We don't just want to look it up (like so: appInstance.lookup('service:listen-analytics'))
  // because then hifi will initialize itself using the nypr-audio-services environment
  // configuration and that is *not* how we want it.
}

export default {
  name: 'eager-load-analytics',
  initialize
};
