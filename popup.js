// DOM elements
const siteList = document.getElementById('siteList');
const newSiteInput = document.getElementById('newSite');
const addSiteBtn = document.getElementById('addSiteBtn');
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
const elementDomainInput = document.getElementById('elementDomain');
const elementSelectorInput = document.getElementById('elementSelector');
const addElementBtn = document.getElementById('addElementBtn');
const elementList = document.getElementById('elementList');
const autoToggleTimeInput = document.getElementById('autoToggleTime');
const debugInfo = document.getElementById('debugInfo');
const refreshDebugBtn = document.getElementById('refreshDebugBtn');
const checkAutoToggleBtn = document.getElementById('checkAutoToggleBtn');
const simulateTimeInput = document.getElementById('simulateTimeInput');
const simulateTimeBtn = document.getElementById('simulateTimeBtn');

// Default sites to block
const DEFAULT_SITES = ['twitter.com', 'x.com'];
// Default auto-toggle time in minutes
const DEFAULT_AUTO_TOGGLE_TIME = 2;

// Initialize the UI
function initializeUI() {
  // Load site states
  chrome.storage.local.get(['blockedSites', 'siteStates', 'blockedElements', 'elementStates', 'autoToggleTime', 'autoToggleSchedules'], function(result) {
    // Load blocked sites or use defaults
    const sites = result.blockedSites || DEFAULT_SITES;
    const siteStates = result.siteStates || {};

    console.log('Sites loaded:', sites);
    renderSiteList(sites, siteStates, result.autoToggleSchedules || {});

    // Load blocked elements
    const blockedElements = result.blockedElements || [];
    const elementStates = result.elementStates || {};
    console.log('Blocked elements loaded:', blockedElements);
    renderElementList(blockedElements, elementStates);

    // Load auto-toggle time setting
    const autoToggleTime = result.autoToggleTime || DEFAULT_AUTO_TOGGLE_TIME;
    autoToggleTimeInput.value = autoToggleTime;

    // Update debug info
    updateDebugInfo();
  });

  // Set up tab switching
  setupTabs();

  // Set up auto-toggle time input
  setupAutoToggleTime();

  // Listen for auto-toggle messages from background script
  setupAutoToggleListener();

  // Set up debug refresh button
  setupDebugRefresh();

  // Set up check auto-toggle button
  setupCheckAutoToggle();

  // Set up simulate time button
  setupSimulateTime();
}

// Set up simulate time button
function setupSimulateTime() {
  simulateTimeBtn.addEventListener('click', function() {
    const minutes = parseInt(simulateTimeInput.value);

    if (isNaN(minutes) || minutes < 1) {
      alert('Please enter a valid number of minutes');
      return;
    }

    console.log(`Simulating ${minutes} minutes passing`);

    // Send message to background script to simulate time passing
    chrome.runtime.sendMessage({action: "simulateTimePassing", minutes: minutes}, function(response) {
      console.log('Time simulation response:', response);

      // Update debug info after a short delay to allow the background script to process
      setTimeout(updateDebugInfo, 500);
    });
  });
}

// Set up check auto-toggle button
function setupCheckAutoToggle() {
  checkAutoToggleBtn.addEventListener('click', function() {
    console.log('Manually triggering auto-toggle check');

    // Send message to background script to check auto-toggle
    chrome.runtime.sendMessage({action: "checkAutoToggle"}, function(response) {
      console.log('Auto-toggle check response:', response);

      // Update debug info after a short delay to allow the background script to process
      setTimeout(updateDebugInfo, 500);
    });
  });
}

// Set up debug refresh button
function setupDebugRefresh() {
  refreshDebugBtn.addEventListener('click', function() {
    updateDebugInfo();
  });
}

// Update debug information
function updateDebugInfo() {
  chrome.storage.local.get(['siteStates', 'autoToggleSchedules', 'autoToggleTime'], function(result) {
    const siteStates = result.siteStates || {};
    const schedules = result.autoToggleSchedules || {};
    const autoToggleTime = result.autoToggleTime || DEFAULT_AUTO_TOGGLE_TIME;
    const currentTime = Date.now();

    let debugText = `Current time: ${new Date(currentTime).toLocaleString()}\n`;
    debugText += `Auto-toggle time setting: ${autoToggleTime} minutes\n\n`;
    debugText += `Site States:\n`;

    for (const site in siteStates) {
      debugText += `${site}: ${siteStates[site] ? 'Enabled' : 'Disabled'}\n`;
    }

    debugText += `\nAuto-toggle Schedules:\n`;

    if (Object.keys(schedules).length === 0) {
      debugText += `No active schedules\n`;
    } else {
      for (const site in schedules) {
        const scheduledTime = schedules[site];
        const timeRemaining = Math.max(0, scheduledTime - currentTime);
        const minutesRemaining = Math.ceil(timeRemaining / 60000);

        debugText += `${site}: Scheduled for ${new Date(scheduledTime).toLocaleString()}\n`;
        debugText += `  Time remaining: ${minutesRemaining} minutes\n`;
      }
    }

    debugInfo.textContent = debugText;
  });
}

