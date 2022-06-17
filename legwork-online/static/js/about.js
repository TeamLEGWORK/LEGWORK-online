import {animateCSS} from "./base.js";

window.addEventListener("load", function () {
    document.getElementById("me-headshot-col").classList.remove("hide");
    animateCSS("#me-headshot-col", "bounceInLeft");

    document.getElementById("katie-headshot-col").classList.remove("hide");
    animateCSS("#katie-headshot-col", "bounceInRight");

    ["me-headshot", "katie-headshot"].forEach(function (id) {
        document.getElementById(id).addEventListener("click", function () {
            animateCSS("#" + id, "bounceOutDown", "animate__", function () {
                document.getElementById(id).style.opacity = 0;
                setTimeout(function () {
                    animateCSS("#" + id, "jackInTheBox", "animate__", function () {
                        document.getElementById(id).style.opacity = 1;
                    });
                }, 1000);
            });
        });
    });
});
