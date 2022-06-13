import {
    animateCSS
} from "./base.js"


// for converting csv headings to nice html things
const header_to_longname = {
    "m_1": "Primary Mass [M<sub>⊙</sub>]",
    "m_2": "Secondary Mass [M<sub>⊙</sub>]",
    "f_orb": "Orbital Frequency [mHz]",
    "ecc": "Eccentricity",
    "dist": "Distance [kpc]"
}

// stores current input data
let data = {
    "single_source": true,
    "sources": {
        "m_1": null,
        "m_2": null,
        "f_orb": null,
        "ecc": null,
        "dist": null,
        "t_merge": null,
        "h_0": null,
        "h_c": null,
        "snr": null
    },
    "detector": {
        "instrument": "lisa",
        "duration": "4",
        "approximate_response_function": false,
        "confusion_noise_model": "robson19"
    },
    "settings": {
        "gw_lum_tol": 0.05,
        "stat_tol": 0.1,
        "interpolate_g": false,
        "interpolate_sc": true
    }
}


window.addEventListener("load", function () {
    // grab the template for later use
    const template = document.getElementById("helper-template");

    // loop over each helper
    document.querySelectorAll(".helper").forEach(function (el) {
        // clone the template and reveal it
        let helper = template.cloneNode(true);
        helper.id = "";

        // cut and paste the title
        helper.setAttribute("title", el.getAttribute("title"));
        el.setAttribute("title", "")

        // attach it to the DOM
        el.appendChild(helper);
    });

    // only allow choice of confusion models when its turned on
    document.getElementById("confusion-noise").addEventListener("click", function () {
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

        const dropped_file = e.dataTransfer.files[0];

        const fileReader = new FileReader();
        fileReader.readAsText(dropped_file);

        fileReader.onload = function () {
            const dataset = fileReader.result;
            const rows = dataset.split('\n').map(data => data.split(','));

            create_table(rows);
        };


        this.querySelectorAll(".file-drop-box .message").forEach(function (el) {
            el.classList.add("hide")
        });
        this.querySelector(".file-drop-box .pre-upload").classList.remove("hide");
    });

    // handle them choosing a file directly
    document.querySelector(".file-drop-box-choose").addEventListener("change", function(e) {
        const fileReader = new FileReader();
        fileReader.readAsText(e.target.files[0]);

        fileReader.onload = function () {
            const dataset = fileReader.result;
            const rows = dataset.split('\n').map(data => data.split(','));

            create_table(rows);
        };
    });

    // input initialisation (basically just updated the global variable and add to output table)
    document.querySelector("#init").addEventListener("click", function () {
        update_inputs();

        const rows = [["Primary Mass [M<sub>⊙</sub>]", "Secondary Mass [M<sub>⊙</sub>]",
                        "Orbital Frequency [mHz]", "Eccentricity", "Distance [kpc]"],
                      [data["sources"]["m_1"], data["sources"]["m_2"], data["sources"]["f_orb"],
                       data["sources"]["ecc"], data["sources"]["dist"]]]
        create_table(rows)
    });

    // calculate the SNR using the API
    document.querySelector("#snr").addEventListener("click", function() {
        $.ajax({
            type: "POST",
            url: "/tool",
            data: JSON.stringify(data),
            contentType: "application/json; charset=utf-8",
            success: function (response) {
                console.log(response);
                insert_column("snr", response["snr"]);
            }
        });
    });

    // set up the carousel and buttons to move it
    const carousel = new bootstrap.Carousel('#plot-carousel');
    document.querySelectorAll("#plot-carousel-tabs .nav-link").forEach(function (el) {
        el.addEventListener("click", function () {
            document.querySelectorAll("#plot-carousel-tabs .nav-link").forEach(function (el) {
                el.classList.remove("active");
            });
            this.classList.add("active");

            carousel.to(this.getAttribute("data-bs-slide-to"));
        });
    });

    // sneaky colour selection
    document.querySelector("#sc-plot-fill-colour-label input").addEventListener("change", function () {
        document.querySelector("#sc-plot-fill-colour-label").style.backgroundColor = this.value;
    });

    // disable/enable stuff after switch is flipped
    document.querySelector("#sc-plot-fill").addEventListener("click", function () {
        document.querySelector(".colour-container").classList.toggle("bg-white");
        document.querySelector("#sc-plot-fill-colour-label").classList.toggle("disabled");
        document.querySelector("#sc-plot-fill-colour").toggleAttribute("disabled");
        document.querySelector("#sc-plot-fill-opacity").toggleAttribute("disabled");
    });
});


