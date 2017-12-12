import GoogleAdapter from 'ember-metrics/metrics-adapters/google-analytics';
import config from 'ember-get-config';

const DEFAULT_NPR_VALS = ['NYPR', ...Array(7), config.siteName, null, document.title, ...Array(3)];

export default GoogleAdapter.extend({
  toStringExtension() {
    return 'npr-analytics';
  },

  trackPage({ page, title }) {
    if (window.ga) {
      window.ga('npr.send', {hitType: 'pageview', page, title});
      
      // for testing
      return true;
    }
  },

  trackEvent({ category, action, label }) {
    if (window.ga) {
      window.ga('npr.send', 'event', category, action, label);
      
      // for testing
      return true;
    }
  },
  
  setDimensions({ nprVals = DEFAULT_NPR_VALS }) {
    if (window.ga) {
      for (let i = 0; i < nprVals.length; i++) {
        // NPR Dimensions begin at slot 6
        window.ga('npr.set', `dimension${i + 6}`, nprVals[i] || 'none');
      }
    }
  },
});