// Set up listener for auto-toggle messages
function setupAutoToggleListener() {
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.action === "autoToggleApplied") {
      console.log('Received auto-toggle applied message:', message);

      // Refresh the UI to show updated site states
      chrome.storage.local.get(['blockedSites', 'siteStates', 'autoToggleSchedules'], function(result) {
        const sites = result.blockedSites || DEFAULT_SITES;
        const siteStates = result.siteStates || {};
        const schedules = result.autoToggleSchedules || {};

        renderSiteList(sites, siteStates, schedules);
        updateDebugInfo();
      });
    }
  });
}

// Set up auto-toggle time input
function setupAutoToggleTime() {
  autoToggleTimeInput.addEventListener('change', function() {
    const time = parseInt(autoToggleTimeInput.value);

    // Validate input
    if (isNaN(time) || time < 1) {
      autoToggleTimeInput.value = DEFAULT_AUTO_TOGGLE_TIME;
      return;
    }

    // Save the setting
    chrome.storage.local.set({autoToggleTime: time}, function() {
      console.log(`Auto-toggle time set to ${time} minutes`);
    });
  });
}

// Set up tab switching functionality
function setupTabs() {
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active class from all tabs and tab contents
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      // Add active class to clicked tab and corresponding content
      tab.classList.add('active');
      const tabId = tab.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
    });
  });
}

// Render the list of blocked sites
function renderSiteList(sites, siteStates, schedules) {
  siteList.innerHTML = '';

  console.log('Rendering site list:', sites);
  console.log('Site states:', siteStates);
  console.log('Auto-toggle schedules:', schedules);

  if (!sites || sites.length === 0) {
    siteList.innerHTML = '<p>No sites are currently blocked.</p>';
    return;
  }

  sites.forEach(site => {
    const siteItem = document.createElement('div');
    siteItem.className = 'site-item';

    const siteName = document.createElement('div');
    siteName.className = 'site-name';
    siteName.textContent = site;

    // Create a container for the toggle and auto-toggle indicator
    const toggleWrapper = document.createElement('div');
    toggleWrapper.className = 'toggle-wrapper';
    toggleWrapper.style.display = 'flex';
    toggleWrapper.style.alignItems = 'center';
    toggleWrapper.style.gap = '10px';

    // Add auto-toggle indicator if scheduled
    let autoToggleIndicator = null;
    if (schedules && schedules[site]) {
      const scheduledTime = schedules[site];
      const timeRemaining = Math.max(0, scheduledTime - Date.now());
      const minutesRemaining = Math.ceil(timeRemaining / 60000);

      autoToggleIndicator = document.createElement('div');
      autoToggleIndicator.className = 'auto-toggle-indicator';
      autoToggleIndicator.textContent = `Auto-enables in ${minutesRemaining} min`;
      autoToggleIndicator.style.fontSize = '12px';
      autoToggleIndicator.style.color = '#666';
    }

    const toggleContainer = document.createElement('label');
    toggleContainer.className = 'switch';

    const toggleInput = document.createElement('input');
    toggleInput.type = 'checkbox';
    toggleInput.checked = siteStates[site] !== false;
    toggleInput.dataset.site = site;
    toggleInput.addEventListener('change', handleSiteToggle);

    const toggleSlider = document.createElement('span');
    toggleSlider.className = 'slider';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = 'X';
    deleteBtn.dataset.site = site;
    deleteBtn.addEventListener('click', handleSiteDelete);

    toggleContainer.appendChild(toggleInput);
    toggleContainer.appendChild(toggleSlider);

    // Add elements to the toggle wrapper in the correct order
    if (autoToggleIndicator) {
      toggleWrapper.appendChild(autoToggleIndicator);
    }
    toggleWrapper.appendChild(toggleContainer);

    siteItem.appendChild(siteName);
    siteItem.appendChild(toggleWrapper);
    siteItem.appendChild(deleteBtn);

    siteList.appendChild(siteItem);
  });
}

