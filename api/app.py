from flask import Flask, jsonify
from flask_cors import CORS
import traceback
import pandas as pd
from .kpi_master_v1_07 import (
    load_initial_holdings, load_trades, load_product_info, load_client_sales,
    calculate_daily_holdings, calculate_daily_income, calculate_cumulative_income,
    show_income_statistics, generate_forecasts, generate_sales_person_breakdowns,
    generate_client_breakdowns
)
import datetime
import traceback
import os

app = Flask(__name__)


@app.route('/api/test')
def test():
    return {"message": "API is working"}

# Load data
start_date = datetime.date(2023, 12, 31)
end_date = datetime.date(2024, 6, 30)
initial_holdings = load_initial_holdings('data/2023DEC.csv')
trades = load_trades('data/TRADES_LOG.csv')
product_info = load_product_info('data/PRODUCT_INFO.csv')
client_sales = load_client_sales('data/CLIENT_LIST.csv')

# Calculate data
daily_holdings = calculate_daily_holdings(initial_holdings, trades, start_date, end_date)
daily_income, sales_income, client_income = calculate_daily_income(daily_holdings, product_info, client_sales)
cumulative_sales_income = calculate_cumulative_income(sales_income)
cumulative_client_income = calculate_cumulative_income(client_income)
client_stats, fund_stats, sales_stats = show_income_statistics(daily_income, sales_income, client_income, daily_holdings, product_info)
forecasts = generate_forecasts(daily_income, product_info, daily_holdings, trades, end_date)
sales_person_breakdowns = generate_sales_person_breakdowns(daily_income, client_sales)
client_breakdowns = generate_client_breakdowns(daily_income)

@app.route('/api/dashboard')
def get_dashboard():
    total_income = sum(sum(client.values()) for client in daily_income[max(daily_income.keys())].values())
    total_clients = len(client_income[max(client_income.keys())])
    total_funds = len(fund_stats)
    total_sales = len(sales_income[max(sales_income.keys())])

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
    sales_data = {
        'salesPersons': [],
        'dailyContribution': [],
        'individualPerformance': {}
    }

    # Prepare daily contribution data
    for date in sales_income.keys():
        daily_data = {'date': date.isoformat()}
        for sales_person in sales_income[date].keys():
            daily_data[sales_person] = sales_income[date][sales_person]
        sales_data['dailyContribution'].append(daily_data)

    # Prepare individual performance and sales persons data
    for sales_person in set(person for daily in sales_income.values() for person in daily.keys()):
        sales_data['individualPerformance'][sales_person] = []
        cumulative_income = 0
        clients = set()
        funds = set()

        for date, daily in sales_income.items():
            if sales_person in daily:
                cumulative_income += daily[sales_person]

                # Get actual client and fund data
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

    # Calculate cumulative data for individual performance
    for sales_person in sales_data['individualPerformance']:
        cumulative_clients = {}
        cumulative_funds = {}
        for day in sales_data['individualPerformance'][sales_person]:
            for client, amount in day['clients'].items():
                cumulative_clients[client] = cumulative_clients.get(client, 0) + amount
            for fund, amount in day['funds'].items():
                cumulative_funds[fund] = cumulative_funds.get(fund, 0) + amount
            day['clients'] = dict(cumulative_clients)
            day['funds'] = dict(cumulative_funds)

    return jsonify(sales_data)


@app.route('/api/clients')
def get_clients():
    latest_date = max(client_income.keys())
    return jsonify([
        {'name': client, 'income': income}
        for client, income in client_income[latest_date].items()
    ])


@app.route('/api/funds')
def get_funds():
    try:
        app.logger.info("Entering get_funds route")

        # Check if fund_stats is defined and has the expected structure
        if fund_stats is None:
            raise ValueError("fund_stats is None")

        if not isinstance(fund_stats, pd.DataFrame):
            raise TypeError(f"fund_stats is not a DataFrame. Type: {type(fund_stats)}")

        # Convert fund_stats DataFrame to a dictionary, converting dates to strings
        funds_dict = fund_stats.reset_index().to_dict(orient='records')
        app.logger.info(f"Converted fund_stats to dictionary. Number of records: {len(funds_dict)}")

        # Process the dictionary to match the expected format
        processed_funds = {}
        for record in funds_dict:
            fund = str(record.get('index', 'Unknown'))  # Convert index to string
            processed_funds[fund] = {
                'mean': record.get('mean', 0),
                'std': record.get('std', 0),
                'min': record.get('min', 0),
                'max': record.get('max', 0),
                'count': record.get('count', 0)
            }

        app.logger.info(f"Processed funds data. Number of funds: {len(processed_funds)}")
        return jsonify(processed_funds)
    except Exception as e:
        app.logger.error(f"Error in get_funds: {str(e)}")
        app.logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@app.route('/api/forecast')
def get_forecast():
    return jsonify(forecasts)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)