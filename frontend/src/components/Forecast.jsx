import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Spin, Alert, Card } from 'antd';

function Forecast() {
  const [forecastData, setForecastData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchForecastData();
  }, []);

  const fetchForecastData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/forecast`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setForecastData(data);
    } catch (e) {
      setError(`Failed to fetch forecast data: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Spin size="large" />;
  if (error) return <Alert message="Error" description={error} type="error" showIcon />;
  if (!forecastData) return <Alert message="No forecast data available" type="warning" showIcon />;

  const formatData = (data) => {
    return Object.entries(data).map(([date, value]) => ({ date, value }));
  };

  const simpleData = formatData(forecastData.simple.cumulative);
  const complexData = formatData(forecastData.complex.cumulative);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  return (
    <div>
      <h1>Forecast</h1>
      <Card>
        <h2>Cumulative Income Forecast</h2>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" allowDuplicatedCategory={false} />
            <YAxis tickFormatter={formatCurrency} />
            <Tooltip formatter={formatCurrency} />
            <Legend />
            <Line type="monotone" dataKey="value" data={simpleData} name="Simple Model" stroke="#8884d8" />
            <Line type="monotone" dataKey="value" data={complexData} name="Complex Model" stroke="#82ca9d" />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

export default Forecast;