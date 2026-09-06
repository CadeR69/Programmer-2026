// Accessible mobile nav toggle
//
// Below the 640px breakpoint (see css/navigation.css) the nav collapses
// behind a hamburger button. This wires that button up: keyboard-operable,
// closes on Escape (returning focus to the button), closes after a link is
// used, and collapses back to the desktop layout if the window is resized
// past the breakpoint while open.
(function () {
    function initNav() {
        var toggle = document.getElementById("navToggle");
        var nav = document.getElementById("siteNav");
        if (!toggle || !nav) return;

        function isOpen() {
            return nav.classList.contains("is-open");
        }
        function openNav() {
            nav.classList.add("is-open");
            toggle.setAttribute("aria-expanded", "true");
        }
        function closeNav() {
            nav.classList.remove("is-open");
            toggle.setAttribute("aria-expanded", "false");
        }

        toggle.addEventListener("click", function () {
            if (isOpen()) {
                closeNav();
            } else {
                openNav();
            }
        });

        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && isOpen()) {
                closeNav();
                toggle.focus();
            }
        });

        nav.addEventListener("click", function (e) {
            if (e.target.tagName === "A") closeNav();
        });

        var mq = window.matchMedia("(min-width: 641px)");
        function handleBreakpointChange(e) {
            if (e.matches) closeNav();
        }
        if (mq.addEventListener) {
            mq.addEventListener("change", handleBreakpointChange);
        } else if (mq.addListener) {
            mq.addListener(handleBreakpointChange); // older Safari
        }
    }

    window.MPNav = { init: initNav };
})();
