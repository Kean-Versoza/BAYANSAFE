from datetime import datetime
from flask import Flask, render_template, redirect, url_for
from footer_config import FOOTER

app = Flask(__name__)


# Makes `footer` and `current_year` available in every template
@app.context_processor
def inject_footer():
    return {'footer': FOOTER, 'current_year': datetime.now().year}


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


if __name__ == '__main__':
    app.run(debug=True)