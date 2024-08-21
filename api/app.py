from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
import traceback
import pandas as pd
import os
import sys
import datetime

app = Flask(__name__, static_folder='../frontend/dist', static_url_path='/')
CORS(app)

# Add the current directory to the Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
sys.path.append(project_root)

# Import your functions here
from kpi_master_v1_07 import (
    load_initial_holdings, load_trades, load_product_info, load_client_sales,
    calculate_daily_holdings, calculate_daily_income, calculate_cumulative_income,
    show_income_statistics, generate_forecasts, generate_sales_person_breakdowns,
    generate_client_breakdowns
)


def find_data_file(filename):
    possible_locations = [
        os.path.join(project_root, 'data', filename),
        os.path.join(current_dir, 'data', filename),
        os.path.join('/opt/render/project/src/data', filename),
        os.path.join('/app/data', filename),
    ]
    for location in possible_locations:
        if os.path.exists(location):
            return location
    raise FileNotFoundError(f"Could not find {filename} in any of the expected locations")


# Global variables to store calculated data
daily_income = {}
sales_income = {}
client_income = {}
fund_stats = None
forecasts = None
sales_person_breakdowns = {}
client_breakdowns = {}


def load_and_process_data():
    global daily_income, sales_income, client_income, fund_stats, forecasts, sales_person_breakdowns, client_breakdowns

    start_date = datetime.date(2023, 12, 31)
    end_date = datetime.date(2024, 6, 30)

    try:
        initial_holdings = load_initial_holdings(find_data_file('2023DEC.csv'))
        trades = load_trades(find_data_file('TRADES_LOG.csv'))
        product_info = load_product_info(find_data_file('PRODUCT_INFO.csv'))
        client_sales = load_client_sales(find_data_file('CLIENT_LIST.csv'))

        daily_holdings = calculate_daily_holdings(initial_holdings, trades, start_date, end_date)
        daily_income, sales_income, client_income = calculate_daily_income(daily_holdings, product_info, client_sales)
        cumulative_sales_income = calculate_cumulative_income(sales_income)
        cumulative_client_income = calculate_cumulative_income(client_income)
        client_stats, fund_stats, sales_stats = show_income_statistics(daily_income, sales_income, client_income,
                                                                       daily_holdings, product_info)
        forecasts = generate_forecasts(daily_income, product_info, daily_holdings, trades, end_date)
        sales_person_breakdowns = generate_sales_person_breakdowns(daily_income, client_sales)
        client_breakdowns = generate_client_breakdowns(daily_income)
    except Exception as e:
        print(f"Error during data loading and processing: {str(e)}")
        print(traceback.format_exc())


# Load data on startup
load_and_process_data()


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def catch_all(path):
    return app.send_static_file('index.html')


@app.route('/api/test')
def test():
    return jsonify({"message": "API is working"})


@app.route('/api/dashboard')
def get_dashboard():
    if not daily_income:
        return jsonify({"error": "Data not loaded"}), 500

    latest_date = max(daily_income.keys())
    total_income = sum(sum(client.values()) for client in daily_income[latest_date].values())
    total_clients = len(client_income[latest_date])
    total_funds = len(fund_stats) if fund_stats is not None else 0
    total_sales = len(sales_income[latest_date])

    income_trend = [{'date': date.isoformat(), 'income': sum(sum(client.values()) for client in clients.values())}
                    for date, clients in daily_income.items()]

    return jsonify({
        'total_income': total_income,
        'total_clients': total_clients,
        'total_funds': total_funds,
        'total_sales': total_sales,
        'income_trend': income_trend
    })


@app.route('/api/sales')
def get_sales():
    if not sales_income:
        return jsonify({"error": "Data not loaded"}), 500

    sales_data = {
        'salesPersons': [],
        'dailyContribution': [],
        'individualPerformance': {}
    }

    for date in sales_income.keys():
        daily_data = {'date': date.isoformat()}
        daily_data.update({sp: income for sp, income in sales_income[date].items()})
        sales_data['dailyContribution'].append(daily_data)

    for sales_person in set(person for daily in sales_income.values() for person in daily.keys()):
        sales_data['individualPerformance'][sales_person] = []
        cumulative_income = 0
        clients = set()
        funds = set()

        for date, daily in sales_income.items():
            if sales_person in daily:
                cumulative_income += daily[sales_person]
                client_data = sales_person_breakdowns[date][sales_person]['clients']
                fund_data = sales_person_breakdowns[date][sales_person]['funds']
                clients.update(client_data.keys())
                funds.update(fund_data.keys())
                sales_data['individualPerformance'][sales_person].append({
                    'date': date.isoformat(),
                    'income': daily[sales_person],
                    'clients': client_data,
                    'funds': fund_data
                })

        sales_data['salesPersons'].append({
            'name': sales_person,
            'cumulativeIncome': cumulative_income,
            'topClients': list(clients),
            'topFunds': list(funds)
        })

    return jsonify(sales_data)


@app.route('/api/clients')
def get_clients():
    if not client_income:
        return jsonify({"error": "Data not loaded"}), 500

    latest_date = max(client_income.keys())
    return jsonify([
        {'name': client, 'income': income}
        for client, income in client_income[latest_date].items()
    ])


@app.route('/api/funds')
def get_funds():
    if fund_stats is None:
        return jsonify({"error": "Data not loaded"}), 500

    try:
        funds_dict = fund_stats.reset_index().to_dict(orient='records')
        processed_funds = {
            str(record.get('index', 'Unknown')): {
                'mean': record.get('mean', 0),
                'std': record.get('std', 0),
                'min': record.get('min', 0),
                'max': record.get('max', 0),
                'count': record.get('count', 0)
            } for record in funds_dict
        }
        return jsonify(processed_funds)
    except Exception as e:
        app.logger.error(f"Error in get_funds: {str(e)}")
        app.logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@app.route('/api/forecast')
def get_forecast():
    if forecasts is None:
        return jsonify({"error": "Data not loaded"}), 500
    return jsonify(forecasts)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))
    app.run(host='0.0.0.0', port=port)