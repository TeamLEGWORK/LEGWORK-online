window.MathJax = {
    tex: {
        inlineMath: [
            ['$', '$'],
            ['\\(', '\\)']
        ]
    },
    inTabOrder: false,
    startup: {
        pageReady: function () {
            return MathJax.startup.defaultPageReady().then(function () {
                document.querySelectorAll(".input-group-text .MathJax").forEach(function (el) {
                    el.setAttribute("tabindex", "-1")
                })
            })
        }
    }
};

window.addEventListener("load", function() {
    // grab the template for later use
    template = document.getElementById("helper-template");

    // loop over each helper
    this.document.querySelectorAll(".helper").forEach(function(el) {
        // clone the template and reveal it
        helper = template.cloneNode(true);
        helper.classList.remove("hide");

        // cut and paste the title
        helper.setAttribute("title", el.getAttribute("title"));
        el.setAttribute("title", "")

        // attach it to the DOM
        el.appendChild(helper);
    });

    // activate all of the tooltips
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl)
    });

});