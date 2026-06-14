// Upgrade Patch - Upgrade functionalities for the web project

// Step 1: Optimize 'Forgot Password' workflow
function sendPasswordResetEmail(email) {
    const link = `https://example.com/reset-password?token=${generateSecureToken()}`;
    // Simulated email sending - replace with real implementation
    console.log(`Reset password link sent to ${email}: ${link}`);
}

function generateSecureToken() {
    return Math.random().toString(36).substring(2);
}

// Step 2: Sync avatar updates
function updateAvatar(newAvatarUrl) {
    // Sync to community forum API (mock implementation)
    console.log('Syncing avatar to community forum: ', newAvatarUrl);

    // Update all components displaying the avatar
    document.querySelectorAll('.user-avatar').forEach(avatar => {
        avatar.src = newAvatarUrl;
    });
}

// Step 3: Add like functionality
const likes = {};

function setupImageLikes() {
    document.querySelectorAll('img').forEach(img => {
        const likeBtn = document.createElement('button');
        likeBtn.innerText = '\u2764 Like';
        likeBtn.classList.add('like-button');

        // Prevent duplicate likes in session
        likeBtn.addEventListener('click', () => {
            if (!likes[img.src]) {
                likes[img.src] = 1;
                localStorage.setItem(img.src, 1);
            }
        });

        img.parentElement.appendChild(likeBtn);
    });
}

// Step 4: Set up banner click navigation
function setupBannerNavigation() {
    document.querySelectorAll('.banner img').forEach(banner => {
        banner.addEventListener('click', () => {
            window.location.href = `detail.html?imageId=${banner.dataset.imageId}`;
        });
    });
}

// Step 5: Global image protection
document.querySelectorAll('img').forEach(img => {
    img.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
});

// Apply CSS for mobile
const style = document.createElement('style');
style.textContent = `img {\n    -webkit-touch-callout: none;\n    user-select: none;\n}`;
document.head.appendChild(style);

// Initialize features on document ready
document.addEventListener('DOMContentLoaded', () => {
    setupImageLikes();
    setupBannerNavigation();
});