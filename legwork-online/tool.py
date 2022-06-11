from flask import (
    Blueprint, flash, g, redirect, render_template, request, url_for
)
from werkzeug.exceptions import abort

import legwork
import astropy.units as u

import os
import matplotlib
matplotlib.use('Agg')

bp = Blueprint('tool', __name__)


@bp.route('/')
def index():
    return render_template('home.html')


@bp.route('/tool', methods=("GET", "POST"))
def tool():
    if request.method == "GET":
        return render_template('tool.html')
    else:
        data = request.get_json()

        sources = legwork.source.Source(m_1=float(data["sources"]["m_1"]) * u.Msun,
                                        m_2=float(data["sources"]["m_2"]) * u.Msun,
                                        f_orb=float(data["sources"]["f_orb"]) * u.mHz,
                                        ecc=float(data["sources"]["ecc"]),
                                        dist=float(data["sources"]["dist"]) * u.kpc,
                                        gw_lum_tol=float(data["settings"]["gw_lum_tol"]),
                                        stat_tol=float(data["settings"]["stat_tol"]),
                                        interpolate_g=bool(data["settings"]["interpolate_g"]),
                                        interpolate_sc=bool(data["settings"]["interpolate_sc"]),
                                        sc_params={
                                            "instrument": data["detector"]["instrument"],
                                            "t_obs": float(data["detector"]["duration"]) * u.yr,
                                            "approximate_R": bool(data["detector"]["approximate_response_function"]),
                                            "confusion_noise": None if data["detector"]["confusion_noise_model"] == "None" else data["detector"]["confusion_noise_model"]
                                        })

        print(sources.m_1)
        print(sources.get_snr())
        print(sources.get_merger_time())
        return str(sources.__dict__)


@bp.route('/about')
def about():
    return render_template('about.html')
