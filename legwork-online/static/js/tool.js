import {
    animateCSS
} from "./base.js"


// for converting csv headings to nice html things
const header_to_longname = {
    "m_1": "Primary Mass [M<sub>⊙</sub>]",
    "m_2": "Secondary Mass [M<sub>⊙</sub>]",
    "f_orb": "Orbital Frequency [mHz]",
    "ecc": "Eccentricity",
    "dist": "Distance [kpc]",
    "snr": "Signal-to-Noise Ratio",
    "t_merge": "Time until merger [Myr]",
    "log_total_strain": "log<sub>10</sub>(Total strain)",
    "log_total_char_strain": "log<sub>10</sub>(Total characteristic strain)",
    "merged": "Source has merged?"
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
        "instrument": "LISA",
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

        const dropped_file = e.dataTransfer.files[0];
        read_csv_input(dropped_file);
    });

    // handle them choosing a file directly
    document.querySelector(".file-drop-box-choose").addEventListener("change", function (e) {
        read_csv_input(e.target.files[0]);
    });

    // input initialisation (basically just updated the global variable and add to output table)
    document.querySelector("#init").addEventListener("click", function () {
        update_inputs();

        const rows = [
            ["m_1", "m_2", "f_orb", "ecc", "dist"],
            [data["sources"]["m_1"], data["sources"]["m_2"], data["sources"]["f_orb"],
                data["sources"]["ecc"], data["sources"]["dist"]
            ]
        ]
        create_table(rows)
        
        inject_toast("Inputs updated!", "", "2000")
    });

    // calculate the SNR using the API
    document.querySelector("#snr").addEventListener("click", function () {
        make_calculation("#snr", "snr", "Signal-to-noise ratio");
    });

    document.querySelector("#merger-time").addEventListener("click", function () {
        make_calculation("#merger-time", "t_merge", "Merger time");
    });

    document.querySelector("#total-strain").addEventListener("click", function () {
        make_calculation("#total-strain", "log_total_strain", "Total strain");
    });

    document.querySelector("#total-characteristic-strain").addEventListener("click", function () {
        make_calculation("#total-characteristic-strain", "log_total_char_strain",
                         "Total characteristic strain");
    });

    document.querySelector("#evolve").addEventListener("click", function() {
        if (!enforce_inputs()) {
            return;
        }

        const time_string = document.querySelector("#evolve-time").value;
        let time = 0;
        if (time_string.includes(",")) {
            time = [];
            time_string.split(",").forEach(el => time.push(parseFloat(el)));


            if (time.length != data["sources"]["m_1"].length) {
                alert_user("Number of evolution times does not match number of sources.");
                return;
            }
            for (let i = 0; i < time.length; i++) {
                if (time[i] < 0 || isNaN(time[i])) {
                    alert_user("Invalid evolution time detected: " + time[i]);
                    return;
                }
            }
        } else {
            time = parseFloat(time_string);
            if (time < 0 || isNaN(time)) {
                alert_user("Invalid evolution time detected: " + time);
                return;
            }
        }

        data["t_evol"] = time;

        const button = document.querySelector("#evolve");
        const original_html = button.innerHTML;
        add_loader(button, "Evolving...");
        $.ajax({
            type: "POST",
            url: "/tool/evolve",
            data: JSON.stringify(data),
            contentType: "application/json; charset=utf-8",
            success: function (response) {
                ["f_orb", "ecc", "t_merge", "merged"].forEach(prop => {
                    insert_or_update_column(prop, response[prop]);
                    data["sources"][prop] = response[prop];
                });
                inject_toast("Evolution complete! See table for results.", response["runtime"])
                button.innerHTML = original_html;
            },
            error: function (response) {
                const parser = new DOMParser()
                const doc = parser.parseFromString(response.responseText, 'text/html')
                alert_user("Error: evolution failed", doc.querySelector(".errormsg").innerHTML,
                           response.responseText);
                button.innerHTML = original_html;
            }
        });
    });

    document.querySelector("#toggle-plots").addEventListener("click", function() {
        let i = this.querySelector("i");
        i.classList.toggle("fa-chevron-up");
        i.classList.toggle("fa-chevron-down");
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

    ["keyup", "change"].forEach(function(e) {
        document.querySelector("#data-precision").addEventListener(e, function() {
            const precision = parseInt(this.value);
            if (precision != NaN && precision >= 0) {
                document.querySelectorAll("table tbody td").forEach(function(el) {
                    el.innerText = parseFloat(el.getAttribute("data-unrounded")).toFixed(precision);
                });
            }
        });
    });

    document.querySelector("#download").addEventListener("click", download_table);
});




