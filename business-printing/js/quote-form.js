// Quote-page-specific hook — same validation/submission engine as every
// other form (js/form-validation.js), just with a quote-specific success
// message instead of the generic one main.js would apply.
document.addEventListener("DOMContentLoaded", function () {
    var form = document.querySelector('form[name="quote"]');
    if (form && window.MPForms) {
        window.MPForms.enhance(form, {
            successMessage:
                "Thanks — we've got your project details and will follow up with a quote soon.",
        });
    }
});
