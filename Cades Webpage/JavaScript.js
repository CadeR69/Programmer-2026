// Ensure DOM is fully constructed before binding event listeners
document.addEventListener("DOMContentLoaded", () => {
    initMobileMenu();
    initProjectFilter();
    initContactValidation();
    initProjectViewer();
});

/**
 * 1. Mobile Responsive Navigation Menu Toggle
 */
function initMobileMenu() {
    const menuToggle = document.getElementById("menuToggle");
    const navLinks = document.getElementById("navLinks");

    if (menuToggle && navLinks) {
        menuToggle.addEventListener("click", () => {
            // Toggles navigation tray visibility class on small devices
            navLinks.classList.toggle("active");
        });
    }
}

/**
 * 2. Category Filter Architecture for Projects Gallery
 */
function initProjectFilter() {
    const filterButtons = document.querySelectorAll(".filter-btn");
    const projectCards = document.querySelectorAll(".project-card");

    filterButtons.forEach(button => {
        button.addEventListener("click", (e) => {
            // Manage visual state tracking of active selection filter button
            document.querySelector(".filter-btn.active")?.classList.remove("active");
            e.currentTarget.classList.add("active");

            const selectedFilter = e.currentTarget.getAttribute("data-filter");

            // Evaluate grid components against structural data attributes
            projectCards.forEach(card => {
                const cardCategory = card.getAttribute("data-category");

                if (selectedFilter === "all" || cardCategory === selectedFilter) {
                    card.classList.remove("hidden");
                } else {
                    card.classList.add("hidden");
                }
            });
        });
    });
}

/**
 * 3. Client-Side Contact Form Validation System
 */
function initContactValidation() {
    const form = document.getElementById("contactForm");
    const nameInput = document.getElementById("name");
    const emailInput = document.getElementById("email");

    if (!form) return;

    form.addEventListener("submit", (e) => {
        // Halt native HTTP request cycle execution
        e.preventDefault();

        let isValid = true;

        // Reset runtime error displays
        document.getElementById("nameError").textContent = "";
        document.getElementById("emailError").textContent = "";

        // Validate state boundary requirements for Name input
        if (nameInput.value.trim() === "") {
            document.getElementById("nameError").textContent = "Name field is required.";
            isValid = false;
        }

        // Validate string structural formatting rules for Email input
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailInput.value.trim())) {
            document.getElementById("emailError").textContent = "Please provide a valid email structure.";
            isValid = false;
        }

        // Form submission payload readiness gate
        if (isValid) {
            const formData = {
                name: nameInput.value.trim(),
                email: emailInput.value.trim()
            };

            console.log("Form validation successful. Outbound payload structured:", formData);
            alert(`Thanks ${formData.name}! Your simulated message submission was verified.`);

            form.reset();
        }
    });
}

/**
 * 4. Project Viewer: live preview + source code tabs
 */
function initProjectViewer() {
    const dialog = document.getElementById("projectViewer");
    if (!dialog) return;

    const title = document.getElementById("viewerTitle");
    const tabs = document.getElementById("viewerTabs");
    const frame = document.getElementById("viewerFrame");
    const codeBox = document.getElementById("viewerCode");
    const code = codeBox.querySelector("code");
    let projectUrl = "";

    // Show the running project inside the iframe
    function showPreview() {
        codeBox.hidden = true;
        frame.hidden = false;
        frame.src = projectUrl;
    }

    // Download one file as plain text and show it in the code box
    async function showFile(fileName) {
        frame.hidden = true;
        codeBox.hidden = false;
        code.textContent = `Loading ${fileName}...`;

        try {
            const response = await fetch(projectUrl + fileName);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            code.textContent = await response.text();
        } catch (error) {
            code.textContent = `Could not load ${fileName} (${error.message})`;
        }
    }

    // Build one tab button, put it in the tab row, and hand it back
    function addTab(label, onClick) {
        const tab = document.createElement("button");
        tab.type = "button";
        tab.className = "viewer-tab";
        tab.textContent = label;
        tab.setAttribute("aria-pressed", "false");

        tab.addEventListener("click", () => {
            tabs.querySelector('[aria-pressed="true"]')?.setAttribute("aria-pressed", "false");
            tab.setAttribute("aria-pressed", "true");
            onClick();
        });

        tabs.append(tab);
        return tab;
    }

    // Every "View Project" button opens the viewer for its own project
    document.querySelectorAll("[data-project-url]").forEach(button => {
        button.addEventListener("click", () => {
            projectUrl = button.dataset.projectUrl;
            title.textContent = button.closest(".project-card").querySelector(".project-title").textContent;

            tabs.replaceChildren();
            addTab("Preview", showPreview).click();
            button.dataset.files.split(",").forEach(fileName => {
                addTab(fileName, () => showFile(fileName));
            });

            dialog.showModal();
        });
    });

    document.getElementById("viewerClose").addEventListener("click", () => dialog.close());

    // Fires for the Close button AND the Esc key
    dialog.addEventListener("close", () => {
        frame.src = "about:blank";
    });
}
