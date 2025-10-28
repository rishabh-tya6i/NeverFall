'use client';

import { Suspense, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { productAPI } from '@/services/api';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ProductCard from '../components/ProductCard';
import LoadingSpinner from '../components/LoadingSpinner';
import Pagination from '../components/Pagination';
import SearchBar from '../components/SearchBar';
import FilterSidebar from '../components/FilterSidebar';
import { useProductStore } from '../store/useProductStore';
import { useCategoryStore } from '../store/useCategoryStore';

function ProductsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    products,
    loading,
    filters,
    page,
    totalPages,
    fetchProducts,
    setFilters,
  } = useProductStore();
  const { categories, fetchCategories } = useCategoryStore();

  useEffect(() => {
    const initialFilters = {
      search: searchParams.get('q') || '',
      sort: searchParams.get('sort') || 'newest',
      category: searchParams.get('category') || '',
      priceRange: searchParams.get('price') || '',
    };
    setFilters(initialFilters);
    fetchCategories();
  }, []);

  useEffect(() => {
    const query = new URLSearchParams();
    if (filters.search) query.set('q', filters.search);
    if (filters.sort) query.set('sort', filters.sort);
    if (filters.category) query.set('category', filters.category);
    if (filters.priceRange) query.set('price', filters.priceRange);
    router.push(`${window.location.pathname}?${query.toString()}`);
    fetchProducts(filters, page);
  }, [filters, page]);

  // Fetch facets for filters
  const { data: facetsData } = useQuery({
    queryKey: ['facets', filters],
    queryFn: async () => {
      const res = await productAPI.getFacets(filters);
      return res.data;
    },
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  const handlePageChange = (newPage: number) => {
    useProductStore.setState({ page: newPage });
  };
  
  const clearFilters = () => {
    setFilters({
      search: '',
      sort: 'newest',
      category: '',
      priceRange: '',
    });
  };

  return (
    <>
      <Navbar />
      <div className='container mx-auto p-4'>
        <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6'>
          <h1 className='text-3xl font-bold'>Products</h1>
          <div className='flex flex-col md:flex-row gap-2 w-full md:w-auto'>
            <SearchBar
              placeholder='Search products...'
              className='w-full md:w-80'
              onSearch={(query) => handleFilterChange('search', query)}
            />
            <div className='flex gap-2'>
              <select
                value={filters.sort}
                onChange={(e) => handleFilterChange('sort', e.target.value)}
                className='select select-bordered'
              >
                <option value='newest'>Newest</option>
                <option value='featured'>Featured</option>
                <option value='trending'>Trending</option>
                <option value='price-low'>Price: Low to High</option>
                <option value='price-high'>Price: High to Low</option>
              </select>
            </div>
          </div>
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-4 gap-6'>
          {/* Filters Sidebar */}
          <FilterSidebar
            filters={filters}
            handleFilterChange={handleFilterChange}
            clearFilters={clearFilters}
            facetsData={facetsData}
            categories={categories}
          />
          {/* Products Grid */}
          <div className='lg:col-span-3'>
            {loading ? (
              <LoadingSpinner size='lg' text='Loading products...' />
            ) : products.length === 0 ? (
              <div className='text-center py-16'>
                <h2 className='text-2xl font-bold mb-4'>No products found</h2>
                <p className='text-gray-600 mb-8'>Try adjusting your filters or search terms</p>
                <button onClick={clearFilters} className='btn btn-primary'>
                  Clear Filters
                </button>
              </div>
            ) : (
              <>
                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
                  {products.map((product: any) => (
                    <ProductCard key={product._id} product={product} />
                  ))}
                </div>

                {/* Pagination */}
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                  className='mt-8'
                />
              </>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ProductsPageContent />
    </Suspense>
  );
}