"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { productAPI } from "@/services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ProductCard from "../components/ProductCard";
import LoadingSpinner from "../components/LoadingSpinner";
import Pagination from "../components/Pagination";
import SearchBar from "../components/SearchBar";
import Link from "next/link";

export default function ProductsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState({
    search: searchParams.get("q") || "",
    sort: searchParams.get("sort") || "newest",
    color: searchParams.get("color") || "",
    size: searchParams.get("size") || "",
    minPrice: searchParams.get("minPrice") || "",
    maxPrice: searchParams.get("maxPrice") || "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Fetch products
  const { data: productsData, isLoading } = useQuery({
    queryKey: ["products", filters, currentPage],
    queryFn: async () => {
      const params: any = {
        limit: 12,
        page: currentPage,
      };

      if (filters.search) {
        const res = await productAPI.search({ q: filters.search, limit: 12 });
        return res.data;
      } else if (filters.sort === "featured") {
        const res = await productAPI.getFeatured({ limit: 12 });
        return res.data;
      } else if (filters.sort === "trending") {
        const res = await productAPI.getTrending({ limit: 12 });
        return res.data;
      } else if (filters.sort === "newest") {
        const res = await productAPI.getNewArrivals({ limit: 12 });
        return res.data;
      } else {
        const res = await productAPI.getByFilter({
          ...filters,
          limit: 12,
          page: currentPage,
        });
        return res.data;
      }
    },
  });

  // Fetch facets for filters
  const { data: facetsData } = useQuery({
    queryKey: ["facets"],
    queryFn: async () => {
      const res = await productAPI.getFacets();
      return res.data;
    },
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      sort: "newest",
      color: "",
      size: "",
      minPrice: "",
      maxPrice: "",
    });
    setCurrentPage(1);
  };

  const products = productsData?.items || [];
  const totalPages = Math.ceil((productsData?.total || 0) / 12);

  return (
    <>
      <Navbar />
      <div className="container mx-auto p-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <h1 className="text-3xl font-bold">Products</h1>
          <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
            <SearchBar 
              placeholder="Search products..."
              className="w-full md:w-80"
              onSearch={(query) => handleFilterChange("search", query)}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="btn btn-outline lg:hidden"
              >
                Filters
              </button>
              <select
                value={filters.sort}
                onChange={(e) => handleFilterChange("sort", e.target.value)}
                className="select select-bordered"
              >
                <option value="newest">Newest</option>
                <option value="featured">Featured</option>
                <option value="trending">Trending</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters Sidebar */}
          <div className={`lg:col-span-1 ${showFilters ? "block" : "hidden lg:block"}`}>
            <div className="card bg-base-200">
              <div className="card-body">
                <h3 className="card-title">Filters</h3>


                {/* Price Range */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Price Range</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      className="input input-bordered flex-1"
                      value={filters.minPrice}
                      onChange={(e) => handleFilterChange("minPrice", e.target.value)}
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      className="input input-bordered flex-1"
                      value={filters.maxPrice}
                      onChange={(e) => handleFilterChange("maxPrice", e.target.value)}
                    />
                  </div>
                </div>

                {/* Colors */}
                {facetsData?.colors && facetsData.colors.length > 0 && (
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Colors</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {facetsData.colors.map((color: any, index: number) => (
                        <button
                          key={`color-${index}-${typeof color === 'string' ? color : color.color || color.name}`}
                          onClick={() => {
                            const colorValue = typeof color === 'string' ? color : color.color || color.name;
                            handleFilterChange("color", filters.color === colorValue ? "" : colorValue);
                          }}
                          className={`btn btn-sm ${
                            filters.color === (typeof color === 'string' ? color : color.color || color.name) ? "btn-primary" : "btn-outline"
                          }`}
                        >
                          {typeof color === 'string' ? color : color.color || color.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sizes */}
                {facetsData?.sizes && facetsData.sizes.length > 0 && (
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Sizes</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {facetsData.sizes.map((size: any, index: number) => (
                        <button
                          key={`size-${index}-${typeof size === 'string' ? size : size.size || size.name}`}
                          onClick={() => {
                            const sizeValue = typeof size === 'string' ? size : size.size || size.name;
                            handleFilterChange("size", filters.size === sizeValue ? "" : sizeValue);
                          }}
                          className={`btn btn-sm ${
                            filters.size === (typeof size === 'string' ? size : size.size || size.name) ? "btn-primary" : "btn-outline"
                          }`}
                        >
                          {typeof size === 'string' ? size : size.size || size.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={clearFilters} className="btn btn-outline w-full mt-4">
                  Clear Filters
                </button>
              </div>
            </div>
          </div>

          {/* Products Grid */}
          <div className="lg:col-span-3">
            {isLoading ? (
              <LoadingSpinner size="lg" text="Loading products..." />
            ) : products.length === 0 ? (
              <div className="text-center py-16">
                <h2 className="text-2xl font-bold mb-4">No products found</h2>
                <p className="text-gray-600 mb-8">Try adjusting your filters or search terms</p>
                <button onClick={clearFilters} className="btn btn-primary">
                  Clear Filters
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {products.map((product: any) => (
                    <ProductCard key={product._id} product={product} />
                  ))}
                </div>

                {/* Pagination */}
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  className="mt-8"
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