function create_table(rows) {
    let table = document.createElement("table");
    table.classList.add("table", "table-striped");

    let thead = document.createElement("thead");
    table.appendChild(thead);

    let thead_tr = document.createElement("tr");
    thead.appendChild(thead_tr);

    let th = document.createElement("th");
    th.innerText = "Source ID";
    thead_tr.appendChild(th);

    for (let i = 0; i < rows[0].length; i++) {
        let th = document.createElement("th");

        if (rows[0][i] in header_to_longname) {
            th.innerHTML = header_to_longname[rows[0][i]]
        }
        else {
            th.innerHTML = rows[0][i];
        }
        thead_tr.appendChild(th);
    }

    let tbody = document.createElement("tbody");
    table.appendChild(tbody);

    for (let i = 1; i < rows.length; i++) {
        if (rows[i].length > 1) {
            let tr = document.createElement("tr");
            let th = document.createElement("th");
            th.setAttribute("scope", "row");
            th.innerText = i - 1;
            tr.appendChild(th);

            for (let j = 0; j < rows[i].length; j++) {
                let td = document.createElement("td");
                td.innerText = rows[i][j];
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        }
    }
    document.getElementById("sources-table").innerHTML = "";
    document.getElementById("sources-table").appendChild(table);
}

function insert_column(header, data) {
    const table = document.querySelector("#sources-table table");

    const th = document.createElement("th");
    th.innerText = header;
    table.querySelector("thead tr").appendChild(th);

    let rows = table.querySelectorAll("tbody tr");
    for (let i = 0; i < data.length; i++) {
        let td = document.createElement("td");
        td.innerText = data[i];

        rows[i].appendChild(td);
    }
}


function update_inputs() {
    set_defaults();

    data["sources"]["m_1"] = document.getElementById("single-primary-mass").value;
    data["sources"]["m_2"] = document.getElementById("single-secondary-mass").value;
    data["sources"]["f_orb"] = document.getElementById("single-frequency").value;
    data["sources"]["ecc"] = document.getElementById("single-eccentricity").value;
    data["sources"]["dist"] = document.getElementById("single-distance").value;

    data["detector"]["instrument"] = document.getElementById("detector").value;
    data["detector"]["duration"] = document.getElementById("duration").value;
    data["detector"]["approximate_response_function"] = document.getElementById("approximate-response").checked;

    if (document.getElementById("confusion-noise").checked) {
        data["detector"]["confusion_noise_model"] = document.getElementById("confusion-model").value;
    } else {
        data["detector"]["confusion_noise_model"] = "None";
    }

    data["settings"]["gw_lum_tol"] = document.getElementById("gw-lum-tol").value;
    data["settings"]["stat_tol"] = document.getElementById("stat-tol").value;
    data["settings"]["interpolate_sc"] = document.getElementById("interpolate-sc").checked;
    data["settings"]["interpolate_g"] = document.getElementById("interpolate-g").checked;
}

function set_defaults() {
    update_if_blank("duration", 4);
    update_if_blank("gw-lum-tol", 0.05);
    update_if_blank("stat-tol", 0.01);

    // DEVELOPMENT
    update_if_blank("single-primary-mass", 10);
    update_if_blank("single-secondary-mass", 5);
    update_if_blank("single-frequency", 0.1);
    update_if_blank("single-eccentricity", 0.2);
    update_if_blank("single-distance", 8);
}

function update_if_blank(id, value) {
    const el = document.getElementById(id);
    if (el.value == "") {
        el.value = value;
    }
}