function read_csv_input(file) {
    let success = true;

    const fileReader = new FileReader();
    fileReader.readAsText(file);

    fileReader.onload = function () {
        const dataset = fileReader.result;
        const rows = dataset.split('\n').map(data => data.split(','));

        for (let i = 0; i < rows.length; i++) {
            if (rows[i].length !== rows[0].length) {
                rows.splice(i, 1);
            }
        }

        for (let i = 0; i < rows[0].length; i++) {
            if (rows[0][i] in header_to_longname) {
                let source_prop = []
                for (let j = 1; j < rows.length; j++) {
                    source_prop.push(parseFloat(rows[j][i]));
                }
                data["sources"][rows[0][i]] = source_prop
            } else {
                alert_user("Unknown header detected in csv file: " + rows[0][i].toString());
                success = false;
            }
        }

        data["single_source"] = false;

        if (success) {
            create_table(rows);
            inject_toast("File upload complete, check out your data in the table below!", "", "3000");
            document.getElementById("source-csv-file-label").innerHTML = `
                Success! <strong>Upload another file?</strong></label>
            `;
            animateCSS(".file-drop-box-container", "jello");
        } else {
            document.getElementById("source-csv-file-label").innerHTML = `
                Uh oh, there's a problem with your file! <strong>Try again?</strong></label>
            `;
            animateCSS(".file-drop-box-container", "headShake");
        }
        document.querySelectorAll(".file-drop-box .message").forEach(function (el) {
            el.classList.add("hide")
        });
        document.querySelector(".file-drop-box .pre-upload").classList.remove("hide");
    };
}


