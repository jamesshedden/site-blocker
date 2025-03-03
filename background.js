// Initialize the extension
console.log('Site Blocker extension initialized');

// Flag to prevent concurrent rule updates
let isUpdatingRules = false;

// Set up initial state on installation
chrome.runtime.onInstalled.addListener(function() {
  console.log('Extension installed');

  // Default settings
  const defaultSites = ['twitter.com', 'x.com'];

  chrome.storage.local.get(['blockedSites', 'blockingEnabled'], function(result) {
    // Only set defaults if not already set
    const updates = {};

    if (!result.blockedSites) {
      updates.blockedSites = defaultSites;
    }

    if (result.blockingEnabled === undefined) {
      updates.blockingEnabled = true;
    }

    if (Object.keys(updates).length > 0) {
      chrome.storage.local.set(updates, function() {
        console.log('Default settings applied');
        // Don't call updateDynamicRules here - we'll do it once at the end
      });
    }
  });
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  console.log('Received message:', message);
  if (message.action === "updateRules") {
    console.log('Updating rules due to message from popup');
    updateDynamicRules();
  }
});

// Update the dynamic rules based on current settings
function updateDynamicRules() {
  // Prevent concurrent updates
  if (isUpdatingRules) {
    console.log('Rule update already in progress, skipping');
    return;
  }

  isUpdatingRules = true;
  console.log('Starting rule update');

  // First, get all existing rules and remove them
  chrome.declarativeNetRequest.getDynamicRules()
    .then(existingRules => {
      console.log('Existing rules:', existingRules.length);
      const ruleIds = existingRules.map(rule => rule.id);

      if (ruleIds.length > 0) {
        return chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: ruleIds
        });
      }
    })
    .then(() => {
      // Now get the current settings
      return new Promise((resolve) => {
        chrome.storage.local.get(['blockedSites', 'blockingEnabled', 'siteStates'], resolve);
      });
    })
    .then(result => {
      const isEnabled = result.blockingEnabled !== false;
      const sites = result.blockedSites || ['twitter.com', 'x.com'];
      const siteStates = result.siteStates || {};

      // If blocking is disabled globally, we're done (all rules removed)
      if (!isEnabled) {
        console.log('Blocking is disabled, all rules cleared');
        isUpdatingRules = false;
        return;
      }

      // Create rules for each enabled site
      const rules = [];
      let ruleId = 1;

      sites.forEach(site => {
        // Skip if site is explicitly disabled (false)
        if (siteStates[site] === false) {
          console.log(`Site ${site} is toggled OFF, not blocking`);
          return;
        }

        console.log(`Adding block rule for ${site}`);
        rules.push({
          id: ruleId++,
          priority: 2000,
          action: { type: "block" },
          condition: {
            urlFilter: site,
            resourceTypes: [
              "main_frame", "sub_frame", "stylesheet", "script", "image",
              "font", "object", "xmlhttprequest", "ping", "csp_report",
              "media", "websocket", "other"
            ]
          }
        });
      });

      // Only add rules if there are any
      if (rules.length > 0) {
        return chrome.declarativeNetRequest.updateDynamicRules({
          addRules: rules
        });
      }
    })
    .then(() => {
      console.log('Rules updated successfully');
      isUpdatingRules = false;
    })
    .catch(error => {
      console.error('Error updating rules:', error);
      isUpdatingRules = false;
    });
}

// Wait for a short delay before initializing rules
// This helps avoid race conditions during extension startup
setTimeout(() => {
  console.log('Initializing rules after startup delay');
  updateDynamicRules();
}, 500);

// Listen for changes in storage to update rules
chrome.storage.onChanged.addListener(function(changes, namespace) {
  if (namespace === 'local' &&
      (changes.blockingEnabled || changes.blockedSites || changes.siteStates)) {
    console.log('Settings changed, updating rules');
    updateDynamicRules();
  }
});