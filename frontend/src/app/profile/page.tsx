"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { authAPI, wishlistAPI } from "@/services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import secureLocalStorage from "react-secure-storage";
import { useProfileStore } from "../store/useProfileStore";
import { IoPerson } from "react-icons/io5";
import { BsBagHeartFill } from "react-icons/bs";
import { FaBox } from "react-icons/fa6";
import { LuBadgeIndianRupee } from "react-icons/lu";
import { FaStar } from "react-icons/fa6";


export default function ProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeTab, setActiveTab } = useProfileStore();
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [mounted, setMounted] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    setUserId(localStorage.getItem("userId"));
  }, []);

  // Fetch user profile
  const { data: user, isLoading } = useQuery({
    queryKey: ["user", userId],
    queryFn: async () => {
      if (!userId) return null;
      const res = await authAPI.me();
      return res.data;
    },
    enabled: !!userId,
  });

  // Fetch wishlist
  const { data: wishlistData } = useQuery({
    queryKey: ["wishlist"],
    queryFn: async () => {
      const res = await wishlistAPI.get();
      return res.data;
    },
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      // This would need to be implemented in the backend
      return Promise.resolve({ data: { ...user, ...data } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
      setIsEditing(false);
      alert("Profile updated successfully");
    },
  });

  // Remove from wishlist mutation
  const removeFromWishlistMutation = useMutation({
    mutationFn: async (productId: string) => {
      return wishlistAPI.remove({ productId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    },
  });

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
      });
    }
  }, [user]);

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
            <span>Please login to view your profile</span>
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

  const handleSaveProfile = () => {
    updateProfileMutation.mutate(profileData);
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
      secureLocalStorage.removeItem("auth_token");
      localStorage.removeItem("userId");
      router.push("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <>
      <Navbar />
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">My Profile</h1>
          <button onClick={handleLogout} className="btn btn-error">
            Logout
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="card bg-base-200">
              <div className="card-body">
                <ul className="menu">
                  <li>
                    <button
                      onClick={() => setActiveTab("overview")}
                      className={`btn btn-ghost justify-start ${
                        activeTab === "profile" ? "btn-active" : ""
                      }`}
                    >
                      Overview
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setActiveTab("profile")}
                      className={`btn btn-ghost justify-start ${
                        activeTab === "profile" ? "btn-active" : ""
                      }`}
                    >
                      Profile
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setActiveTab("wishlist")}
                      className={`btn btn-ghost justify-start ${
                        activeTab === "wishlist" ? "btn-active" : ""
                      }`}
                    >
                      Wishlist
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setActiveTab("orders")}
                      className={`btn btn-ghost justify-start ${
                        activeTab === "orders" ? "btn-active" : ""
                      }`}
                    >
                      Orders
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setActiveTab("refunds")}
                      className={`btn btn-ghost justify-start ${
                        activeTab === "refunds" ? "btn-active" : ""
                      }`}
                    >
                      Refunds
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setActiveTab("reviews")}
                      className={`btn btn-ghost justify-start ${
                        activeTab === "reviews" ? "btn-active" : ""
                      }`}
                    >
                      Ratings & Reviews
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            
            {activeTab === "overview" && (
              <div className="card bg-base-100 shadow">
                <div className="card-body">
                  <h2 className="card-title mb-6">Overview</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div onClick={() => setActiveTab('profile')} className="card bg-base-200 justify-center py-6 gap-2 cursor-pointer text-center items-center hover:scale-105 hover:bg-base-300">
                      <IoPerson size={30}/>
                      <p>Manage Your Profile</p>
                    </div>
                    <div onClick={() => setActiveTab('wishlist')} className="card bg-base-200 justify-center py-6 gap-2 cursor-pointer text-center items-center hover:scale-105 hover:bg-base-300">
                      <BsBagHeartFill size={30}/>
                      <p>Check Your Wishlist</p>
                    </div>
                    <div onClick={() => setActiveTab('orders')} className="card bg-base-200 justify-center py-6 gap-2 cursor-pointer text-center items-center hover:scale-105 hover:bg-base-300">
                      <FaBox size={30}/>
                      <p>Track and manage your orders</p>
                    </div>
                    <div onClick={() => setActiveTab('refunds')} className="card bg-base-200 justify-center py-6 gap-2 cursor-pointer text-center items-center hover:scale-105 hover:bg-base-300">
                      <LuBadgeIndianRupee size={30}/>
                      <p>Track your refunds</p>
                    </div>
                    <div onClick={() => setActiveTab('reviews')} className="card bg-base-200 justify-center py-6 gap-2 cursor-pointer text-center items-center hover:scale-105 hover:bg-base-300">
                      <FaStar size={30}/>
                      <p>Manage Your reviews</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "profile" && (
              <div className="card bg-base-100 shadow">
                <div className="card-body">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="card-title">Profile Information</h2>
                    <button
                      onClick={() => setIsEditing(!isEditing)}
                      className="btn btn-outline"
                    >
                      {isEditing ? "Cancel" : "Edit"}
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Name</span>
                      </label>
                      <input
                        type="text"
                        className="input input-bordered"
                        value={profileData.name}
                        onChange={(e) =>
                          setProfileData({ ...profileData, name: e.target.value })
                        }
                        disabled={!isEditing}
                      />
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Email</span>
                      </label>
                      <input
                        type="email"
                        className="input input-bordered"
                        value={profileData.email}
                        onChange={(e) =>
                          setProfileData({ ...profileData, email: e.target.value })
                        }
                        disabled={!isEditing}
                      />
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Phone</span>
                      </label>
                      <input
                        type="tel"
                        className="input input-bordered"
                        value={profileData.phone}
                        onChange={(e) =>
                          setProfileData({ ...profileData, phone: e.target.value })
                        }
                        disabled={!isEditing}
                      />
                    </div>

                    {isEditing && (
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveProfile}
                          disabled={updateProfileMutation.isPending}
                          className="btn btn-primary"
                        >
                          {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                        </button>
                        <button
                          onClick={() => setIsEditing(false)}
                          className="btn btn-outline"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "wishlist" && (
              <div className="card bg-base-100 shadow">
                <div className="card-body">
                  <h2 className="card-title mb-6">My Wishlist</h2>

                  {!wishlistData || wishlistData.items?.length === 0 ? (
                    <div className="text-center py-8">
                      <h3 className="text-lg font-semibold mb-2">Your wishlist is empty</h3>
                      <p className="text-gray-600 mb-4">
                        Add some products to your wishlist to see them here
                      </p>
                      <button
                        onClick={() => router.push("/products")}
                        className="btn btn-primary"
                      >
                        Browse Products
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {wishlistData.items.map((item: any) => (
                        <div key={item._id} className="card bg-base-200">
                          <figure>
                            <img
                              src={item.product?.coverImage || "/placeholder.png"}
                              alt={item.product?.title}
                              className="w-full h-48 object-cover"
                            />
                          </figure>
                          <div className="card-body">
                            <h3 className="card-title text-sm">{item.product?.title}</h3>
                            <p className="text-lg font-bold">₹{item.product?.priceFrom}</p>
                            <div className="card-actions justify-end">
                              <button
                                onClick={() => removeFromWishlistMutation.mutate(item.product._id)}
                                className="btn btn-error btn-sm"
                              >
                                Remove
                              </button>
                              <button
                                onClick={() => router.push(`/products/${item.product.slug || item.product._id}`)}
                                className="btn btn-primary btn-sm"
                              >
                                View
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "orders" && (
              <div className="card bg-base-100 shadow">
                <div className="card-body">
                  <h2 className="card-title mb-6">Recent Orders</h2>
                  <p className="text-gray-600 mb-4">
                    View and manage your orders
                  </p>
                  <button
                    onClick={() => router.push("/orders")}
                    className="btn btn-primary"
                  >
                    View All Orders
                  </button>
                </div>
              </div>
            )}

            {activeTab === "refunds" && (
              <div className="card bg-base-100 shadow">
                <div className="card-body">
                  <h2 className="card-title mb-6">Refunds</h2>
                  <p className="text-gray-600 mb-4">
                    View and track your refunds.
                  </p>
                  <button
                    onClick={() => router.push("/returns")}
                    className="btn btn-primary"
                  >
                    View Refunds
                  </button>
                </div>
              </div>
            )}

            {activeTab === "reviews" && (
              <div className="card bg-base-100 shadow">
                <div className="card-body">
                  <h2 className="card-title mb-6">Your Reviews</h2>
                  <p className="text-gray-600 mb-4">
                    Here you can see and manage your product reviews.
                  </p>
                  {/* Placeholder for reviews list */}
                  <div className="text-center py-8">
                    <h3 className="text-lg font-semibold mb-2">No reviews yet</h3>
                    <p className="text-gray-600 mb-4">
                      You haven't written any reviews yet.
                    </p>
                    <button
                      onClick={() => router.push("/orders")}
                      className="btn btn-primary"
                    >
                      Review Products from Past Orders
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
