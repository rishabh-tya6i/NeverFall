// frontend/src/app/checkout/page.tsx
"use client";

import { useState, useEffect, use } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { cartAPI, orderAPI, deliveryAPI, paymentAPI } from "@/services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useOrderStore } from "../store/useOrderStore";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function CheckoutPage() {
  const router = useRouter();
  const {coupon, setCoupon} = useOrderStore();
  const userId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;

  const [step, setStep] = useState<"address" | "payment">("address");
  const [shippingAddress, setShippingAddress] = useState({
    name: "",
    phone: "",
    pincode: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
  });
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "razorpay" | "wallet">("razorpay");
  const [useWallet, setUseWallet] = useState(false);
  const [pincodeValid, setPincodeValid] = useState<boolean | null>(null);

  // Fetch cart
  const { data: cart } = useQuery({
    queryKey: ["cart", userId],
    queryFn: async () => {
      if (!userId) return null;
      const res = await cartAPI.get(userId);
      return res.data;
    },
    enabled: !!userId,
  });

  // Check pincode serviceability
  const checkPincodeMutation = useMutation({
    mutationFn: async (pincode: string) => {
      const res = await deliveryAPI.checkPincode(pincode);
      return res.data;
    },
    onSuccess: (data) => {
      setPincodeValid(data.deliverable === true);
      if (data.deliverable === false) {
        alert("Sorry, we don't deliver to this pincode yet.");
      }
    },
  });

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      const items = cart.items.map((item: any) => ({
        variantId: item.variant,
        quantity: item.quantity,
        color: item.color,
        size: item.size,
      }));

      const res = await orderAPI.create({
        items,
        useCart: true,
        shippingAddress,
        couponCode : coupon,
      });
      return res.data;
    },
    onSuccess: (order) => {
      // Create payment session
      createPaymentSessionMutation.mutate(order._id);
    },
  });

  // Create payment session mutation
  const createPaymentSessionMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await orderAPI.createPaymentSession(orderId, {
        useWallet,
        paymentMethod,
      });
      return res.data;
    },
    onSuccess: (data) => {
      if (paymentMethod === "cod") {
        router.push(`/orders/${data.orderId}`);
      } else if (paymentMethod === "razorpay") {
        initiateRazorpayPayment(data);
      } else if (paymentMethod === "wallet") {
        router.push(`/orders/${data.orderId}`);
      }
    },
  });

  // Initiate Razorpay payment
  const initiateRazorpayPayment = (paymentData: any) => {
    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount: paymentData.gatewayAmount * 100,
      currency: "INR",
      name: "Your Store",
      description: "Order Payment",
      order_id: paymentData.gateway.id,
      handler: async (response: any) => {
        try {
          // Verify payment
          const res = await paymentAPI.verifyPayment({
            sessionId: paymentData.sessionId,
            gatewayPaymentId: response.razorpay_payment_id,
            gatewayOrderId: response.razorpay_order_id,
            gatewaySignature: response.razorpay_signature,
          });
          
          if (res.data.success) {
            router.push(`/orders/${res.data.orderId}`);
          }
        } catch (error) {
          alert("Payment verification failed");
        }
      },
      prefill: {
        name: shippingAddress.name,
        contact: shippingAddress.phone,
      },
      theme: {
        color: "#3B82F6",
      },
    };

    const razorpay = new window.Razorpay(options);
    razorpay.open();
  };

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handlePincodeBlur = () => {
    if (shippingAddress.pincode.length === 6) {
      checkPincodeMutation.mutate(shippingAddress.pincode);
    }
  };

  const handleSubmitAddress = () => {
    if (!shippingAddress.name || !shippingAddress.phone || !shippingAddress.pincode ||
        !shippingAddress.line1 || !shippingAddress.city || !shippingAddress.state) {
      alert("Please fill all required fields");
      return;
    }
    if (pincodeValid === false) {
      alert("Please enter a valid pincode where we deliver");
      return;
    }
    setStep("payment");
  };

  const handlePlaceOrder = () => {
      createOrderMutation.mutate();
  };

  if (!userId || !cart || cart.items.length === 0) {
    return (
      <>
        <Navbar />
        <div className="container mx-auto p-4">
          <div className="alert alert-warning">
            <span>Your cart is empty. Please add items before checkout.</span>
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

  return (
    <>
      <Navbar />
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-8">Checkout</h1>

        {/* Progress Steps */}
        <ul className="steps w-full mb-8">
          <li className={`step ${step === "address" || step === "payment" ? "step-primary" : ""}`}>
            Address
          </li>
          <li className={`step ${step === "payment" ? "step-primary" : ""}`}>Payment</li>
        </ul>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {step === "address" && (
              <div className="card bg-base-100 shadow">
                <div className="card-body">
                  <h2 className="card-title mb-4">Shipping Address</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Full Name *</span>
                      </label>
                      <input
                        type="text"
                        className="input input-bordered"
                        value={shippingAddress.name}
                        onChange={(e) =>
                          setShippingAddress({ ...shippingAddress, name: e.target.value })
                        }
                      />
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Phone Number *</span>
                      </label>
                      <input
                        type="tel"
                        className="input input-bordered"
                        value={shippingAddress.phone}
                        onChange={(e) =>
                          setShippingAddress({ ...shippingAddress, phone: e.target.value })
                        }
                      />
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Pincode *</span>
                      </label>
                      <input
                        type="text"
                        className="input input-bordered"
                        maxLength={6}
                        value={shippingAddress.pincode}
                        onChange={(e) =>
                          setShippingAddress({ ...shippingAddress, pincode: e.target.value })
                        }
                        onBlur={handlePincodeBlur}
                      />
                      {pincodeValid === true && (
                        <label className="label">
                          <span className="label-text-alt text-success">✓ Delivery available</span>
                        </label>
                      )}
                      {pincodeValid === false && (
                        <label className="label">
                          <span className="label-text-alt text-error">✗ Not serviceable</span>
                        </label>
                      )}
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">City *</span>
                      </label>
                      <input
                        type="text"
                        className="input input-bordered"
                        value={shippingAddress.city}
                        onChange={(e) =>
                          setShippingAddress({ ...shippingAddress, city: e.target.value })
                        }
                      />
                    </div>

                    <div className="form-control md:col-span-2">
                      <label className="label">
                        <span className="label-text">Address Line 1 *</span>
                      </label>
                      <input
                        type="text"
                        className="input input-bordered"
                        value={shippingAddress.line1}
                        onChange={(e) =>
                          setShippingAddress({ ...shippingAddress, line1: e.target.value })
                        }
                      />
                    </div>

                    <div className="form-control md:col-span-2">
                      <label className="label">
                        <span className="label-text">Address Line 2</span>
                      </label>
                      <input
                        type="text"
                        className="input input-bordered"
                        value={shippingAddress.line2}
                        onChange={(e) =>
                          setShippingAddress({ ...shippingAddress, line2: e.target.value })
                        }
                      />
                    </div>

                    <div className="form-control md:col-span-2">
                      <label className="label">
                        <span className="label-text">State *</span>
                      </label>
                      <input
                        type="text"
                        className="input input-bordered"
                        value={shippingAddress.state}
                        onChange={(e) =>
                          setShippingAddress({ ...shippingAddress, state: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <button onClick={handleSubmitAddress} className="btn btn-primary w-full mt-6">
                    Continue to Payment
                  </button>
                </div>
              </div>
            )}

            {step === "payment" && (
              <div className="card bg-base-100 shadow">
                <div className="card-body">
                  <h2 className="card-title mb-4">Payment Method</h2>

                  <div className="space-y-4">
                    <div className="form-control">
                      <label className="label cursor-pointer justify-start gap-4">
                        <input
                          type="radio"
                          name="payment"
                          className="radio"
                          checked={paymentMethod === "razorpay"}
                          onChange={() => setPaymentMethod("razorpay")}
                        />
                        <span className="label-text">Online Payment (Razorpay)</span>
                      </label>
                    </div>

                    <div className="form-control">
                      <label className="label cursor-pointer justify-start gap-4">
                        <input
                          type="radio"
                          name="payment"
                          className="radio"
                          checked={paymentMethod === "wallet"}
                          onChange={() => setPaymentMethod("wallet")}
                        />
                        <span className="label-text">Wallet</span>
                      </label>
                    </div>

                    <div className="form-control">
                      <label className="label cursor-pointer justify-start gap-4">
                        <input
                          type="radio"
                          name="payment"
                          className="radio"
                          checked={paymentMethod === "cod"}
                          onChange={() => setPaymentMethod("cod")}
                        />
                        <span className="label-text">Cash on Delivery</span>
                      </label>
                    </div>

                    <div className="divider"></div>

                    <div className="form-control">
                      <label className="label cursor-pointer justify-start gap-4">
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={useWallet}
                          onChange={(e) => setUseWallet(e.target.checked)}
                        />
                        <span className="label-text">Use wallet balance (if available)</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-4 mt-6">
                    <button onClick={() => setStep("address")} className="btn btn-outline flex-1">
                      Back
                    </button>
                    <button
                      onClick={handlePlaceOrder}
                      disabled={createOrderMutation.isPending}
                      className="btn btn-primary flex-1"
                    >
                      {createOrderMutation.isPending ? (
                        <span className="loading loading-spinner"></span>
                      ) : (
                        "Place Order"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="card bg-base-200 sticky top-20">
              <div className="card-body">
                <h2 className="card-title mb-4">Order Summary</h2>

                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {cart.items.map((item: any) => (
                    <div key={item.variant} className="flex gap-2">
                      <img
                        src={item.product?.coverImage || "/placeholder.png"}
                        alt={item.title}
                        className="w-16 h-16 object-cover rounded"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{item.title}</p>
                        <p className="text-xs text-gray-600">
                          {item.size} × {item.quantity}
                        </p>
                        <p className="text-sm font-bold">₹{item.price * item.quantity}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="divider"></div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>₹{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shipping</span>
                    <span className="text-success">FREE</span>
                  </div>
                  <div className="divider"></div>
                  <div className="flex justify-between text-xl font-bold">
                    <span>Total</span>
                    <span>₹{subtotal.toFixed(2)}</span>
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