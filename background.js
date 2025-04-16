// Initialize the extension
console.log('Site Blocker extension initialized');

// Flag to prevent concurrent rule updates
let isUpdatingRules = false;

// Set up initial state on installation
chrome.runtime.onInstalled.addListener(function() {
  console.log('Extension installed');

  // Default settings
  const defaultSites = ['twitter.com', 'x.com'];

  chrome.storage.local.get(['blockedSites', 'blockedElements', 'elementStates', 'autoToggleTime'], function(result) {
    // Only set defaults if not already set
    const updates = {};

    if (!result.blockedSites) {
      updates.blockedSites = defaultSites;
    }

    if (result.blockedElements === undefined) {
      updates.blockedElements = [];
    }

    if (result.elementStates === undefined) {
      updates.elementStates = {};
    }

    if (result.autoToggleTime === undefined) {
      updates.autoToggleTime = 2; // Default 2 minutes
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

    // Notify all tabs to update their element blocking
    notifyTabsToUpdateElements();
  } else if (message.action === "checkAutoToggle") {
    console.log('Manually checking auto-toggle schedules');
    checkAutoToggleSchedules();
    sendResponse({status: "Auto-toggle check triggered"});
  } else if (message.action === "simulateTimePassing") {
    console.log('Simulating time passing');
    simulateTimePassing(message.minutes || 2);
    sendResponse({status: "Time simulation triggered"});
  }
});

// Notify all tabs to update their element blocking
function notifyTabsToUpdateElements() {
  chrome.tabs.query({}, function(tabs) {
    tabs.forEach(tab => {
      if (tab.url && tab.url.startsWith('http')) {
        chrome.tabs.sendMessage(tab.id, {action: "hideElements"}, function(response) {
          if (chrome.runtime.lastError) {
            // Content script might not be loaded yet, which is fine
            console.log(`Could not send message to tab ${tab.id}:`, chrome.runtime.lastError);
          } else {
            console.log(`Element hiding message sent to tab ${tab.id}`);
          }
        });
      }
    });
  });
}

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
        chrome.storage.local.get(['blockedSites', 'siteStates'], resolve);
      });
    })
    .then(result => {
      const sites = result.blockedSites || ['twitter.com', 'x.com'];
      const siteStates = result.siteStates || {};

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
      (changes.blockedSites || changes.siteStates || changes.blockedElements)) {
    console.log('Settings changed, updating rules');
    updateDynamicRules();

    // If blocked elements changed, notify tabs
    if (changes.blockedElements) {
      notifyTabsToUpdateElements();
    }
  }
});

// Listen for tab updates to apply element blocking
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
    // Wait a short time for the page to fully load
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, {action: "hideElements"}, function(response) {
        if (chrome.runtime.lastError) {
          // Content script might not be loaded yet, which is fine
          console.log(`Could not send message to tab ${tabId}:`, chrome.runtime.lastError);
        } else {
          console.log(`Element hiding message sent to tab ${tabId}`);
        }
      });
    }, 500);
  }
});

// Check for auto-toggle schedules periodically
function checkAutoToggleSchedules() {
  console.log('Checking auto-toggle schedules...');

  chrome.storage.local.get(['autoToggleSchedules', 'siteStates', 'autoToggleTime'], function(result) {
    const schedules = result.autoToggleSchedules || {};
    const siteStates = result.siteStates || {};
    const currentTime = Date.now();
    let updated = false;

    console.log('Current auto-toggle schedules:', schedules);
    console.log('Current time:', new Date(currentTime).toLocaleString());

    // Check each scheduled site
    for (const site in schedules) {
      const scheduledTime = schedules[site];
      const timeRemaining = scheduledTime - currentTime;

      console.log(`Site: ${site}, Scheduled time: ${new Date(scheduledTime).toLocaleString()}, Time remaining: ${Math.round(timeRemaining / 1000)} seconds`);

      if (scheduledTime <= currentTime) {
        console.log(`Auto-toggle time reached for ${site}`);

        // Toggle the site back on
        siteStates[site] = true;

        // Remove the schedule
        delete schedules[site];

        updated = true;
      }
    }

    // If any sites were toggled, update storage and rules
    if (updated) {
      console.log('Applying auto-toggle changes:', siteStates);

      chrome.storage.local.set({
        siteStates: siteStates,
        autoToggleSchedules: schedules
      }, function() {
        console.log('Auto-toggle applied, updating rules');
        updateDynamicRules();

        // Notify the popup if it's open
        chrome.runtime.sendMessage({
          action: "autoToggleApplied",
          siteStates: siteStates
        }).catch(error => {
          // Popup might not be open, which is fine
          console.log('Could not notify popup:', error);
        });
      });
    } else {
      console.log('No auto-toggles to apply at this time');
    }
  });
}

// Check auto-toggle schedules every 30 seconds for more frequent checks
setInterval(checkAutoToggleSchedules, 30000);

// Also check immediately on startup
setTimeout(checkAutoToggleSchedules, 1000);

// Simulate time passing for testing
function simulateTimePassing(minutes) {
  console.log(`Simulating ${minutes} minutes passing...`);

  chrome.storage.local.get(['autoToggleSchedules'], function(result) {
    const schedules = result.autoToggleSchedules || {};
    const currentTime = Date.now();
    const simulatedTime = currentTime + (minutes * 60 * 1000);

    // Adjust all scheduled times to simulate time passing
    for (const site in schedules) {
      const originalTime = schedules[site];
      const timeElapsed = simulatedTime - currentTime;
      schedules[site] = originalTime - timeElapsed;

      console.log(`Site: ${site}, Original time: ${new Date(originalTime).toLocaleString()}, New time: ${new Date(schedules[site]).toLocaleString()}`);
    }

    // Save the adjusted schedules
    chrome.storage.local.set({autoToggleSchedules: schedules}, function() {
      console.log('Adjusted schedules saved, checking auto-toggle');

      // Check auto-toggle with the adjusted schedules
      checkAutoToggleSchedules();
    });
  });
}