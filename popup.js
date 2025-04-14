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

// Default sites to block
const DEFAULT_SITES = ['twitter.com', 'x.com'];

// Initialize the UI
function initializeUI() {
  // Load site states
  chrome.storage.local.get(['blockedSites', 'siteStates', 'blockedElements', 'elementStates'], function(result) {
    // Load blocked sites or use defaults
    const sites = result.blockedSites || DEFAULT_SITES;
    const siteStates = result.siteStates || {};

    console.log('Sites loaded:', sites);
    renderSiteList(sites, siteStates);

    // Load blocked elements
    const blockedElements = result.blockedElements || [];
    const elementStates = result.elementStates || {};
    console.log('Blocked elements loaded:', blockedElements);
    renderElementList(blockedElements, elementStates);
  });

  // Set up tab switching
  setupTabs();
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