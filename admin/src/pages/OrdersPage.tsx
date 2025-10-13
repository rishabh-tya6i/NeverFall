import React from 'react';
import { Eye, Clock, Truck, CheckCircle, XCircle } from 'lucide-react';

// Define the Order structure based on backend model (simplified for front-end use)
interface Order {
  _id: string;
  user: string;
  total: number;
  status: 'pending' | 'confirmed' | 'delivered' | 'cancelled';
  createdAt: string;
  paymentMethod: string;
}

const mockOrders: Order[] = [
  { _id: 'ORD001', user: 'User123', total: 1299.99, status: 'delivered', createdAt: '2025-09-10', paymentMethod: 'razorpay' },
  { _id: 'ORD002', user: 'JaneDoe', total: 450.00, status: 'confirmed', createdAt: '2025-10-12', paymentMethod: 'cod' },
  { _id: 'ORD003', user: 'AdminTest', total: 25.50, status: 'pending', createdAt: '2025-10-13', paymentMethod: 'wallet' },
  { _id: 'ORD004', user: 'JohnSmith', total: 78.90, status: 'cancelled', createdAt: '2025-10-11', paymentMethod: 'payu' },
];

const OrderStatusBadge: React.FC<{ status: Order['status'] }> = ({ status }) => {
  let classes = 'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ';
  let icon: React.ReactNode;

  switch (status) {
    case 'delivered':
      classes += 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      icon = <CheckCircle className="w-3 h-3 mr-1" />;
      break;
    case 'confirmed':
      classes += 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      icon = <Truck className="w-3 h-3 mr-1" />;
      break;
    case 'pending':
      classes += 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      icon = <Clock className="w-3 h-3 mr-1" />;
      break;
    case 'cancelled':
      classes += 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      icon = <XCircle className="w-3 h-3 mr-1" />;
      break;
  }

  return <span className={classes}>{icon}{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
};

const OrdersPage: React.FC = () => {
  // In a real app, this would use fetch or an API client (like axios)
  // to call the backend endpoint: GET /api/orders
  // and handle authentication (e.g., passing the token)
  const [orders, setOrders] = React.useState<Order[]>(mockOrders);
  const [loading, setLoading] = React.useState(false); // Placeholder
  
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Order Management</h2>
      
      <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading orders...</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Order ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Payment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {orders.map((order) => (
                <tr key={order._id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition duration-150">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{order._id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{order.user}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    ${order.total.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 uppercase">{order.paymentMethod}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button 
                      className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 flex items-center"
                      onClick={() => console.log('View order:', order._id)}
                    >
                      <Eye className="w-4 h-4 mr-1" /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default OrdersPage;