document.addEventListener("DOMContentLoaded", function () {
    const cookieBanner = document.getElementById("cookie-banner");
    const acceptBtn = document.getElementById("accept-cookies");
    const declineBtn = document.getElementById("decline-cookies");

    // Check if user has already made a choice
    const cookieConsent = localStorage.getItem("cookieConsent");

    // If no choice exists in localStorage, show the banner
    if (!cookieConsent) {
        cookieBanner.classList.remove("hidden");
    }

    // User accepts cookies
    acceptBtn.addEventListener("click", function () {
        localStorage.setItem("cookieConsent", "accepted");
        cookieBanner.classList.add("hidden");
        // Trigger your tracking scripts here (e.g., Google Analytics)
    });

    // User declines cookies
    declineBtn.addEventListener("click", function () {
        localStorage.setItem("cookieConsent", "declined");
        cookieBanner.classList.add("hidden");
        // Keep tracking scripts disabled
    });
});
