"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { wishlistAPI, cartAPI } from "@/services/api";

interface ProductCardProps {
  product: {
    _id: string;
    title: string;
    brand?: string;
    coverImage?: string;
    priceFrom: number;
    compareAtFrom?: number;
    variants?: any[];
    slug?: string;
  };
  showWishlist?: boolean;
  showAddToCart?: boolean;
  className?: string;
}

export default function ProductCard({ 
  product, 
  showWishlist = true, 
  showAddToCart = true,
  className = ""
}: ProductCardProps) {
  const queryClient = useQueryClient();
  const [isHovered, setIsHovered] = useState(false);

  // Add to wishlist mutation
  const addToWishlistMutation = useMutation({
    mutationFn: () => wishlistAPI.add({ productId: product._id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
      alert("Added to wishlist!");
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || "Failed to add to wishlist");
    },
  });

  // Add to cart mutation
  const addToCartMutation = useMutation({
    mutationFn: async () => {
      const userId = localStorage.getItem("userId");
      if (!userId) throw new Error("Please login first");
      
      // Use the first available variant
      const firstVariant = product.variants?.[0];
      if (!firstVariant) throw new Error("No variants available");

      return cartAPI.add({
        userId,
        variantId: firstVariant._id,
        quantity: 1,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      alert("Added to cart successfully!");
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || "Failed to add to cart");
    },
  });

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCartMutation.mutate();
  };

  const handleAddToWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToWishlistMutation.mutate();
  };

  return (
    <div 
      className={`card bg-base-100 shadow-sm hover:shadow-lg transition-all duration-300 ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link href={`/products/${product.slug || product._id}`}>
        <figure className="relative">
          <img
            src={`http://13.61.7.132:8080/${product.coverImage}` || "/placeholder.png"}
            alt={product.title}
            className="w-full h-80 object-cover"
          />
          {product.compareAtFrom && (
            <div className="absolute top-2 left-2">
              <div className="badge badge-error">
                {Math.round(((product.compareAtFrom - product.priceFrom) / product.compareAtFrom) * 100)}% OFF
              </div>
            </div>
          )}
          {showWishlist && (
            <button
              onClick={handleAddToWishlist}
              className={`absolute top-2 right-2 btn btn-circle btn-sm ${
                isHovered ? "opacity-100" : "opacity-0"
              } transition-opacity duration-200`}
            >
              ❤️
            </button>
          )}
        </figure>
        <div className="card-body">
          <h2 className="card-title text-lg line-clamp-2">{product.title}</h2>
          {product.brand && (
            <p className="text-sm text-gray-600">{product.brand}</p>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-primary">
              ₹{product.priceFrom}
            </span>
            {product.compareAtFrom && (
              <span className="text-sm line-through text-gray-500">
                ₹{product.compareAtFrom}
              </span>
            )}
          </div>
          {/* <div className="card-actions justify-between items-center mt-2">
            <div className="badge badge-outline">
              {product.variants?.length || 0} variants
            </div>
            {showAddToCart && (
              <button
                onClick={handleAddToCart}
                disabled={addToCartMutation.isPending}
                className="btn btn-primary btn-sm"
              >
                {addToCartMutation.isPending ? (
                  <span className="loading loading-spinner loading-xs"></span>
                ) : (
                  "Add to Cart"
                )}
              </button>
            )}
          </div> */}
        </div>
      </Link>
    </div>
  );
}
