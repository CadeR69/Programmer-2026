// Form validation + submission (quote form and contact form)
//
// Handles both forms generically: required-field + email checks with inline,
// accessible error messages, then submits to Web3Forms over fetch so the
// visitor never leaves the page. On any failure the form is left exactly as
// the visitor typed it — nothing is cleared — and they're pointed at the
// phone number as a fallback.
(function () {
    // Paste your real Web3Forms access key here once you've signed up at
    // https://web3forms.com (free, just an email to verify). Until this is
    // replaced, submissions are refused with an on-page message instead of
    // silently failing or pretending to send.
    var WEB3FORMS_ACCESS_KEY = "REPLACE_WITH_YOUR_WEB3FORMS_ACCESS_KEY";
    var FALLBACK_PHONE = "(270) 247-0033";
    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    function showStatus(form, kind, message) {
        var status = form.querySelector(".form-status");
        if (!status) {
            status = document.createElement("div");
            status.className = "form-status";
            status.setAttribute("role", "status");
            status.setAttribute("aria-live", "polite");
            form.appendChild(status);
        }
        status.className = "form-status " + kind;
        status.textContent = message;
    }

    function fieldError(field, message) {
        field.setAttribute("aria-invalid", "true");
        var id = field.id + "-error";
        var err = document.getElementById(id);
        if (!err) {
            err = document.createElement("p");
            err.id = id;
            err.className = "form-error";
            field.insertAdjacentElement("afterend", err);
        }
        err.textContent = message;
        field.setAttribute("aria-describedby", id);
    }

    function clearFieldError(field) {
        field.removeAttribute("aria-invalid");
        field.removeAttribute("aria-describedby");
        var err = document.getElementById(field.id + "-error");
        if (err) err.remove();
    }

    function validate(form) {
        var ok = true;
        var fields = form.querySelectorAll("input[required], textarea[required], select[required]");
        Array.prototype.forEach.call(fields, function (field) {
            var value = (field.value || "").trim();
            if (!value) {
                fieldError(field, "This field is required.");
                ok = false;
            } else if (field.type === "email" && !EMAIL_RE.test(value)) {
                fieldError(field, "Enter a valid email address.");
                ok = false;
            } else {
                clearFieldError(field);
            }
        });
        return ok;
    }

    function enhance(form, options) {
        if (!form || form.dataset.enhanced === "true") return;
        form.dataset.enhanced = "true";
        options = options || {};
        var successMessage =
            options.successMessage ||
            "Thanks — we've got your message and will get back to you soon.";

        // Clear a field's error the moment the visitor fixes it, rather than
        // making them resubmit to find out.
        form.addEventListener("input", function (e) {
            var field = e.target;
            if (!field.hasAttribute("required")) return;
            var value = (field.value || "").trim();
            if (value && !(field.type === "email" && !EMAIL_RE.test(value))) {
                clearFieldError(field);
            }
        });

        form.addEventListener("submit", function (e) {
            e.preventDefault();

            // Honeypot: a filled hidden field means a bot filled it in.
            // Pretend success rather than telling an automated filler it failed.
            var honeypot = form.querySelector('[name="bot-field"]');
            if (honeypot && honeypot.value) {
                showStatus(form, "success", successMessage);
                form.reset();
                return;
            }

            if (!validate(form)) {
                showStatus(form, "error", "Check the highlighted fields and try again.");
                var firstInvalid = form.querySelector('[aria-invalid="true"]');
                if (firstInvalid) firstInvalid.focus();
                return;
            }

            if (!WEB3FORMS_ACCESS_KEY || WEB3FORMS_ACCESS_KEY.indexOf("REPLACE_WITH") === 0) {
                showStatus(
                    form,
                    "error",
                    "This form isn't fully wired up yet — add a Web3Forms access key in " +
                        "js/form-validation.js before this goes live."
                );
                return;
            }

            var submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;
            showStatus(form, "success", "Sending…");

            var formData = new FormData(form);
            formData.append("access_key", WEB3FORMS_ACCESS_KEY);

            var controller = new AbortController();
            var timeout = setTimeout(function () {
                controller.abort();
            }, 15000);

            fetch("https://api.web3forms.com/submit", {
                method: "POST",
                body: formData,
                headers: { Accept: "application/json" },
                signal: controller.signal,
            })
                .then(function (response) {
                    return response.json();
                })
                .then(function (result) {
                    if (result && result.success) {
                        showStatus(form, "success", successMessage);
                        form.reset();
                    } else {
                        throw new Error((result && result.message) || "Submission failed.");
                    }
                })
                .catch(function () {
                    // Nothing the visitor typed is lost — we never reset the form here.
                    showStatus(
                        form,
                        "error",
                        "Something went wrong sending this — what you typed is still here. " +
                            "Try again, or call us directly at " + FALLBACK_PHONE + "."
                    );
                })
                .finally(function () {
                    clearTimeout(timeout);
                    if (submitBtn) submitBtn.disabled = false;
                });
        });
    }

    function autoEnhance() {
        var forms = document.querySelectorAll("form[name]");
        Array.prototype.forEach.call(forms, function (form) {
            if (form.dataset.enhanced !== "true") enhance(form);
        });
    }

    window.MPForms = { enhance: enhance, validate: validate, autoEnhance: autoEnhance };
})();
