from flask import (
    Blueprint, flash, g, redirect, render_template, request, url_for
)
from werkzeug.exceptions import abort

bp = Blueprint('blog', __name__)

@bp.route('/')
def index():
    return render_template('home.html')


@bp.route('/tool', methods=("GET", "POST"))
def tool():
    return render_template('tool.html')