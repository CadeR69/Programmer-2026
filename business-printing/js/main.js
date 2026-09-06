// Entry point — wires up the mobile nav and enhances any form on the page
// that a page-specific script (like quote-form.js) hasn't already claimed.
document.addEventListener("DOMContentLoaded", function () {
    if (window.MPNav) window.MPNav.init();
    if (window.MPForms) window.MPForms.autoEnhance();
});
