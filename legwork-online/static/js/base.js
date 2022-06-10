import "../node_modules/bootstrap/dist/js/bootstrap.bundle.min.js";

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


export const animateCSS = (element, animation, prefix = 'animate__') =>
    // We create a Promise and return it
    new Promise((resolve, reject) => {
        const animationName = `${prefix}${animation}`;
        const node = document.querySelector(element);

        node.classList.add(`${prefix}animated`, animationName);

        // When the animation ends, we clean the classes and resolve the Promise
        function handleAnimationEnd(event) {
            event.stopPropagation();
            node.classList.remove(`${prefix}animated`, animationName);
            resolve('Animation ended');
        }

        node.addEventListener('animationend', handleAnimationEnd, {
            once: true
        });
    });
