import React, { useState, useEffect } from 'react';
import { Table, Spin, Alert } from 'antd';

function Clients({ searchTerm }) {
  const [clientsData, setClientsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchClientsData();
  }, []);

  const fetchClientsData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/clients`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setClientsData(data);
    } catch (e) {
      setError(`Failed to fetch clients data: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Spin size="large" />;
  if (error) return <Alert message="Error" description={error} type="error" showIcon />;
  if (!clientsData) return <Alert message="No data available" type="warning" showIcon />;

  const filteredData = clientsData.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    {
      title: 'Client Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'Daily Income',
      dataIndex: 'income',
      key: 'income',
      sorter: (a, b) => a.income - b.income,
      render: (text) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(text),
    },
  ];

  return (
    <div>
      <h1>Clients</h1>
      <Table dataSource={filteredData} columns={columns} />
    </div>
  );
}

export default Clients;