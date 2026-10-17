from datetime import datetime
from flask import Flask, render_template, redirect, url_for
from footer_config import FOOTER

app = Flask(__name__)

@app.route('/')
def home():
    return render_template('index.html')

# Old addresses still work: they jump to the section on the one page
@app.route('/about')
def about():
    return redirect(url_for('home') + '#about')

@app.route('/registration')
def registration():
    return redirect(url_for('home') + '#registration')

# Legal pages (separate pages, no loader)
@app.route('/privacy')
def privacy():
    return render_template('privacy.html')

@app.route('/terms')
def terms():
    return render_template('terms.html')

# Keep this block LAST. Routes written below it are never registered.
if __name__ == '__main__':
    app.run(debug=True)