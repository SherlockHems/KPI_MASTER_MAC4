import React, { useState, useEffect } from 'react';
import { Table, Spin, Alert, Typography } from 'antd';

const { Text } = Typography;

function Funds({ searchTerm }) {
  const [fundsData, setFundsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchFundsData();
  }, []);

  const fetchFundsData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/funds`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      const processedData = Object.entries(data).map(([fund, stats]) => ({
        key: fund,
        fund,
        ...stats
      }));
      setFundsData(processedData);
    } catch (e) {
      console.error("Error fetching funds data:", e);
      setError(`Failed to fetch funds data: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Spin size="large" />;
  if (error) return (
    <Alert
      message="Error"
      description={
        <div>
          <Text>An error occurred while fetching funds data:</Text>
          <Text code>{error}</Text>
          <Text>Please try refreshing the page or contact support if the issue persists.</Text>
        </div>
      }
      type="error"
      showIcon
    />
  );
  if (!fundsData || fundsData.length === 0) return <Alert message="No funds data available" type="warning" showIcon />;

  const filteredData = fundsData.filter(item =>
    item.fund.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    {
      title: 'Fund Name',
      dataIndex: 'fund',
      key: 'fund',
      sorter: (a, b) => a.fund.localeCompare(b.fund),
    },
    {
      title: 'Mean',
      dataIndex: 'mean',
      key: 'mean',
      sorter: (a, b) => a.mean - b.mean,
      render: (text) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(text),
    },
    {
      title: 'Std',
      dataIndex: 'std',
      key: 'std',
      sorter: (a, b) => a.std - b.std,
      render: (text) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(text),
    },
    {
      title: 'Min',
      dataIndex: 'min',
      key: 'min',
      sorter: (a, b) => a.min - b.min,
      render: (text) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(text),
    },
    {
      title: 'Max',
      dataIndex: 'max',
      key: 'max',
      sorter: (a, b) => a.max - b.max,
      render: (text) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(text),
    },
    {
      title: 'Count',
      dataIndex: 'count',
      key: 'count',
      sorter: (a, b) => a.count - b.count,
    },
  ];

  return (
    <div>
      <h1>Funds</h1>
      <Table dataSource={filteredData} columns={columns} />
    </div>
  );
}

export default Funds;