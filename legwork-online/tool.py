from flask import (
    Blueprint, render_template, request
)

import legwork
import numpy as np
import astropy.units as u
import time

import matplotlib
matplotlib.use('Agg')

bp = Blueprint('tool', __name__)


@bp.route('/')
def index():
    return render_template('home.html')


@bp.route('/tool', methods=("GET", "POST"))
def tool():
    return render_template('tool.html')


@bp.route('/tool/snr', methods=["POST"])
def snr():
    start = time.time()
    data = request.get_json()
    sources = data_to_Source(data)
    sources.get_snr()
    json = {
        "snr": list(sources.snr),
        "runtime": f"Runtime: {time.time() - start:1.2f}s"
    }
    return json


@bp.route('/tool/t_merge', methods=["POST"])
def t_merge():
    start = time.time()
    data = request.get_json()
    sources = data_to_Source(data)
    sources.get_merger_time()
    json = {
        "t_merge": list(sources.t_merge.to(u.Myr).value),
        "runtime": f"Runtime: {time.time() - start:1.2f}s"
    }
    return json


@bp.route('/tool/log_total_strain', methods=["POST"])
def log_total_strain():
    start = time.time()
    data = request.get_json()
    return total_strains(data, "log_total_strain", start)


@bp.route('/tool/log_total_char_strain', methods=["POST"])
def log_total_char_strain():
    start = time.time()
    data = request.get_json()
    return total_strains(data, "log_total_char_strain", start)


def total_strains(data, which, start):
    sources = data_to_Source(data)

    strain_vals = np.zeros(sources.n_sources)
    harmonics_required = sources.harmonics_required(sources.ecc)
    harmonic_groups = [(1, 10), (10, 100), (100, 1000), (1000, 10000)]
    for lower, upper in harmonic_groups:
        harm_mask = np.logical_and(harmonics_required > lower, harmonics_required <= upper)
        if harm_mask.any():
            if which == "log_total_strain":
                specific_strains = sources.get_h_0_n(harmonics=np.arange(1, upper + 1), which_sources=harm_mask)
            else:
                specific_strains = sources.get_h_c_n(harmonics=np.arange(1, upper + 1), which_sources=harm_mask)
            strain_vals[harm_mask] = specific_strains.sum(axis=1)

    json = {
        which: list(np.log10(strain_vals)),
        "runtime": f"Runtime: {time.time() - start:1.2f}s"
    }
    return json


@bp.route('/about')
def about():
    return render_template('about.html')


def data_to_Source(data):
    confusion_noise = None if data["detector"]["confusion_noise_model"] == "None" else data["detector"]["confusion_noise_model"]
    sc_params = {
        "instrument": data["detector"]["instrument"],
        "t_obs": float(data["detector"]["duration"]) * u.yr,
        "approximate_R": bool(data["detector"]["approximate_response_function"]),
        "confusion_noise": confusion_noise
    }

    m_1 = data["sources"]["m_1"] * u.Msun
    m_2 = data["sources"]["m_2"] * u.Msun
    f_orb = data["sources"]["f_orb"] * u.mHz
    ecc = data["sources"]["ecc"]
    dist = data["sources"]["dist"] * u.kpc

    sources = legwork.source.Source(m_1=m_1,
                                    m_2=m_2,
                                    f_orb=f_orb,
                                    ecc=ecc,
                                    dist=dist,
                                    gw_lum_tol=float(data["settings"]["gw_lum_tol"]),
                                    stat_tol=float(data["settings"]["stat_tol"]),
                                    interpolate_g=bool(data["settings"]["interpolate_g"]),
                                    interpolate_sc=bool(data["settings"]["interpolate_sc"]),
                                    sc_params=sc_params)
    return sources