function create_table(rows) {
    let table = document.createElement("table");
    table.classList.add("table", "table-striped");

    let thead = document.createElement("thead");
    table.appendChild(thead);

    let thead_tr = document.createElement("tr");
    thead.appendChild(thead_tr);

    let th = document.createElement("th");
    th.innerText = "Source ID";
    th.setAttribute("data-csv-header", "id")
    thead_tr.appendChild(th);

    for (let i = 0; i < rows[0].length; i++) {
        let th = document.createElement("th");

        if (rows[0][i] in header_to_longname) {
            th.innerHTML = header_to_longname[rows[0][i]]
        } else {
            th.innerHTML = rows[0][i];
        }
        th.setAttribute("data-csv-header", rows[0][i])
        thead_tr.appendChild(th);
    }

    let tbody = document.createElement("tbody");
    table.appendChild(tbody);

    const precision = parseInt(document.querySelector("#data-precision").value);

    for (let i = 1; i < rows.length; i++) {
        if (rows[i].length > 1) {
            let tr = document.createElement("tr");
            let th = document.createElement("th");
            th.setAttribute("scope", "row");
            th.setAttribute("data-unrounded", i - 1);
            th.innerText = i - 1;
            tr.appendChild(th);

            for (let j = 0; j < rows[i].length; j++) {
                let td = document.createElement("td");
                td.setAttribute("data-unrounded", rows[i][j]);
                td.innerText = parseFloat(rows[i][j]).toFixed(precision);
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        }
    }
    document.getElementById("sources-table").innerHTML = "";
    document.getElementById("sources-table").appendChild(table);
}

function insert_or_update_column(header, data) {
    const table = document.querySelector("#sources-table table");

    let translated_header = header;
    if (header in header_to_longname) {
        translated_header = header_to_longname[header];
    }

    let ths = table.querySelectorAll("th");
    let col_index = -1
    for (let i = 1; i < ths.length; i++) {
        if (ths[i].innerHTML == translated_header) {
            col_index = i - 1;
            break;
        }
    }

    const precision = parseInt(document.querySelector("#data-precision").value);

    // if the column is not already present
    if (col_index < 0) {
        const th = document.createElement("th");
        th.innerHTML = translated_header;
        th.setAttribute("data-csv-header", header)
        table.querySelector("thead tr").appendChild(th);

        const rows = table.querySelectorAll("tbody tr");
        for (let i = 0; i < data.length; i++) {
            let td = document.createElement("td");
            td.setAttribute("data-unrounded", data[i]);
            td.innerText = parseFloat(data[i]).toFixed(precision);

            rows[i].appendChild(td);
        }
    } else {
        const rows = table.querySelectorAll("tbody tr");
        for (let i = 0; i < rows.length; i++) {
            const td = rows[i].querySelectorAll("td")[col_index];
            td.setAttribute("data-unrounded", data[i]);
            td.innerText = parseFloat(data[i]).toFixed(precision);
        }
    }
}

function update_inputs() {
    set_defaults();

    if (document.querySelector("#input-single-source-tab").classList.contains("active")) {
        data["sources"]["m_1"] = [parseFloat(document.getElementById("single-primary-mass").value)];
        data["sources"]["m_2"] = [parseFloat(document.getElementById("single-secondary-mass").value)];
        data["sources"]["f_orb"] = [parseFloat(document.getElementById("single-frequency").value)];
        data["sources"]["ecc"] = [parseFloat(document.getElementById("single-eccentricity").value)];
        data["sources"]["dist"] = [parseFloat(document.getElementById("single-distance").value)];
    }

    data["detector"]["instrument"] = document.getElementById("detector").value;
    data["detector"]["duration"] = parseFloat(document.getElementById("duration").value);
    data["detector"]["approximate_response_function"] = document.getElementById("approximate-response").checked;

    if (document.getElementById("confusion-noise").checked) {
        data["detector"]["confusion_noise_model"] = document.getElementById("confusion-model").value;
    } else {
        data["detector"]["confusion_noise_model"] = "None";
    }

    data["settings"]["gw_lum_tol"] = parseFloat(document.getElementById("gw-lum-tol").value);
    data["settings"]["stat_tol"] = parseFloat(document.getElementById("stat-tol").value);
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

function inject_toast(message, small_text="", delay=null) {
    const toast_el = document.getElementById("toast-template").cloneNode(true);
    toast_el.id = ""
    toast_el.querySelector(".toast-body").innerText = message;
    toast_el.querySelector(".toast-status").innerText = small_text;
    if (delay != null) {
        toast_el.setAttribute("data-bs-delay", delay);
    }
    toast_el.classList.remove("hide");
    document.querySelector("#toaster").appendChild(toast_el);

    const toast = new bootstrap.Toast(toast_el);
    toast.show()
    return toast_el;
}

function add_loader(el, message) {
    el.innerHTML = `
        <span class='message'></span> <i class="fa fa-spin fa-circle-o-notch"></i>
    `
    el.querySelector(".message").innerText = message;
}

function alert_user(message, error=null, traceback_doc=null) {
    if (error == null && traceback_doc == null) {
        let toast = inject_toast(message, "", "20000")
        toast.classList.add("bg-danger", "text-white");
        return
    }

    let toast = inject_toast("", "", "20000")
    toast.classList.add("bg-danger", "text-white");

    let bold = document.createElement("b");
    bold.innerHTML = message;

    let link = document.createElement("a");
    link.classList.add("link-light");
    link.href = "#";
    link.addEventListener("click", function() {
        const new_win = window.open();
        new_win.document.write(traceback_doc);
    });
    link.innerText = "View trackback";

    let p = document.createElement("p");
    p.appendChild(bold);
    p.innerHTML += "<br>"
    p.innerHTML += error
    p.innerHTML += "<br>"
    p.appendChild(link);

    toast.querySelector(".toast-body").appendChild(p);
    return;
}

function make_calculation(button_selector, method, text_version) {
    if (!enforce_inputs()) {
        return;
    }
    const button = document.querySelector(button_selector);
    const original_html = button.innerHTML;
    add_loader(button, "Calculating...");
    $.ajax({
        type: "POST",
        url: "/tool/" + method,
        data: JSON.stringify(data),
        contentType: "application/json; charset=utf-8",
        success: function (response) {
            insert_or_update_column(method, response[method]);
            inject_toast(text_version + " calculated! See table for results.", response["runtime"])
            button.innerHTML = original_html;
            data["sources"][method] = response[method];
        },
        error: function (response) {
            const parser = new DOMParser()
            const doc = parser.parseFromString(response.responseText, 'text/html')
            alert_user("Error: " + text_version + " calculation failed", doc.querySelector(".errormsg").innerHTML,
                       response.responseText);
            button.innerHTML = original_html;
        }
    });
}

function enforce_inputs() {
    const required = ["m_1", "m_2", "f_orb", "ecc", "dist"];
    for (let i = 0; i < required.length; i++) {
        if (data["sources"][required[i]] == null) {
            alert_user("Can't complete calculation, you're missing a required input! Make sure you've supplied a value for `" + required[i] + "` (there may be more, this was just the first missing one).");
            return false;
        }
    }
    return true;
}

function download_table() {
    if (document.querySelector("table") == null) {
        alert_user("Download aborted: You haven't added any inputs/performed calculations yet!");
        return;
    }
    let csv_file = "";

    let header_list = [];
    document.querySelectorAll("table thead th").forEach(function(header) {
        header_list.push(header.getAttribute("data-csv-header"))
    });
    csv_file += header_list.join(",") + "\r\n";

    document.querySelectorAll("table tbody tr").forEach(function(row) {
        let row_list = [];
        row.querySelectorAll("th,td").forEach(function(cell) {
            row_list.push(cell.getAttribute("data-unrounded"));
        });
        csv_file += row_list.join(",") + "\r\n";
    });

    let blob = new Blob([csv_file], { type: 'text/csv;charset=utf-8;' });
    let link = document.createElement("a");

    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", 'legwork-online-results.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    inject_toast("Download complete! File is called `legwork-online-results.csv`.");
}