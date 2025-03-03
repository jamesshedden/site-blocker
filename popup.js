// DOM elements
const masterToggle = document.getElementById('masterToggle');
const statusText = document.getElementById('statusText');
const siteList = document.getElementById('siteList');
const newSiteInput = document.getElementById('newSite');
const addSiteBtn = document.getElementById('addSiteBtn');

// Default sites to block
const DEFAULT_SITES = ['twitter.com', 'x.com'];

// Initialize the UI
function initializeUI() {
  // Load master toggle state and site states
  chrome.storage.local.get(['blockingEnabled', 'blockedSites', 'siteStates'], function(result) {
    // Default to enabled if not set
    const isEnabled = result.blockingEnabled !== false;
    masterToggle.checked = isEnabled;
    updateStatusText(isEnabled);

    // Load blocked sites or use defaults
    const sites = result.blockedSites || DEFAULT_SITES;
    const siteStates = result.siteStates || {};

    console.log('Sites loaded:', sites);
    renderSiteList(sites, siteStates);
  });
}

// Render the list of blocked sites
function renderSiteList(sites, siteStates) {
  siteList.innerHTML = '';

  console.log('Rendering site list:', sites);

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

    siteItem.appendChild(siteName);
    siteItem.appendChild(toggleContainer);
    siteItem.appendChild(deleteBtn);

    siteList.appendChild(siteItem);
  });
}

// Handle master toggle changes
masterToggle.addEventListener('change', function() {
  const isEnabled = masterToggle.checked;

  // Save the state
  chrome.storage.local.set({blockingEnabled: isEnabled}, function() {
    updateStatusText(isEnabled);
    updateRules();
  });
});

// Handle site toggle changes
function handleSiteToggle(event) {
  const site = event.target.dataset.site;
  const isEnabled = event.target.checked;

  console.log(`Toggle site ${site} to ${isEnabled ? 'ON' : 'OFF'}`);

  chrome.storage.local.get(['siteStates'], function(result) {
    const siteStates = result.siteStates || {};
    siteStates[site] = isEnabled;

    console.log('Updated siteStates:', siteStates);

    chrome.storage.local.set({siteStates: siteStates}, function() {
      updateRules();
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

// Update the status text
function updateStatusText(isEnabled) {
  statusText.textContent = isEnabled ?
    "Blocking is ON" :
    "Blocking is OFF";
  statusText.style.color = isEnabled ? "#4CAF50" : "#F44336";
}

// Update the blocking rules
function updateRules() {
  chrome.runtime.sendMessage({action: "updateRules"});
}

// Initialize the UI when popup opens
document.addEventListener('DOMContentLoaded', initializeUI);