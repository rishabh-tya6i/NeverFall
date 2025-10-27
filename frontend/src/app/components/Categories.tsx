
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

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {categories.map((category) => (
        <div
          key={category._id}
          className="cursor-pointer group"
          onClick={() => handleCategoryClick(category.name)}
        >
          <div className="aspect-w-1 aspect-h-1 w-full overflow-hidden rounded-lg bg-gray-200 xl:aspect-w-7 xl:aspect-h-8">
            <div className="h-full w-full bg-gray-300 flex items-center justify-center">
              <span className="text-gray-500">No Image</span>
            </div>
          </div>
          <h3 className="mt-4 text-sm text-gray-700">{category.name}</h3>
        </div>
      ))}
    </div>
  );
}
