import "../node_modules/bootstrap/dist/js/bootstrap.bundle.min.js";

window.MathJax = {
    tex: {
        inlineMath: [
            ["$", "$"],
            ["\\(", "\\)"],
        ],
    },
    inTabOrder: false,
    startup: {
        pageReady: function () {
            return MathJax.startup.defaultPageReady().then(function () {
                document.querySelectorAll(".MathJax").forEach(function (el) {
                    el.setAttribute("tabindex", "-1");
                });
            });
        },
    },
};

export const animateCSS = (element, animation, prefix = "animate__", callback = null) =>
    // We create a Promise and return it
    new Promise((resolve, reject) => {
        const animationName = `${prefix}${animation}`;

        let node = null;
        if (typeof element === "string") {
            node = document.querySelector(element);
        } else {
            node = element;
        }

        node.classList.add(`${prefix}animated`, animationName);

        // When the animation ends, we clean the classes and resolve the Promise
        function handleAnimationEnd(event) {
            event.stopPropagation();
            node.classList.remove(`${prefix}animated`, animationName);
            resolve("Animation ended");
            if (callback !== null) {
                callback();
            }
        }

        node.addEventListener("animationend", handleAnimationEnd, {
            once: true,
        });
    });
