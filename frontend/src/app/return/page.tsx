"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { orderAPI, returnAPI } from "@/services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export default function ReturnPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const orderId = searchParams.get("orderId");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [returnReason, setReturnReason] = useState("");
  const [returnDescription, setReturnDescription] = useState("");
  const [returnImages, setReturnImages] = useState<File[]>([]);

  // Fetch order details if orderId is provided
  const { data: order, isLoading } = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const res = await orderAPI.get(orderId);
      return res.data;
    },
    enabled: !!orderId,
  });

  // Create return request mutation
  const createReturnMutation = useMutation({
    mutationFn: async (data: any) => {
      return returnAPI.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["returns"]);
      alert("Return request submitted successfully");
      router.push("/returns");
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || "Failed to submit return request");
    },
  });

  const handleItemToggle = (itemId: string) => {
    setSelectedItems((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setReturnImages((prev) => [...prev, ...files].slice(0, 5)); // Max 5 images
  };

  const handleSubmitReturn = () => {
    if (selectedItems.length === 0) {
      alert("Please select at least one item to return");
      return;
    }
    if (!returnReason) {
      alert("Please select a return reason");
      return;
    }

    const returnData = {
      orderId,
      items: selectedItems.map((itemId) => {
        const item = order.items.find((i: any) => i._id === itemId);
        return {
          itemId,
          quantity: item.quantity,
          reason: returnReason,
        };
      }),
      reason: returnReason,
      description: returnDescription,
      images: returnImages.map((file) => file.name), // In real app, upload to server first
    };

    createReturnMutation.mutate(returnData);
  };

  if (!mounted) {
    return (
      <>
        <Navbar />
        <div className="container mx-auto p-4">
          <div className="flex justify-center items-center min-h-screen">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <Navbar />
        <div className="container mx-auto p-4">
          <div className="flex justify-center items-center min-h-screen">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  if (!orderId || !order) {
    return (
      <>
        <Navbar />
        <div className="container mx-auto p-4">
          <div className="alert alert-error">
            <span>Order not found or invalid order ID</span>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  if (order.status !== "delivered") {
    return (
      <>
        <Navbar />
        <div className="container mx-auto p-4">
          <div className="alert alert-warning">
            <span>This order is not yet delivered. Returns are only available for delivered orders.</span>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="container mx-auto p-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Request Return</h1>

          {/* Order Info */}
          <div className="card bg-base-100 shadow mb-6">
            <div className="card-body">
              <h2 className="card-title">Order Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p><strong>Order Number:</strong> #{order.orderNumber}</p>
                  <p><strong>Order Date:</strong> {new Date(order.createdAt).toLocaleDateString()}</p>
                  <p><strong>Total Amount:</strong> ₹{order.totalAmount}</p>
                </div>
                <div>
                  <p><strong>Status:</strong> {order.status}</p>
                  <p><strong>Delivery Date:</strong> {order.deliveredAt ? new Date(order.deliveredAt).toLocaleDateString() : "N/A"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Select Items to Return */}
          <div className="card bg-base-100 shadow mb-6">
            <div className="card-body">
              <h2 className="card-title mb-4">Select Items to Return</h2>
              <div className="space-y-4">
                {order.items.map((item: any) => (
                  <div key={item._id} className="flex items-center gap-4 p-4 bg-base-200 rounded-lg">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary"
                      checked={selectedItems.includes(item._id)}
                      onChange={() => handleItemToggle(item._id)}
                    />
                    <img
                      src={item.product?.coverImage || "/placeholder.png"}
                      alt={item.title}
                      className="w-16 h-16 object-cover rounded"
                    />
                    <div className="flex-1">
                      <h3 className="font-semibold">{item.title}</h3>
                      <p className="text-sm text-gray-600">
                        Size: {item.size} | Color: {item.color} | Qty: {item.quantity}
                      </p>
                      <p className="font-semibold">₹{item.price}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Return Reason */}
          <div className="card bg-base-100 shadow mb-6">
            <div className="card-body">
              <h2 className="card-title mb-4">Return Reason</h2>
              <div className="space-y-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Reason for return *</span>
                  </label>
                  <select
                    className="select select-bordered"
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                  >
                    <option value="">Select a reason</option>
                    <option value="defective">Defective/Damaged</option>
                    <option value="wrong-size">Wrong Size</option>
                    <option value="wrong-item">Wrong Item</option>
                    <option value="not-as-described">Not as described</option>
                    <option value="changed-mind">Changed mind</option>
                    <option value="quality-issue">Quality issue</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Additional details (optional)</span>
                  </label>
                  <textarea
                    className="textarea textarea-bordered h-24"
                    placeholder="Please provide more details about your return..."
                    value={returnDescription}
                    onChange={(e) => setReturnDescription(e.target.value)}
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Upload images (optional)</span>
                  </label>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="file-input file-input-bordered w-full"
                  />
                  <label className="label">
                    <span className="label-text-alt">Upload up to 5 images to support your return request</span>
                  </label>
                </div>

                {returnImages.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {returnImages.map((file, index) => (
                      <div key={index} className="badge badge-outline">
                        {file.name}
                        <button
                          onClick={() => setReturnImages(prev => prev.filter((_, i) => i !== index))}
                          className="ml-2"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Return Policy */}
          <div className="card bg-base-200 shadow mb-6">
            <div className="card-body">
              <h2 className="card-title">Return Policy</h2>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>Returns are accepted within 30 days of delivery</li>
                <li>Items must be in original condition with tags attached</li>
                <li>Return shipping will be arranged by us</li>
                <li>Refund will be processed within 5-7 business days after receiving the returned items</li>
                <li>Customized or personalized items cannot be returned</li>
              </ul>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-4 justify-end">
            <button
              onClick={() => router.back()}
              className="btn btn-outline"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitReturn}
              disabled={createReturnMutation.isLoading || selectedItems.length === 0 || !returnReason}
              className="btn btn-primary"
            >
              {createReturnMutation.isLoading ? "Submitting..." : "Submit Return Request"}
            </button>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
