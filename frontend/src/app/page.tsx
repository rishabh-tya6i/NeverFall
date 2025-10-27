"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { productAPI } from "@/services/api";
import Footer from "./components/Footer";
import Navbar from "./components/Navbar";
import ProductCard from "./components/ProductCard";
import LoadingSpinner from "./components/LoadingSpinner";
import Link from "next/link";
import Categories from "./components/Categories";
import ImageCarousel from "./components/ImageCarousel";
import { useProductStore } from "./store/useProductStore";
import Pagination from "./components/Pagination";
import { useEffect, useState } from "react";
import secureLocalStorage from "react-secure-storage";

export default function Home() {
  const router = useRouter();
  const {
    products,
    loading,
    filters,
    page,
    totalPages,
    fetchProducts,
    setFilters,
  } = useProductStore();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    fetchProducts(filters, page);
    const token = secureLocalStorage.getItem("auth_token");
    if (token) {
      setIsLoggedIn(true);
    }
  }, [page]);

  const handlePageChange = (newPage: number) => {
    useProductStore.setState({ page: newPage });
  };

  // Fetch featured products
  const { data: featuredProducts, isLoading: featuredLoading } = useQuery({
    queryKey: ["featured-products"],
    queryFn: async () => {
      const res = await productAPI.getFeatured({ limit: 6 });
      return res.data;
    },
  });

  // Fetch new arrivals
  const { data: newArrivals, isLoading: newArrivalsLoading } = useQuery({
    queryKey: ["new-arrivals"],
    queryFn: async () => {
      const res = await productAPI.getNewArrivals({ limit: 4 });
      return res.data;
    },
  });

  // Fetch trending products
  const { data: trendingProducts, isLoading: trendingLoading } = useQuery({
    queryKey: ["trending-products"],
    queryFn: async () => {
      const res = await productAPI.getTrending({ limit: 4 });
      return res.data;
    },
  });

  // Fetch recommended products
  const { data: recommendedProducts, isLoading: recommendedLoading } = useQuery({
    queryKey: ["recommended-products"],
    queryFn: async () => {
      const res = await productAPI.getRecommended({ limit: 4 });
      return res.data;
    },
    enabled: isLoggedIn,
  });


  return (
    <>
      <Navbar />
      <ImageCarousel />

       {/* Recommended Products */}
      {isLoggedIn && recommendedProducts && recommendedProducts.items.length > 0 && (
        <div className="bg-base-300 py-12">
          <div className="container mx-auto p-6">
            <h2 className="text-3xl font-bold text-center mb-8">Recommended For You</h2>
            {recommendedLoading ? (
              <LoadingSpinner size="lg" text="Loading recommendations..." />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {recommendedProducts?.items?.map((product: any) => (
                  <ProductCard key={product._id} product={product} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Featured Products */}
      {/* <div className="container mx-auto p-6">
        <h2 className="text-3xl font-bold text-center mb-8">Featured Products</h2>
        {featuredLoading ? (
          <LoadingSpinner size="lg" text="Loading featured products..." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredProducts?.items?.map((product: any) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        )}
      </div> */}

      {/* New Arrivals */}
      <div className="bg-base-200 py-12">
        <div className="container mx-auto p-6">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-bold">New Arrivals</h2>
            <button
              onClick={() => router.push("/products?sort=newest")}
              className="btn btn-outline"
            >
              View All
            </button>
          </div>
          {newArrivalsLoading ? (
            <LoadingSpinner size="lg" text="Loading new arrivals..." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {newArrivals?.items?.map((product: any) => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Hero Section */}
      <div className="hero min-h-screen relative">
        <div className="hero-content text-center text-white">
            <div className="max-w-md">
            <h1 className="text-5xl font-bold mb-4">NeverFall</h1>
            <p className="text-xl mb-8">Your Ultimate Fashion Destination</p>
            <button
              onClick={() => router.push("/products")}
              className="btn btn-accent btn-lg"
            >
              Shop Now
            </button>
          </div>
        </div>
        <video
          className="absolute top-0 left-0 w-full h-full object-cover"
          src="/hero.mp4"
          autoPlay
          loop
          muted
        />
      </div>

      {/* Trending Products */}
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold">Trending Now</h2>
          <button
            onClick={() => router.push("/products?sort=trending")}
            className="btn btn-outline"
          >
            View All
          </button>
        </div>
        {trendingLoading ? (
          <LoadingSpinner size="lg" text="Loading trending products..." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {trendingProducts?.items?.map((product: any) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        )}
      </div>

      <ImageCarousel />

      <Categories />

      <div className="lg:col-span-3">
        {loading ? (
          <LoadingSpinner size="lg" text="Loading products..." />
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <h2 className="text-2xl font-bold mb-4">No products found</h2>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {products.map((product: any) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {/* Pagination */}
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              className="mt-8"
            />
          </>
        )}
      </div>

      {/* Features Section */}
      <div className="bg-base-200 py-12">
        <div className="container mx-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-4xl mb-4">🚚</div>
              <h3 className="text-xl font-semibold mb-2">Free Shipping</h3>
              <p className="text-gray-600">On orders over ₹999</p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">↩️</div>
              <h3 className="text-xl font-semibold mb-2">Easy Returns</h3>
              <p className="text-gray-600">30-day return policy</p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">🔒</div>
              <h3 className="text-xl font-semibold mb-2">Secure Payment</h3>
              <p className="text-gray-600">100% secure transactions</p>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}