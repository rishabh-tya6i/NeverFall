"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { returnAPI } from "@/services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Link from "next/link";

export default function ReturnsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [mounted, setMounted] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    setUserId(localStorage.getItem("userId"));
  }, []);

  // Fetch returns
  const { data: returnsData, isLoading } = useQuery({
    queryKey: ["returns", userId, statusFilter],
    queryFn: async () => {
      if (!userId) return null;
      const res = await returnAPI.list({
        page: 1,
        limit: 20,
      });
      return res.data;
    },
    enabled: !!userId,
  });

  // Cancel return mutation
  const cancelReturnMutation = useMutation({
    mutationFn: async (returnId: string) => {
      return returnAPI.cancel(returnId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["returns"] });
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
            <span>Please login to view your returns</span>
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

  const returns = returnsData?.items || [];
  const filteredReturns = statusFilter === "all" 
    ? returns 
    : returns.filter((returnItem: any) => returnItem.status === statusFilter);

  return (
    <>
      <Navbar />
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">My Returns</h1>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="select select-bordered"
          >
            <option value="all">All Returns</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {filteredReturns.length === 0 ? (
          <div className="text-center py-16">
            <h2 className="text-2xl font-bold mb-4">No returns found</h2>
            <p className="text-gray-600 mb-8">
              {statusFilter === "all"
                ? "You haven't requested any returns yet"
                : `No ${statusFilter} returns found`}
            </p>
            <Link href="/orders" className="btn btn-primary">
              View Orders
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredReturns.map((returnItem: any) => (
              <div key={returnItem._id} className="card bg-base-100 shadow">
                <div className="card-body">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">
                        Return Request #{returnItem.returnNumber || returnItem._id.slice(-8)}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Requested on {new Date(returnItem.createdAt).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-600">
                        Order: #{returnItem.order?.orderNumber || "N/A"}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className={`badge ${getStatusBadge(returnItem.status)}`}>
                        {getStatusText(returnItem.status)}
                      </div>
                      <p className="text-lg font-bold mt-1">₹{returnItem.refundAmount || "0"}</p>
                    </div>
                  </div>

                  {/* Return Items */}
                  <div className="space-y-3 mb-4">
                    <h4 className="font-semibold">Items to Return:</h4>
                    {returnItem.items?.map((item: any, index: number) => (
                      <div key={index} className="flex gap-4 p-3 bg-base-200 rounded-lg">
                        <img
                          src={item.product?.coverImage || "/placeholder.png"}
                          alt={item.title}
                          className="w-16 h-16 object-cover rounded"
                        />
                        <div className="flex-1">
                          <h4 className="font-semibold">{item.title}</h4>
                          <p className="text-sm text-gray-600">
                            Size: {item.size} | Color: {item.color} | Qty: {item.quantity}
                          </p>
                          <p className="font-semibold">₹{item.price}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Return Details */}
                  <div className="mb-4">
                    <h4 className="font-semibold mb-2">Return Details:</h4>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p><strong>Reason:</strong> {returnItem.reason}</p>
                      {returnItem.description && (
                        <p><strong>Description:</strong> {returnItem.description}</p>
                      )}
                      {returnItem.trackingNumber && (
                        <p><strong>Tracking Number:</strong> {returnItem.trackingNumber}</p>
                      )}
                    </div>
                  </div>

                  {/* Return Images */}
                  {returnItem.images && returnItem.images.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold mb-2">Return Images:</h4>
                      <div className="flex gap-2 flex-wrap">
                        {returnItem.images.map((image: any, index: number) => (
                          <img
                            key={index}
                            src={image.url || image}
                            alt={`Return image ${index + 1}`}
                            className="w-20 h-20 object-cover rounded"
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Return Actions */}
                  <div className="flex gap-2 justify-end">
                    <Link
                      href={`/returns/${returnItem._id}`}
                      className="btn btn-outline btn-sm"
                    >
                      View Details
                    </Link>
                    {returnItem.status === "pending" && (
                      <button
                        onClick={() => {
                          if (confirm("Are you sure you want to cancel this return request?")) {
                            cancelReturnMutation.mutate(returnItem._id);
                          }
                        }}
                        disabled={cancelReturnMutation.isPending}
                        className="btn btn-error btn-sm"
                      >
                        Cancel Return
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </>
  );
}