// Render the list of blocked elements
function renderElementList(elements, elementStates) {
  elementList.innerHTML = '';

  console.log('Rendering element list:', elements);

  if (!elements || elements.length === 0) {
    elementList.innerHTML = '<p>No elements are currently blocked.</p>';
    return;
  }

  elements.forEach((element, index) => {
    const elementItem = document.createElement('div');
    elementItem.className = 'element-item';

    const domainElement = document.createElement('div');
    domainElement.className = 'element-domain';
    domainElement.textContent = element.domain;

    const selectorElement = document.createElement('div');
    selectorElement.className = 'element-selector';
    selectorElement.textContent = element.selector;

    const actionsElement = document.createElement('div');
    actionsElement.className = 'element-actions';

    const toggleContainer = document.createElement('label');
    toggleContainer.className = 'switch';

    const toggleInput = document.createElement('input');
    toggleInput.type = 'checkbox';
    const elementKey = `${element.domain}:${element.selector}`;
    toggleInput.checked = elementStates[elementKey] !== false;
    toggleInput.dataset.index = index;
    toggleInput.addEventListener('change', handleElementToggle);

    const toggleSlider = document.createElement('span');
    toggleSlider.className = 'slider';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = 'X';
    deleteBtn.dataset.index = index;
    deleteBtn.addEventListener('click', handleElementDelete);

    toggleContainer.appendChild(toggleInput);
    toggleContainer.appendChild(toggleSlider);

    actionsElement.appendChild(toggleContainer);
    actionsElement.appendChild(deleteBtn);

    elementItem.appendChild(domainElement);
    elementItem.appendChild(selectorElement);
    elementItem.appendChild(actionsElement);

    elementList.appendChild(elementItem);
  });
}

// Handle site toggle changes
function handleSiteToggle(event) {
  const site = event.target.dataset.site;
  const isEnabled = event.target.checked;

  console.log(`Toggle site ${site} to ${isEnabled ? 'ON' : 'OFF'}`);

  chrome.storage.local.get(['siteStates', 'autoToggleTime', 'autoToggleSchedules'], function(result) {
    const siteStates = result.siteStates || {};
    siteStates[site] = isEnabled;

    // If site is being toggled off, schedule auto-toggle
    if (!isEnabled) {
      const autoToggleTime = result.autoToggleTime || DEFAULT_AUTO_TOGGLE_TIME;
      scheduleAutoToggle(site, autoToggleTime);
    } else {
      // If site is being toggled on, remove any existing schedule
      const schedules = result.autoToggleSchedules || {};
      if (schedules[site]) {
        delete schedules[site];
        chrome.storage.local.set({autoToggleSchedules: schedules}, function() {
          console.log(`Removed auto-toggle schedule for ${site}`);
        });
      }
    }

    console.log('Updated siteStates:', siteStates);

    chrome.storage.local.set({siteStates: siteStates}, function() {
      updateRules();

      // Refresh the UI to show updated states
      chrome.storage.local.get(['blockedSites', 'autoToggleSchedules'], function(result) {
        const sites = result.blockedSites || DEFAULT_SITES;
        const schedules = result.autoToggleSchedules || {};
        renderSiteList(sites, siteStates, schedules);
        updateDebugInfo();
      });
    });
  });
}

// Schedule auto-toggle for a site
function scheduleAutoToggle(site, minutes) {
  console.log(`Scheduling auto-toggle for ${site} in ${minutes} minutes`);

  // Store the scheduled time
  const scheduledTime = Date.now() + (minutes * 60 * 1000);

  chrome.storage.local.get(['autoToggleSchedules'], function(result) {
    const schedules = result.autoToggleSchedules || {};
    schedules[site] = scheduledTime;

    chrome.storage.local.set({autoToggleSchedules: schedules}, function() {
      console.log(`Auto-toggle scheduled for ${site} at ${new Date(scheduledTime).toLocaleString()}`);

      // Show a notification to the user
      const notification = document.createElement('div');
      notification.className = 'notification';
      notification.textContent = `${site} will be unblocked in ${minutes} minutes`;
      notification.style.position = 'fixed';
      notification.style.bottom = '10px';
      notification.style.left = '10px';
      notification.style.right = '10px';
      notification.style.backgroundColor = '#4CAF50';
      notification.style.color = 'white';
      notification.style.padding = '10px';
      notification.style.borderRadius = '4px';
      notification.style.zIndex = '1000';

      document.body.appendChild(notification);

      // Remove the notification after 5 seconds
      setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.5s';
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 500);
      }, 5000);
    });
  });
}

