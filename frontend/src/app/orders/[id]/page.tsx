"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { orderAPI } from "@/services/api";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import Link from "next/link";

export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const orderId = params.id as string;

  // Fetch order details
  const { data: order, isLoading } = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      const res = await orderAPI.get(orderId);
      return res.data;
    },
  });

  // Cancel order mutation
  const cancelOrderMutation = useMutation({
    mutationFn: async () => {
      return orderAPI.cancel(orderId, { reason: "Customer requested cancellation" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["order", orderId]);
      queryClient.invalidateQueries(["orders"]);
      alert("Order cancelled successfully");
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || "Failed to cancel order");
    },
  });

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: string } = {
      pending: "badge-warning",
      confirmed: "badge-info",
      shipped: "badge-primary",
      delivered: "badge-success",
      cancelled: "badge-error",
      returned: "badge-neutral",
    };
    return statusMap[status] || "badge-neutral";
  };

  const getStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      pending: "Pending",
      confirmed: "Confirmed",
      shipped: "Shipped",
      delivered: "Delivered",
      cancelled: "Cancelled",
      returned: "Returned",
    };
    return statusMap[status] || status;
  };

  const getTrackingStatus = (status: string) => {
    const steps = [
      { key: "pending", label: "Order Placed" },
      { key: "confirmed", label: "Confirmed" },
      { key: "shipped", label: "Shipped" },
      { key: "delivered", label: "Delivered" },
    ];

    const currentIndex = steps.findIndex((step) => step.key === status);
    return { steps, currentIndex };
  };

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

  if (!order) {
    return (
      <>
        <Navbar />
        <div className="container mx-auto p-4">
          <div className="alert alert-error">Order not found</div>
        </div>
        <Footer />
      </>
    );
  }

  const { steps, currentIndex } = getTrackingStatus(order.status);

  return (
    <>
      <Navbar />
      <div className="container mx-auto p-4">
        {/* Breadcrumbs */}
        <div className="breadcrumbs text-sm mb-6">
          <ul>
            <li>
              <Link href="/">Home</Link>
            </li>
            <li>
              <Link href="/orders">Orders</Link>
            </li>
            <li>Order #{order?._id}</li>
          </ul>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Order Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Header */}
            <div className="card bg-base-100 shadow">
              <div className="card-body">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-2xl font-bold">Order #{order._id}</h1>
                    <p className="text-gray-600">
                      Placed on {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className={`badge ${getStatusBadge(order.status)} text-lg`}>
                      {getStatusText(order.status)}
                    </div>
                    <p className="text-2xl font-bold mt-2">₹{order.total}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Progress */}
            <div className="card bg-base-100 shadow">
              <div className="card-body">
                <h2 className="card-title mb-4">Order Progress</h2>
                <ul className="steps steps-vertical lg:steps-horizontal w-full">
                  {steps.map((step, index) => (
                    <li
                      key={step.key}
                      className={`step ${
                        index <= currentIndex ? "step-primary" : ""
                      } ${order.status === "cancelled" ? "step-error" : ""}`}
                    >
                      {step.label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Order Items */}
            <div className="card bg-base-100 shadow">
              <div className="card-body">
                <h2 className="card-title mb-4">Order Items</h2>
                <div className="space-y-4">
                  {order.items.map((item: any, index: number) => (
                    <div key={index} className="flex gap-4 p-4 bg-base-200 rounded-lg">
                      <img
                        src={item.product?.coverImage || "/placeholder.png"}
                        alt={item.title}
                        className="w-20 h-20 object-cover rounded"
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{item.title}</h3>
                        <p className="text-gray-600">
                          Brand: {item.product?.brand || "N/A"}
                        </p>
                        <p className="text-gray-600">
                          Size: {item.size} | Color: {item.color}
                        </p>
                        <p className="text-gray-600">Quantity: {item.quantity}</p>
                        <p className="text-lg font-bold">₹{item.price}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">
                          ₹{(item.price * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Shipping Address */}
            {order.shippingAddress && (
              <div className="card bg-base-100 shadow">
                <div className="card-body">
                  <h2 className="card-title mb-4">Shipping Address</h2>
                  <div className="text-gray-700">
                    <p className="font-semibold text-lg">{order.shippingAddress.name}</p>
                    <p>{order.shippingAddress.line1}</p>
                    {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                    <p>
                      {order.shippingAddress.city}, {order.shippingAddress.state} -{" "}
                      {order.shippingAddress.pincode}
                    </p>
                    <p>Phone: {order.shippingAddress.phone}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Details */}
            <div className="card bg-base-100 shadow">
              <div className="card-body">
                <h2 className="card-title mb-4">Payment Details</h2>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>₹{order.subtotal?.toFixed(2) || "0.00"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shipping</span>
                    <span className="text-success">FREE</span>
                  </div>
                  {order.discount > 0 && (
                    <div className="flex justify-between text-success">
                      <span>Discount</span>
                      <span>-₹{order.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="divider"></div>
                  <div className="flex justify-between text-xl font-bold">
                    <span>Total</span>
                    <span>₹{order.total}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Payment Method</span>
                    <span>{order.paymentMethod || "N/A"}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Payment Status</span>
                    <span className="capitalize">{order.payments[0].status == 'cod_pending' ? 'Pending' : order.payments[0].status || "N/A"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Order Actions */}
          <div className="lg:col-span-1">
            <div className="card bg-base-200 sticky top-20">
              <div className="card-body">
                <h2 className="card-title mb-4">Order Actions</h2>
                <div className="space-y-3">
                  {order.status === "pending" && (
                    <button
                      onClick={() => {
                        if (confirm("Are you sure you want to cancel this order?")) {
                          cancelOrderMutation.mutate();
                        }
                      }}
                      disabled={cancelOrderMutation.isLoading}
                      className="btn btn-error w-full"
                    >
                      {cancelOrderMutation.isLoading ? "Cancelling..." : "Cancel Order"}
                    </button>
                  )}

                  {order.status === "delivered" && (
                    <Link
                      href={`/return?orderId=${order._id}`}
                      className="btn btn-warning w-full"
                    >
                      Request Return
                    </Link>
                  )}

                  <Link href="/orders" className="btn btn-outline w-full">
                    Back to Orders
                  </Link>

                  <Link href="/products" className="btn btn-primary w-full">
                    Continue Shopping
                  </Link>
                </div>

                {/* Order Summary */}
                <div className="divider"></div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Items</span>
                    <span>{order.items.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total</span>
                    <span className="font-bold">₹{order.total}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
