"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
}

interface ProductsResponse {
  products: Product[];
  nextCursor: string | null;
}

const fetchProducts = async (cursor: string | null, limit = 24) => {
  const res = await axios.get<ProductsResponse>(
    `/api/products/all?limit=${limit}${cursor ? `&cursor=${cursor}` : ""}&sort=new`
  );
  return res.data;
};

const ProductsPage = () => {
  const [cursor, setCursor] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<ProductsResponse>(
    ["products", cursor],
    { queryFn: () => fetchProducts(cursor) },
    { keepPreviousData: true }
  );

  if (isLoading) return <p className="text-center mt-10">Loading...</p>;
  if (isError) return <p className="text-center mt-10">Error fetching products</p>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Products</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {data?.products.map((product:any) => (
          <div
            key={product.id}
            className="card bg-base-100 shadow hover:shadow-lg transition-shadow duration-300"
          >
            <figure>
              <img src={product.image} alt={product.name} className="h-48 w-full object-cover" />
            </figure>
            <div className="card-body">
              <h2 className="card-title">{product.name}</h2>
              <p className="font-semibold">${product.price}</p>
              <div className="card-actions justify-end">
                <button className="btn btn-primary btn-sm">Buy Now</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center mt-8 gap-4">
        <button
          className="btn btn-outline"
          disabled={!cursor}
          onClick={() => setCursor(data?.nextCursor || null)}
        >
          Load More
        </button>
      </div>
    </div>
  );
};

export default ProductsPage;
