// Content script for element blocking

// Function to hide elements based on the current domain
function hideElements() {
  // Get the current domain
  const currentDomain = window.location.hostname;

  // Get blocked elements from storage
  chrome.storage.local.get(['blockedElements', 'elementStates'], function(result) {
    const blockedElements = result.blockedElements || [];
    const elementStates = result.elementStates || {};

    // Filter elements for the current domain
    const domainElements = blockedElements.filter(el => {
      const elementKey = `${el.domain}:${el.selector}`;
      return currentDomain.includes(el.domain) && elementStates[elementKey] !== false;
    });

    if (domainElements.length === 0) {
      return;
    }

    console.log(`Hiding elements for domain: ${currentDomain}`);

    // Hide each element
    domainElements.forEach(element => {
      try {
        // Clean up the selector if it contains JavaScript code
        let cleanSelector = element.selector;

        // Check if the selector contains JavaScript code
        if (cleanSelector.includes('document.querySelector') ||
            cleanSelector.includes('document.querySelectorAll') ||
            cleanSelector.includes('querySelector(') ||
            cleanSelector.includes('querySelectorAll(')) {

          // Extract the actual CSS selector from the JavaScript code
          const match = cleanSelector.match(/['"]([^'"]+)['"]/);
          if (match && match[1]) {
            cleanSelector = match[1];
            console.log(`Extracted selector: ${cleanSelector} from JavaScript code`);
          } else {
            console.error(`Could not extract valid selector from: ${cleanSelector}`);
            return;
          }
        }

        const elements = document.querySelectorAll(cleanSelector);
        console.log(`Found ${elements.length} elements matching selector: ${cleanSelector}`);

        elements.forEach(el => {
          el.style.display = 'none';
        });
      } catch (error) {
        console.error(`Error hiding elements with selector "${element.selector}":`, error);
      }
    });
  });
}

// Run when the page loads
document.addEventListener('DOMContentLoaded', function() {
  // Wait a bit for the page to fully load
  setTimeout(hideElements, 500);
});

// Also run after a longer delay to catch dynamically loaded content
setTimeout(hideElements, 2000);

// Listen for messages from the background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "hideElements") {
    hideElements();
    sendResponse({status: "Elements hidden"});
  }
});