// Handle site deletion
function handleSiteDelete(event) {
  const siteToDelete = event.target.dataset.site;

  chrome.storage.local.get(['blockedSites', 'siteStates'], function(result) {
    let sites = result.blockedSites || DEFAULT_SITES;
    const siteStates = result.siteStates || {};

    // Remove the site
    sites = sites.filter(site => site !== siteToDelete);
    delete siteStates[siteToDelete];

    // Update storage
    chrome.storage.local.set({
      blockedSites: sites,
      siteStates: siteStates
    }, function() {
      renderSiteList(sites, siteStates);
      updateRules();
    });
  });
}

// Handle element toggle changes
function handleElementToggle(event) {
  const index = parseInt(event.target.dataset.index);
  const isEnabled = event.target.checked;

  chrome.storage.local.get(['blockedElements', 'elementStates'], function(result) {
    const elements = result.blockedElements || [];
    const elementStates = result.elementStates || {};

    if (index >= 0 && index < elements.length) {
      const element = elements[index];
      const elementKey = `${element.domain}:${element.selector}`;
      elementStates[elementKey] = isEnabled;

      console.log(`Toggle element ${elementKey} to ${isEnabled ? 'ON' : 'OFF'}`);

      chrome.storage.local.set({elementStates: elementStates}, function() {
        updateRules();
      });
    }
  });
}

// Handle element deletion
function handleElementDelete(event) {
  const index = parseInt(event.target.dataset.index);

  chrome.storage.local.get(['blockedElements', 'elementStates'], function(result) {
    let elements = result.blockedElements || [];
    let elementStates = result.elementStates || {};

    if (index >= 0 && index < elements.length) {
      const element = elements[index];
      const elementKey = `${element.domain}:${element.selector}`;

      // Remove the element
      elements.splice(index, 1);
      delete elementStates[elementKey];

      // Update storage
      chrome.storage.local.set({
        blockedElements: elements,
        elementStates: elementStates
      }, function() {
        renderElementList(elements, elementStates);
        updateRules();
      });
    }
  });
}

// Add a new site
addSiteBtn.addEventListener('click', function() {
  const newSite = newSiteInput.value.trim();

  if (!newSite) {
    return;
  }

  // Format the domain (remove http://, www., etc.)
  let formattedSite = newSite.toLowerCase();
  formattedSite = formattedSite.replace(/^(https?:\/\/)?(www\.)?/, '');
  formattedSite = formattedSite.split('/')[0]; // Remove any paths

  chrome.storage.local.get(['blockedSites', 'siteStates'], function(result) {
    let sites = result.blockedSites || DEFAULT_SITES;
    const siteStates = result.siteStates || {};

    // Check if site already exists
    if (sites.includes(formattedSite)) {
      alert('This site is already in your block list.');
      return;
    }

    // Add the new site
    sites.push(formattedSite);

    // Update storage
    chrome.storage.local.set({blockedSites: sites}, function() {
      newSiteInput.value = '';
      renderSiteList(sites, siteStates);
      updateRules();
    });
  });
});

// Add a new element to block
addElementBtn.addEventListener('click', function() {
  const domain = elementDomainInput.value.trim();
  const selector = elementSelectorInput.value.trim();

  if (!domain || !selector) {
    alert('Please enter both domain and element selector.');
    return;
  }

  // Format the domain (remove http://, www., etc.)
  let formattedDomain = domain.toLowerCase();
  formattedDomain = formattedDomain.replace(/^(https?:\/\/)?(www\.)?/, '');
  formattedDomain = formattedDomain.split('/')[0]; // Remove any paths

  chrome.storage.local.get(['blockedElements'], function(result) {
    let elements = result.blockedElements || [];

    // Check if element already exists
    const elementExists = elements.some(el =>
      el.domain === formattedDomain && el.selector === selector
    );

    if (elementExists) {
      alert('This element is already in your block list.');
      return;
    }

    // Add the new element
    elements.push({
      domain: formattedDomain,
      selector: selector
    });

    // Update storage
    chrome.storage.local.set({blockedElements: elements}, function() {
      elementDomainInput.value = '';
      elementSelectorInput.value = '';
      renderElementList(elements);
      updateRules();
    });
  });
});

// Update the blocking rules
function updateRules() {
  chrome.runtime.sendMessage({action: "updateRules"});
}

// Initialize the UI when popup opens
document.addEventListener('DOMContentLoaded', initializeUI);