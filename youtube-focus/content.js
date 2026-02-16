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

    hideShortsSidebar();
}

// Aggressively hide Shorts from sidebar (JS backup for CSS)
function hideShortsSidebar() {
    if (!SETTINGS.blockShorts) return;

    const terms = ['shorts', 'cortos']; // Multilanguage support just in case

    // Desktop Sidebar
    document.querySelectorAll('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer').forEach(entry => {
        const text = entry.textContent?.trim().toLowerCase();
        if (text && terms.some(term => text === term)) {
            entry.style.display = 'none';
        }
    });

    // Mobile/Responsive "Bottom Bar" or other navs
    document.querySelectorAll('ytm-pivot-bar-item-renderer, ytd-pivot-bar-item-renderer').forEach(item => {
        const text = item.textContent?.trim().toLowerCase();
        if (text && terms.some(term => text === term)) {
            item.style.display = 'none';
        }
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

// Resizing can trigger YouTube to re-render or move elements, potentially showing NaN states
window.addEventListener('resize', () => {
    if (SETTINGS.hideSecondary) {
        movePlaylist();
    }
});

function movePlaylist() {
    // Only move if we are hiding secondary content, otherwise let it be (or move back? complex to move back without placeholder)
    if (SETTINGS.hideSecondary) {
        // Try to find playlist in secondary OR already moved to below
        let playlist = document.querySelector('#secondary #playlist') || document.querySelector('#below #playlist');
        const below = document.querySelector('#below');
        const comments = document.querySelector('#comments');

        if (playlist) {
            // Check validity
            // User reports "NaN / NaN". This suggests broken data binding or empty list.
            const text = playlist.textContent || "";
            // Regex for NaN / NaN with optional spaces
            const isInvalid = /NaN\s*\/\s*NaN/.test(text) || text.trim().length === 0;

            if (isInvalid) {
                playlist.style.setProperty('display', 'none', 'important');
                // If it's invalid and in #below, it might be stale.
                return;
            } else {
                // Only unhide if it was hidden by us AND is now valid
                if (playlist.style.display === 'none') {
                    playlist.style.display = '';
                }
            }

            // If valid (so far), observe it for future text changes (e.g. data binding updates)
            if (!playlist.dataset.yfObserved) {
                playlist.dataset.yfObserved = 'true';
                const textObserver = new MutationObserver(() => {
                    const currentText = playlist.textContent || "";
                    if (/NaN\s*\/\s*NaN/.test(currentText)) {
                        playlist.style.setProperty('display', 'none', 'important');
                    } else {
                        // If it fixed itself, show it!
                        if (playlist.style.display === 'none') {
                            playlist.style.display = '';
                        }
                    }
                });
                textObserver.observe(playlist, {
                    subtree: true,
                    characterData: true,
                    childList: true
                });
            }

            if (!below) return;

            // Move logic: if it's not already in #below
            if (playlist.parentElement.id !== 'below') {
                if (comments && below.contains(comments)) {
                    below.insertBefore(playlist, comments);
                } else {
                    below.appendChild(playlist);
                }
                playlist.style.marginBottom = '20px'; // Add some spacing
            }
        }
    }

    // Check for stale duplicate playlists
    const belowPlaylist = document.querySelector('#below #playlist');
    const secondaryPlaylist = document.querySelector('#secondary #playlist');

    // If we have one in secondary AND one in below, the below one is definitely stale/duplicate. Remove it.
    if (belowPlaylist && secondaryPlaylist && belowPlaylist !== secondaryPlaylist) {
        belowPlaylist.remove();
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

function handleFullscreen() {
    const isFullscreen = !!document.fullscreenElement;
    const body = document.body;

    if (isFullscreen) {
        body.classList.add('yf-fullscreen-active');

        // Restore playlist to secondary if it was moved
        const playlist = document.querySelector('#below #playlist');
        const secondary = document.querySelector('#secondary');

        if (playlist && secondary) {
            // Remove styles added by us
            playlist.style.marginBottom = '';
            // If we hid it due to NaN check but now want to show it (or let YouTube handle it)
            // playlist.style.display = ''; // careful, don't show broken ones? 
            // If it's broken, keep it hidden?
            // Let's assume native fullscreen needs it clean.

            secondary.prepend(playlist);
        }

        // Disable our sidebar hiding in fullscreen to let native UI work (which usually hides sidebar anyway unless toggled)
        body.classList.remove('yf-hide-secondary');

    } else {
        body.classList.remove('yf-fullscreen-active');

        // Restore settings
        updateBodyClasses();

        // Move playlist back to below if settings enabled
        if (SETTINGS.hideSecondary) {
            movePlaylist();
        }
    }
}

document.addEventListener('fullscreenchange', handleFullscreen);