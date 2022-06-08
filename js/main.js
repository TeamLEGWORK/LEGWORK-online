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

window.addEventListener("load", function () {
    // grab the template for later use
    template = document.getElementById("helper-template");

    // loop over each helper
    this.document.querySelectorAll(".helper").forEach(function (el) {
        // clone the template and reveal it
        helper = template.cloneNode(true);
        helper.id = "";

        // cut and paste the title
        helper.setAttribute("title", el.getAttribute("title"));
        el.setAttribute("title", "")

        // attach it to the DOM
        el.appendChild(helper);
    });

    this.document.getElementById("confusion-noise").addEventListener("click", function () {
        document.getElementById("confusion-model").toggleAttribute("disabled");
    });

    // activate all of the tooltips
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl)
    });

    ["dragover", "dragenter"].forEach(function (et) {
        document.querySelector(".file-drop-box-container").addEventListener(et, function (e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.add("file-is-over");
            this.querySelectorAll(".file-drop-box .message").forEach(function (el) {
                el.classList.add("hide")
            });
            this.querySelector(".file-drop-box .ready-to-drop").classList.remove("hide");
        });
    });

    ["dragend", "dragleave"].forEach(function (et) {
        document.querySelector(".file-drop-box-container").addEventListener(et, function (e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.remove("file-is-over");
            this.querySelectorAll(".file-drop-box .message").forEach(function (el) {
                el.classList.add("hide")
            });
            this.querySelector(".file-drop-box .pre-upload").classList.remove("hide");
        });
    });

    document.querySelector(".file-drop-box-container").addEventListener("drop", function (e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.remove("file-is-over");
        this.querySelectorAll(".file-drop-box .message").forEach(function (el) {
            el.classList.add("hide")
        });
        this.querySelector(".file-drop-box .uploading").classList.remove("hide");
        animateCSS(".file-drop-box .uploading", "bounceIn");

        document.getElementById("source-csv-file-label").innerHTML = `
            Success! <strong>Upload another file?</strong></label>
        `;

        dropped_file = e.dataTransfer.files[0];
        
        const fileReader = new FileReader();
        fileReader.readAsText(dropped_file);

        fileReader.onload = function() {
            const dataset = fileReader.result;
            const rows = dataset.split('\n').map(data => data.split(','));

            create_table(rows);
        };

        this.querySelectorAll(".file-drop-box .message").forEach(function (el) {
            el.classList.add("hide")
        });
        this.querySelector(".file-drop-box .pre-upload").classList.remove("hide");
    });
});


const animateCSS = (element, animation, prefix = 'animate__') =>
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

function create_table(rows) {
    table = document.createElement("table");
    table.classList.add("table", "table-striped");

    thead = document.createElement("thead");
    table.appendChild(thead);

    thead_tr = document.createElement("tr");
    thead.appendChild(thead_tr);

    th = document.createElement("th");
    th.innerText = "Source ID";
    thead.appendChild(th);

    for (i = 0; i < rows[0].length; i++) {
        th = document.createElement("th");
        th.innerText = rows[0][i];
        thead.appendChild(th);
    }

    tbody = document.createElement("tbody");
    table.appendChild(tbody);

    for (i = 1; i < rows.length; i++) {
        if (rows[i].length > 1) {
            tr = document.createElement("tr");
            th = document.createElement("th");
            th.setAttribute("scope", "row");
            th.innerText = i - 1;
            tr.appendChild(th);

            for (j = 0; j < rows[i].length; j++) {
                td = document.createElement("td");
                td.innerText = rows[i][j];
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        }
    }
    document.getElementById("sources-table").innerHTML = "";
    document.getElementById("sources-table").appendChild(table);
}