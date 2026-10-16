from flask import Flask, render_template, redirect, url_for
from datetime import datetime

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

if __name__ == '__main__':
    app.run(debug=True)