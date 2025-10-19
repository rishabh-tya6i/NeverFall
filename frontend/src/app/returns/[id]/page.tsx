"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { returnAPI } from "@/services/api";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import Link from "next/link";

export default function ReturnDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const returnId = params.id as string;

  // Fetch return details
  const { data: returnItem, isLoading } = useQuery({
    queryKey: ["return", returnId],
    queryFn: async () => {
      const res = await returnAPI.get(returnId);
      return res.data;
    },
  });

  // Cancel return mutation
  const cancelReturnMutation = useMutation({
    mutationFn: async () => {
      return returnAPI.cancel(returnId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["return", returnId]);
      queryClient.invalidateQueries(["returns"]);
      alert("Return request cancelled successfully");
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || "Failed to cancel return request");
    },
  });

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: string } = {
      pending: "badge-warning",
      approved: "badge-info",
      rejected: "badge-error",
      processing: "badge-primary",
      completed: "badge-success",
      cancelled: "badge-neutral",
    };
    return statusMap[status] || "badge-neutral";
  };

  const getStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      pending: "Pending Review",
      approved: "Approved",
      rejected: "Rejected",
      processing: "Processing",
      completed: "Completed",
      cancelled: "Cancelled",
    };
    return statusMap[status] || status;
  };

  const getTrackingStatus = (status: string) => {
    const steps = [
      { key: "pending", label: "Request Submitted" },
      { key: "approved", label: "Approved" },
      { key: "processing", label: "Processing" },
      { key: "completed", label: "Completed" },
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

  if (!returnItem) {
    return (
      <>
        <Navbar />
        <div className="container mx-auto p-4">
          <div className="alert alert-error">Return request not found</div>
        </div>
        <Footer />
      </>
    );
  }

  const { steps, currentIndex } = getTrackingStatus(returnItem.status);

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
              <Link href="/returns">Returns</Link>
            </li>
            <li>Return #{returnItem.returnNumber || returnItem._id.slice(-8)}</li>
          </ul>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Return Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Return Header */}
            <div className="card bg-base-100 shadow">
              <div className="card-body">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-2xl font-bold">
                      Return Request #{returnItem.returnNumber || returnItem._id.slice(-8)}
                    </h1>
                    <p className="text-gray-600">
                      Requested on {new Date(returnItem.createdAt).toLocaleDateString()}
                    </p>
                    <p className="text-gray-600">
                      Order: #{returnItem.order?.orderNumber || "N/A"}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className={`badge ${getStatusBadge(returnItem.status)} text-lg`}>
                      {getStatusText(returnItem.status)}
                    </div>
                    <p className="text-2xl font-bold mt-2">₹{returnItem.refundAmount || "0"}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Return Progress */}
            <div className="card bg-base-100 shadow">
              <div className="card-body">
                <h2 className="card-title mb-4">Return Progress</h2>
                <ul className="steps steps-vertical lg:steps-horizontal w-full">
                  {steps.map((step, index) => (
                    <li
                      key={step.key}
                      className={`step ${
                        index <= currentIndex ? "step-primary" : ""
                      } ${returnItem.status === "rejected" ? "step-error" : ""}`}
                    >
                      {step.label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Return Items */}
            <div className="card bg-base-100 shadow">
              <div className="card-body">
                <h2 className="card-title mb-4">Items to Return</h2>
                <div className="space-y-4">
                  {returnItem.items?.map((item: any, index: number) => (
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

            {/* Return Details */}
            <div className="card bg-base-100 shadow">
              <div className="card-body">
                <h2 className="card-title mb-4">Return Details</h2>
                <div className="space-y-3">
                  <div>
                    <strong>Reason:</strong> {returnItem.reason}
                  </div>
                  {returnItem.description && (
                    <div>
                      <strong>Description:</strong> {returnItem.description}
                    </div>
                  )}
                  {returnItem.trackingNumber && (
                    <div>
                      <strong>Tracking Number:</strong> {returnItem.trackingNumber}
                    </div>
                  )}
                  {returnItem.pickupAddress && (
                    <div>
                      <strong>Pickup Address:</strong>
                      <div className="text-sm text-gray-600 mt-1">
                        <p>{returnItem.pickupAddress.name}</p>
                        <p>{returnItem.pickupAddress.line1}</p>
                        {returnItem.pickupAddress.line2 && <p>{returnItem.pickupAddress.line2}</p>}
                        <p>
                          {returnItem.pickupAddress.city}, {returnItem.pickupAddress.state} -{" "}
                          {returnItem.pickupAddress.pincode}
                        </p>
                        <p>Phone: {returnItem.pickupAddress.phone}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Return Images */}
            {returnItem.images && returnItem.images.length > 0 && (
              <div className="card bg-base-100 shadow">
                <div className="card-body">
                  <h2 className="card-title mb-4">Return Images</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {returnItem.images.map((image: any, index: number) => (
                      <img
                        key={index}
                        src={image.url || image}
                        alt={`Return image ${index + 1}`}
                        className="w-full h-32 object-cover rounded"
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Refund Details */}
            <div className="card bg-base-100 shadow">
              <div className="card-body">
                <h2 className="card-title mb-4">Refund Details</h2>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Refund Amount</span>
                    <span className="font-bold">₹{returnItem.refundAmount || "0"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Refund Method</span>
                    <span>{returnItem.refundMethod || "Original Payment Method"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Refund Status</span>
                    <span className="capitalize">{returnItem.refundStatus || "Pending"}</span>
                  </div>
                  {returnItem.refundDate && (
                    <div className="flex justify-between">
                      <span>Refund Date</span>
                      <span>{new Date(returnItem.refundDate).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Return Actions */}
          <div className="lg:col-span-1">
            <div className="card bg-base-200 sticky top-20">
              <div className="card-body">
                <h2 className="card-title mb-4">Return Actions</h2>
                <div className="space-y-3">
                  {returnItem.status === "pending" && (
                    <button
                      onClick={() => {
                        if (confirm("Are you sure you want to cancel this return request?")) {
                          cancelReturnMutation.mutate();
                        }
                      }}
                      disabled={cancelReturnMutation.isLoading}
                      className="btn btn-error w-full"
                    >
                      {cancelReturnMutation.isLoading ? "Cancelling..." : "Cancel Return"}
                    </button>
                  )}

                  <Link href="/returns" className="btn btn-outline w-full">
                    Back to Returns
                  </Link>

                  <Link href="/orders" className="btn btn-outline w-full">
                    View Orders
                  </Link>

                  <Link href="/products" className="btn btn-primary w-full">
                    Continue Shopping
                  </Link>
                </div>

                {/* Return Summary */}
                <div className="divider"></div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Items</span>
                    <span>{returnItem.items?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Refund Amount</span>
                    <span className="font-bold">₹{returnItem.refundAmount || "0"}</span>
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
