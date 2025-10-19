import React, { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Package } from 'lucide-react';
import { useProductStore } from '@/store/useProductStore';
import Table from '@/components/Table';
import Pagination from '@/components/Pagination';
import Modal from '@/components/Modal';
import ProductForm from './ProductForm';
import toast from 'react-hot-toast';
import { Product } from '@/types';

const Products: React.FC = () => {
  const { products, total, page, totalPages, loading, fetchProducts, deleteProduct } =
    useProductStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  useEffect(() => {
    fetchProducts(1);
  }, []);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteProduct(id);
        toast.success('Product deleted successfully');
      } catch (error) {
        toast.error('Failed to delete product');
      }
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const handleSuccess = () => {
    handleCloseModal();
    fetchProducts(page);
  };

  const columns = [
  {
    key: 'coverImage',
    header: 'Image',
    render: (item: Product) => (
      <img
        src={item.coverImage || '/placeholder.png'}
        alt={item.title}
        className="h-12 w-12 rounded-lg object-cover"
      />
    ),
  },
  { 
    key: 'title', 
    header: 'Title',
    render: (item: Product) => (
      <div>
        <p className="font-medium">{item.title}</p>
        {item.isTrending && (
          <span className="mt-1 inline-block rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-800">
            Trending
          </span>
        )}
      </div>
    ),
  },
  { key: 'colorLabel', header: 'Color' },
  {
    key: 'priceFrom',
    header: 'Price',
    render: (item: Product) => `₹${item.priceFrom}`,
  },
  {
    key: 'availableSizes',
    header: 'Sizes',
    render: (item: Product) => item.availableSizes.join(', '),
  },
  {
    key: 'collections',
    header: 'Collections',
    render: (item: Product) => (
      <div className="flex flex-wrap gap-1">
        {item.collections.slice(0, 2).map((collection, idx) => (
          <span
            key={idx}
            className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800"
          >
            {collection}
          </span>
        ))}
        {item.collections.length > 2 && (
          <span className="text-xs text-gray-500">
            +{item.collections.length - 2}
          </span>
        )}
      </div>
    ),
  },
  {
    key: 'stats',
    header: 'Stats',
    render: (item: Product) => (
      <div className="text-xs text-gray-600">
        <div>Clicks: {item.clicks}</div>
        <div>Purchases: {item.purchases}</div>
      </div>
    ),
  },
  {
    key: 'inStock',
    header: 'Stock',
    render: (item: Product) => (
      <span
        className={`rounded-full px-2 py-1 text-xs ${
          item.inStock
            ? 'bg-green-100 text-green-800'
            : 'bg-red-100 text-red-800'
        }`}
      >
        {item.inStock ? 'In Stock' : 'Out of Stock'}
      </span>
    ),
  },
  {
    key: 'actions',
    header: 'Actions',
    render: (item: Product) => (
      <div className="flex space-x-2">
        <button
          onClick={() => handleEdit(item)}
          className="rounded p-1 text-blue-600 hover:bg-blue-50"
        >
          <Edit className="h-4 w-4" />
        </button>
        <button
          onClick={() => handleDelete(item._id)}
          className="rounded p-1 text-red-600 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    ),
  },
];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700"
        >
          <Plus className="mr-2 h-5 w-5" />
          Add Product
        </button>
      </div>

      <div className="rounded-lg bg-white shadow">
        <Table
          columns={columns}
          data={products}
          keyExtractor={(item) => item._id}
          loading={loading}
        />
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={fetchProducts}
        />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingProduct ? 'Edit Product' : 'Add Product'}
        size="xl"
      >
        <ProductForm
          product={editingProduct}
          onSuccess={handleSuccess}
          onCancel={handleCloseModal}
        />
      </Modal>
    </div>
  );
};

export default Products;