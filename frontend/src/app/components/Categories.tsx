
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCategoryStore } from '@/app/store/useCategoryStore';

export default function Categories() {
  const router = useRouter();
  const { categories, loading, error, fetchCategories } = useCategoryStore();
  console.log(categories);
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleCategoryClick = (categoryName: string) => {
    router.push(`/products?categories=${categoryName}`);
  };

  const getCategoryStyle = (name: any) => {
    switch (name.toLowerCase()) {
      case "electronics":
        return "text-blue-300";
      case "fashion":
        return "text-pink-200";
      case "home":
        return "text-yellow-200";
      case "sports":
        return "text-green-200";
      case "beauty":
        return "text-rose-300";
      default:
        return "text-white";
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div className="grid mt-2 mx-2 grid-cols-2 md:grid-cols-4 gap-4">
      {categories.map((category) => (
        <div
          key={category._id}
          className="relative cursor-pointer group rounded-xl overflow-hidden"
          onClick={() => handleCategoryClick(category.name)}
        >
          <img
            src={category.image}
            alt={category.name}
            className="h-80 w-full object-cover object-center transition-all duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition-all duration-300"></div>
          <h3
            className={`absolute inset-0 flex items-center justify-center text-2xl font-semibold text-white drop-shadow-md transition-all duration-300 group-hover:scale-110
              ${getCategoryStyle(category.name)}
            `}
          >
            {category.name}
          </h3>
        </div>
      ))}
    </div>
  );
}
