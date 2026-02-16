const SETTINGS = {
    blockShorts: true,
    hideComments: true,
    hideSecondary: true
};

function updateBodyClasses() {
    if (SETTINGS.blockShorts) document.body.classList.add('yf-block-shorts');
    else document.body.classList.remove('yf-block-shorts');

    if (SETTINGS.hideComments) document.body.classList.add('yf-hide-comments');
    else document.body.classList.remove('yf-hide-comments');

    if (SETTINGS.hideSecondary) document.body.classList.add('yf-hide-secondary');
    else document.body.classList.remove('yf-hide-secondary');
}

function loadSettings() {
    chrome.storage.local.get(['blockShorts', 'hideComments', 'hideSecondary'], (result) => {
        // Set defaults if undefined
        SETTINGS.blockShorts = result.blockShorts !== false;
        SETTINGS.hideComments = result.hideComments !== false;
        SETTINGS.hideSecondary = result.hideSecondary !== false;
        updateBodyClasses();
    });
}

// Listen for changes from popup
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
        if (changes.blockShorts) SETTINGS.blockShorts = changes.blockShorts.newValue;
        if (changes.hideComments) SETTINGS.hideComments = changes.hideComments.newValue;
        if (changes.hideSecondary) SETTINGS.hideSecondary = changes.hideSecondary.newValue;
        updateBodyClasses();
    }
});

// Initial load
loadSettings();

// Observer to handle dynamic content loading if CSS isn't enough (extra safety)
// Specifically looking for "Shorts" title in shelves that might not have distinct classes.
function markShortsShelves() {
    // Find all potential shelf titles
    const shelfTitles = document.querySelectorAll('ytd-rich-shelf-renderer span#title');

    shelfTitles.forEach(title => {
        if (title.textContent.trim().toLowerCase() === 'shorts') {
            // Find the parent shelf container
            const shelf = title.closest('ytd-rich-shelf-renderer');
            if (shelf) {
                shelf.classList.add('yf-marked-shorts-shelf');
            }
            // Also handle section renderers that might wrap it
            const section = title.closest('ytd-rich-section-renderer');
            if (section) {
                section.classList.add('yf-marked-shorts-shelf');
            }
        }
    });

    // Also look for reel shelves directly if they exist and mark them
    document.querySelectorAll('ytd-reel-shelf-renderer').forEach(el => {
        el.classList.add('yf-marked-shorts-shelf');
    });
}

// Run the marker logic periodically or on mutation
const observer = new MutationObserver((mutations) => {
    // Check if nodes were added
    let shouldCheck = false;
    for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
            shouldCheck = true;
            break;
        }
    }

    if (shouldCheck) {
        markShortsShelves();
    }
});

function startObserver() {
    const content = document.body;
    if (content) {
        observer.observe(content, {
            childList: true,
            subtree: true
        });
        markShortsShelves(); // Initial check
        updateBodyClasses(); // Ensure classes are applied
    } else {
        setTimeout(startObserver, 100);
    }
}

// Start everything
startObserver();

// Monitor navigation
document.addEventListener('yt-navigate-finish', () => {
    updateBodyClasses();
    markShortsShelves();
    movePlaylist();
});

function movePlaylist() {
    // Only move if we are hiding secondary content, otherwise let it be (or move back? complex to move back without placeholder)
    // For now, let's just move it if it exists in secondary and we want to save it
    if (SETTINGS.hideSecondary) {
        const playlist = document.querySelector('#secondary #playlist');
        const below = document.querySelector('#below');
        const comments = document.querySelector('#comments');

        if (playlist && below) {
            // Move playlist to #below, before comments if possible
            if (comments && below.contains(comments)) {
                below.insertBefore(playlist, comments);
            } else {
                below.appendChild(playlist);
            }
            playlist.style.marginBottom = '20px'; // Add some spacing
        }
    }
}

// Update observer to check for playlist
const playlistObserver = new MutationObserver((mutations) => {
    if (SETTINGS.hideSecondary) {
        movePlaylist();
    }
});

function startPlaylistObserver() {
    const app = document.querySelector('ytd-app');
    if (app) {
        playlistObserver.observe(app, {
            childList: true,
            subtree: true
        });
        movePlaylist();
    } else {
        setTimeout(startPlaylistObserver, 1000);
    }
}

startPlaylistObserver();