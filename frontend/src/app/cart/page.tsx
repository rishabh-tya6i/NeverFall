// frontend/src/app/cart/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { cartAPI, couponAPI } from "@/services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useOrderStore } from "../store/useOrderStore";

export default function CartPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {coupon, setCoupon} = useOrderStore();
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    setUserId(localStorage.getItem("userId"));
  }, []);

  // Fetch cart
  const { data: cart, isLoading } = useQuery({
    queryKey: ["cart", userId],
    queryFn: async () => {
      if (!userId) return null;
      const res = await cartAPI.get(userId);
      return res.data;
    },
    enabled: !!userId,
  });

  // Update quantity mutation
  const updateQuantityMutation = useMutation({
    mutationFn: async ({ variantId, action }: { variantId: string; action: "add" | "remove" }) => {
      if (!userId) throw new Error("Please login first");
      
      if (action === "add") {
        return cartAPI.add({ userId, variantId, quantity: 1 });
      } else {
        const item = cart.items.find((i: any) => i.variant._id === variantId);
        return cartAPI.remove({ userId, variantId, size: item.size });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart", userId] });
    },
  });

  // Remove item mutation
  const removeItemMutation = useMutation({
    mutationFn: async (variantId: string) => {
      if (!userId) throw new Error("Please login first");
      return cartAPI.delete({ userId, variantId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart", userId] });
    },
  });

  // Apply coupon mutation
  const applyCouponMutation = useMutation({
    mutationFn: async () => {
      if (!userId || !cart) throw new Error("Cart not found");
      
      const items = cart.items.map((item: any) => ({
        product: item.product,
        price: item.price,
        quantity: item.quantity,
      }));

      const res = await couponAPI.validate({
        code: coupon,
        userId,
        items,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setAppliedCoupon(data);
      alert(`Coupon applied! You saved ₹${data.discountAmount}`);
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || "Invalid coupon code");
    },
  });

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

  if (!userId) {
    return (
      <>
        <Navbar />
        <div className="container mx-auto p-4">
          <div className="alert alert-warning">
            <span>Please login to view your cart</span>
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

  if (!cart || cart.items.length === 0) {
    return (
      <>
        <Navbar />
        <div className="container mx-auto p-4">
          <div className="text-center py-16">
            <h1 className="text-3xl font-bold mb-4">Your cart is empty</h1>
            <p className="text-gray-600 mb-8">Add some products to get started!</p>
            <button onClick={() => router.push("/products")} className="btn btn-primary">
              Continue Shopping
            </button>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  const subtotal = cart.items.reduce(
    (sum: number, item: any) => sum + item.price * item.quantity,
    0
  );
  const discount = appliedCoupon?.discountAmount || 0;
  const total = subtotal - discount;

  return (
    <>
      <Navbar />
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-8">Shopping Cart</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {cart.items.map((item: any) => (
              <div key={item.variant} className="card bg-base-100 shadow">
                <div className="card-body">
                  <div className="flex gap-4">
                    <img
                      src={item.product?.coverImage || "/placeholder.png"}
                      alt={item.title}
                      className="w-24 h-24 object-cover rounded"
                    />
                    <div className="flex-1">
                      <h3 className="font-bold text-lg">{item.title}</h3>
                      <p className="text-sm text-gray-600">
                        Color: {item.color} | Size: {item.size}
                      </p>
                      <p className="text-lg font-semibold mt-2">₹{item.price}</p>
                    </div>
                    <div className="flex flex-col items-end justify-between">
                      <button
                        onClick={() => removeItemMutation.mutate(item.variant)}
                        className="btn btn-ghost btn-sm btn-circle"
                      >
                        ✕
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            updateQuantityMutation.mutate({
                              variantId: item.variant,
                              action: "remove",
                            })
                          }
                          disabled={item.quantity <= 1}
                          className="btn btn-sm btn-outline"
                        >
                          -
                        </button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() =>
                            updateQuantityMutation.mutate({
                              variantId: item.variant,
                              action: "add",
                            })
                          }
                          className="btn btn-sm btn-outline"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="card bg-base-200 sticky top-20">
              <div className="card-body">
                <h2 className="card-title mb-4">Order Summary</h2>

                {/* Coupon Code */}
                <div className="form-control mb-4">
                  <label className="label">
                    <span className="label-text">Have a coupon?</span>
                  </label>
                  <div className="join">
                    <input
                      type="text"
                      placeholder="Enter code"
                      className="input input-bordered join-item flex-1"
                      value={coupon}
                      onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                    />
                    <button
                      onClick={() => applyCouponMutation.mutate()}
                      disabled={!coupon || applyCouponMutation.isPending}
                      className="btn join-item btn-primary"
                    >
                      Apply
                    </button>
                  </div>
                  {appliedCoupon && (
                    <label className="label">
                      <span className="label-text-alt text-success">
                        ✓ Coupon applied: {appliedCoupon.coupon.code}
                      </span>
                    </label>
                  )}
                </div>

                <div className="divider"></div>

                {/* Price Breakdown */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>₹{subtotal.toFixed(2)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-success">
                      <span>Discount</span>
                      <span>-₹{discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="divider"></div>
                  <div className="flex justify-between text-xl font-bold">
                    <span>Total</span>
                    <span>₹{total.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  onClick={() => router.push("/checkout")}
                  className="btn btn-primary w-full mt-6"
                >
                  Proceed to Checkout
                </button>

                <button
                  onClick={() => router.push("/products")}
                  className="btn btn-outline w-full mt-2"
                >
                  Continue Shopping
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}