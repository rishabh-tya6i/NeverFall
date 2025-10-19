import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { productApi } from '@/api/products';
import toast from 'react-hot-toast';
import { Product, ProductImage } from '@/types';
import { Plus, X, Trash2 } from 'lucide-react';

interface ProductFormProps {
  product?: Product | null;
  onSuccess: () => void;
  onCancel: () => void;
}

interface FormData {
  title: string;
  slug: string;
  description?: string;
  color: string;
  colorLabel: string;
  coverImage: string;
  tags?: string;
  primaryCategoryId?: string;
  parent?: string;
  collections?: string;
  isTrending?: boolean;
}

const ProductForm: React.FC<ProductFormProps> = ({
  product,
  onSuccess,
  onCancel,
}) => {
  const [loading, setLoading] = useState(false);
  
  // Images state - array of {url, alt}
  const [images, setImages] = useState<ProductImage[]>(
    product?.images || []
  );
  
  // Variants state
  const [variants, setVariants] = useState(
    product
      ? []
      : [{ size: '', sku: '', price: 0, compareAtPrice: 0, stock: 0 }]
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: product
      ? {
          title: product.title,
          slug: product.slug,
          color: product.color,
          colorLabel: product.colorLabel,
          coverImage: product.coverImage,
          primaryCategoryId: product.primaryCategoryId,
          collections: product.collections?.join(', '),
          isTrending: product.isTrending,
        }
      : {
          isTrending: false,
        },
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      // Parse collections
      const collectionsArray = data.collections
        ? data.collections
            .split(',')
            .map((c) => c.trim())
            .filter((c) => c.length > 0)
        : [];

      // Validate images
      const validImages = images.filter(img => img.url && img.url.trim().length > 0);

      const payload = {
        title: data.title,
        slug: data.slug,
        description: data.description || '',
        color: data.color,
        colorLabel: data.colorLabel,
        coverImage: data.coverImage,
        images: validImages,
        collections: collectionsArray,
        primaryCategoryId: data.primaryCategoryId || null,
        parent: data.parent || null,
        isTrending: data.isTrending || false,
        variants: variants.filter(v => v.size && v.sku),
      };

      if (product) {
        await productApi.updateProduct(product._id, payload);
        toast.success('Product updated successfully');
      } else {
        if (variants.length === 0 || !variants.some(v => v.size && v.sku)) {
          toast.error('Please add at least one valid variant');
          setLoading(false);
          return;
        }

        await productApi.createProduct(payload);
        toast.success('Product created successfully');
      }
      onSuccess();
    } catch (error: any) {
      console.error('Product operation error:', error);
      toast.error(error.response?.data?.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  // Image management
  const addImage = () => {
    setImages([...images, { url: '', alt: '' }]);
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const updateImage = (index: number, field: 'url' | 'alt', value: string) => {
    const updated = [...images];
    updated[index] = { ...updated[index], [field]: value };
    setImages(updated);
  };

  // Variant management
  const addVariant = () => {
    setVariants([
      ...variants,
      { size: '', sku: '', price: 0, compareAtPrice: 0, stock: 0 },
    ]);
  };

  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const updateVariant = (index: number, field: string, value: any) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], [field]: value };
    setVariants(updated);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Basic Information */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Title *
          </label>
          <input
            {...register('title', { required: 'Title is required' })}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none"
            placeholder="Product Title"
          />
          {errors.title && (
            <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Slug *
          </label>
          <input
            {...register('slug', { required: 'Slug is required' })}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none"
            placeholder="product-slug"
          />
          {errors.slug && (
            <p className="mt-1 text-sm text-red-600">{errors.slug.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Color *
          </label>
          <input
            {...register('color', { required: 'Color is required' })}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none"
            placeholder="red"
          />
          {errors.color && (
            <p className="mt-1 text-sm text-red-600">{errors.color.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Color Label *
          </label>
          <input
            {...register('colorLabel', { required: 'Color label is required' })}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none"
            placeholder="Red"
          />
          {errors.colorLabel && (
            <p className="mt-1 text-sm text-red-600">{errors.colorLabel.message}</p>
          )}
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700">
            Cover Image URL *
          </label>
          <input
            {...register('coverImage', { required: 'Cover image is required' })}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none"
            placeholder="https://example.com/image.jpg"
          />
          {errors.coverImage && (
            <p className="mt-1 text-sm text-red-600">{errors.coverImage.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Collections (comma-separated)
          </label>
          <input
            {...register('collections')}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none"
            placeholder="summer, trending, new-arrival"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Category ID
          </label>
          <input
            {...register('primaryCategoryId')}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none"
            placeholder="Category ObjectId"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Parent Product ID
          </label>
          <input
            {...register('parent')}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none"
            placeholder="Parent Product ObjectId (optional)"
          />
          <p className="mt-1 text-xs text-gray-500">
            Leave empty to create a new parent product
          </p>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            {...register('isTrending')}
            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <label className="ml-2 block text-sm text-gray-700">
            Mark as Trending
          </label>
        </div>
      </div>

      {/* Images Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Product Images</h3>
          <button
            type="button"
            onClick={addImage}
            className="flex items-center rounded-lg bg-primary-600 px-3 py-1 text-sm text-white hover:bg-primary-700"
          >
            <Plus className="mr-1 h-4 w-4" />
            Add Image
          </button>
        </div>

        {images.length === 0 && (
          <p className="text-sm text-gray-500">
            No additional images. Click "Add Image" to add more product images.
          </p>
        )}

        {images.map((image, index) => (
          <div
            key={index}
            className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-3 md:grid-cols-12"
          >
            <div className="md:col-span-7">
              <label className="block text-xs font-medium text-gray-700">
                Image URL
              </label>
              <input
                value={image.url}
                onChange={(e) => updateImage(index, 'url', e.target.value)}
                className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
                placeholder="https://example.com/image.jpg"
              />
            </div>
            <div className="md:col-span-4">
              <label className="block text-xs font-medium text-gray-700">
                Alt Text
              </label>
              <input
                value={image.alt}
                onChange={(e) => updateImage(index, 'alt', e.target.value)}
                className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
                placeholder="Product from front"
              />
            </div>
            <div className="flex items-end md:col-span-1">
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="flex w-full items-center justify-center rounded bg-red-600 px-2 py-1 text-white hover:bg-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Variants Section */}
      {!product && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Variants *</h3>
            <button
              type="button"
              onClick={addVariant}
              className="flex items-center rounded-lg bg-primary-600 px-3 py-1 text-sm text-white hover:bg-primary-700"
            >
              <Plus className="mr-1 h-4 w-4" />
              Add Variant
            </button>
          </div>

          {variants.length === 0 && (
            <p className="text-sm text-gray-500">
              No variants added. Click "Add Variant" to add product variants.
            </p>
          )}

          {variants.map((variant, index) => (
            <div
              key={index}
              className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 p-4 md:grid-cols-6"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Size *
                </label>
                <input
                  value={variant.size}
                  onChange={(e) => updateVariant(index, 'size', e.target.value.toUpperCase())}
                  className="mt-1 block w-full rounded border border-gray-300 px-2 py-1"
                  placeholder="M"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  SKU *
                </label>
                <input
                  value={variant.sku}
                  onChange={(e) => updateVariant(index, 'sku', e.target.value)}
                  className="mt-1 block w-full rounded border border-gray-300 px-2 py-1"
                  placeholder="SKU123"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Price *
                </label>
                <input
                  type="number"
                  value={variant.price}
                  onChange={(e) =>
                    updateVariant(index, 'price', Number(e.target.value))
                  }
                  className="mt-1 block w-full rounded border border-gray-300 px-2 py-1"
                  placeholder="999"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Compare At
                </label>
                <input
                  type="number"
                  value={variant.compareAtPrice || ''}
                  onChange={(e) =>
                    updateVariant(index, 'compareAtPrice', Number(e.target.value) || 0)
                  }
                  className="mt-1 block w-full rounded border border-gray-300 px-2 py-1"
                  placeholder="1299"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Stock *
                </label>
                <input
                  type="number"
                  value={variant.stock}
                  onChange={(e) =>
                    updateVariant(index, 'stock', Number(e.target.value))
                  }
                  className="mt-1 block w-full rounded border border-gray-300 px-2 py-1"
                  placeholder="100"
                  min="0"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => removeVariant(index)}
                  className="flex w-full items-center justify-center rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
                >
                  <X className="mr-1 h-4 w-4" />
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Actions */}
      <div className="flex justify-end space-x-3 border-t pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {loading ? 'Saving...' : product ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
};

export default ProductForm;