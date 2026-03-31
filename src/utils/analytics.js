/**
 * Custom Event Tracking for Google Analytics 4
 * Purpose: Track candidate views, district clicks, and other user behaviors.
 */

// Placeholder Measurement ID - This should match the one in index.html
export const MEASUREMENT_ID = 'G-E4GWFP886L';

/**
 * Tracks a custom event in Google Analytics.
 * @param {string} eventName - Name of the event to track (e.g., 'candidate_view')
 * @param {Object} eventParams - Additional metadata to send (e.g., { candidate_name: 'Chandrababu Naidu', constituency: 'Kuppam' })
 */
export const trackEvent = (eventName, eventParams = {}) => {
  if (window.gtag) {
    window.gtag('event', eventName, {
      ...eventParams,
      // Global parameters can be added here
      site_version: '1.0.0',
    });
  } else {
    console.debug(`GA Not Found: Tracking event "${eventName}"`, eventParams);
  }
};
