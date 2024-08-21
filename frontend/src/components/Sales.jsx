import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, Row, Col, Spin, Alert, Select, Table, Radio } from 'antd';

const { Option } = Select;

function Sales() {
  const [salesData, setSalesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSalesPerson, setSelectedSalesPerson] = useState(null);
  const [contributionType, setContributionType] = useState('cumulative');

  useEffect(() => {
    fetchSalesData();
  }, []);

  const fetchSalesData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/sales`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setSalesData(data);
      setSelectedSalesPerson(data.salesPersons[0]?.name);
    } catch (e) {
      setError(`Failed to fetch sales data: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Spin size="large" />;
  if (error) return <Alert message="Error" description={error} type="error" showIcon />;
  if (!salesData) return <Alert message="No sales data available" type="warning" showIcon />;

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF'];
  const lineStyles = ['solid', 'dashed', 'dotted', 'dashdot'];

  const salesPersonColumns = [
    {
      title: 'Sales Person',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: 'Number of Clients',
      dataIndex: 'clientCount',
      key: 'clientCount',
      sorter: (a, b) => a.clientCount - b.clientCount,
    },
    {
      title: 'Total Income',
      dataIndex: 'totalIncome',
      key: 'totalIncome',
      render: (text) => formatCurrency(text),
      sorter: (a, b) => a.totalIncome - b.totalIncome,
    }
  ];

  const salesPersonData = salesData.salesPersons.map(person => ({
    key: person.name,
    name: person.name,
    clientCount: person.topClients.length,
    totalIncome: person.cumulativeIncome
  }));

  const cumulativeData = salesData.dailyContribution.reduce((acc, day) => {
    const prevDay = acc[acc.length - 1] || {};
    const newDay = { date: day.date };
    salesData.salesPersons.forEach(person => {
      newDay[person.name] = (prevDay[person.name] || 0) + (day[person.name] || 0);
    });
    acc.push(newDay);
    return acc;
  }, []);

  const prepareIndividualData = (data, key) => {
    const cumulativeTotals = data.reduce((acc, day) => {
      Object.entries(day[key]).forEach(([name, value]) => {
        acc[name] = (acc[name] || 0) + value;
      });
      return acc;
    }, {});

    const top10 = Object.entries(cumulativeTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name]) => name);

    return data.map(day => {
      const newDay = { date: day.date };
      top10.forEach(name => {
        newDay[name] = day[key][name] || 0;
      });
      return newDay;
    });
  };

  const dailyIncomeData = salesData.dailyContribution.map(day => ({
    key: day.date,
    date: new Date(day.date).toLocaleDateString(),
    ...Object.fromEntries(salesData.salesPersons.map(person => [person.name, formatCurrency(day[person.name] || 0)]))
  }));

  const dailyIncomeColumns = [
    { title: 'Date', dataIndex: 'date', key: 'date' },
    ...salesData.salesPersons.map(person => ({
      title: person.name,
      dataIndex: person.name,
      key: person.name,
    }))
  ];

  return (
    <div>
      <h1>Sales Dashboard</h1>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="Cumulative Income Contribution by Sales Person">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={salesData.salesPersons}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={formatCurrency} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="cumulativeIncome" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Sales Person Performance">
            <Table
              dataSource={salesPersonData}
              columns={salesPersonColumns}
              pagination={false}
            />
          </Card>
        </Col>
      </Row>

      <Card title="All Sales Persons Income Contribution" style={{ marginTop: 16 }}>
        <Radio.Group
          value={contributionType}
          onChange={(e) => setContributionType(e.target.value)}
          style={{ marginBottom: 16 }}
        >
          <Radio.Button value="cumulative">Cumulative</Radio.Button>
          <Radio.Button value="daily">Daily</Radio.Button>
        </Radio.Group>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={contributionType === 'cumulative' ? cumulativeData : salesData.dailyContribution}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => new Date(value).toLocaleDateString()}
            />
            <YAxis tickFormatter={formatCurrency} />
            <Tooltip
              formatter={(value) => formatCurrency(value)}
              labelFormatter={(label) => new Date(label).toLocaleDateString()}
            />
            <Legend />
            {salesData.salesPersons.map((person, index) => (
              <Line
                key={person.name}
                type="monotone"
                dataKey={person.name}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
                dot={contributionType === 'daily' ? { stroke: colors[index % colors.length], strokeWidth: 2, r: 4 } : false}
                activeDot={{ r: 8 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Individual Sales Person Performance" style={{ marginTop: 16 }}>
        <Select
          style={{ width: 200, marginBottom: 16 }}
          value={selectedSalesPerson}
          onChange={setSelectedSalesPerson}
        >
          {salesData.salesPersons.map(person => (
            <Option key={person.name} value={person.name}>{person.name}</Option>
          ))}
        </Select>
        <Row gutter={16}>
          <Col span={12}>
            <h3>Breakdown by Top 10 Clients</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={prepareIndividualData(salesData.individualPerformance[selectedSalesPerson], 'clients')}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <YAxis tickFormatter={formatCurrency} />
                <Tooltip
                  formatter={(value) => formatCurrency(value)}
                  labelFormatter={(label) => new Date(label).toLocaleDateString()}
                />
                <Legend />
                {Object.keys(prepareIndividualData(salesData.individualPerformance[selectedSalesPerson], 'clients')[0])
                  .filter(key => key !== 'date')
                  .map((client, index) => (
                    <Area
                      key={client}
                      type="monotone"
                      dataKey={client}
                      stackId="1"
                      stroke={colors[index % colors.length]}
                      fill={colors[index % colors.length]}
                    />
                  ))}
              </AreaChart>
            </ResponsiveContainer>
          </Col>
          <Col span={12}>
            <h3>Breakdown by Top 10 Funds</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={prepareIndividualData(salesData.individualPerformance[selectedSalesPerson], 'funds')}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <YAxis tickFormatter={formatCurrency} />
                <Tooltip
                  formatter={(value) => formatCurrency(value)}
                  labelFormatter={(label) => new Date(label).toLocaleDateString()}
                />
                <Legend />
                {Object.keys(prepareIndividualData(salesData.individualPerformance[selectedSalesPerson], 'funds')[0])
                  .filter(key => key !== 'date')
                  .map((fund, index) => (
                    <Area
                      key={fund}
                      type="monotone"
                      dataKey={fund}
                      stackId="1"
                      stroke={colors[index % colors.length]}
                      fill={colors[index % colors.length]}
                    />
                  ))}
              </AreaChart>
            </ResponsiveContainer>
          </Col>
        </Row>
      </Card>

      <Card title="Daily Income Data" style={{ marginTop: 16 }}>
        <Table
          dataSource={dailyIncomeData}
          columns={dailyIncomeColumns}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
}

export default Sales;