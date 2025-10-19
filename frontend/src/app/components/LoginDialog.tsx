"use client";

import { useState } from "react";
import secureLocalStorage from "react-secure-storage";
import { useRouter } from "next/navigation";
import { LOGOUT, SEND_OTP, VERIFY_OTP, AUTH_TOKEN_KEY, USER_ID_KEY } from "../constants/Constant";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "react-toastify";

export default function LoginDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"request" | "verify" | "loggedin">("request");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");


  // Request OTP
  const handleRequestOtp = async () => {
    if (!phone) return setMessage("Please enter phone number");
    setLoading(true);
    setMessage("");
    const URL = SEND_OTP;
    try {
      const res = await fetch(SEND_OTP, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("OTP sent successfully ");
        setStep("verify");
      } else {
        setMessage(data.error || "Failed to send OTP");
        toast.error(data.error || "Failed to send OTP");
      }
    } catch (err) {
      setMessage("Server error, try again later");
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP
  const handleVerifyOtp = async () => {
    if (!otp) return setMessage("Please enter OTP");

    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(VERIFY_OTP, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone: phone, otp: otp }),
      });
      const data = await res.json();
      if (res.ok) {
        secureLocalStorage.setItem(AUTH_TOKEN_KEY, data.token);
        localStorage.setItem(USER_ID_KEY, data.user.id);
        setUser(data.user);
        setStep("loggedin");
        // Close dialog and refresh page after successful login
        setTimeout(() => {
          setOpen(false);
          window.location.reload();
        }, 1500);
      } else {
        setMessage(data.error || "Invalid OTP");
        toast.error(data.error || "Invalid OTP");
      }
    } catch (err) {
      setMessage("Server error, try again later");
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const handleLogout = async () => {
    await fetch(LOGOUT, {
      method: "POST",
      credentials: "include",
    });
    secureLocalStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(USER_ID_KEY);
    setUser(null);
    setStep("request");
    setOtp("");
    setPhone("");
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="btn btn-primary">Sign In</button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-lg p-6">
          <Dialog.Title className="text-xl font-semibold text-center text-secondary mb-4">
            Sign In
          </Dialog.Title>

          {step === "request" && (
            <div>
              <input
                type="tel"
                placeholder="+911234567890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input input-bordered w-full mb-3"
              />
              <button className="btn btn-primary w-full" onClick={handleRequestOtp}>
                Request OTP
              </button>
            </div>
          )}

          {step === "verify" && (
            <div>
              <input
                type="text"
                placeholder="Enter OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="input input-bordered w-full mb-3"
              />
              <button className="btn btn-success w-full" onClick={handleVerifyOtp}>
                Verify OTP
              </button>
            </div>
          )}

          {step === "loggedin" && (
            <div className="text-center">
              <p className="text-gray-700 mb-4">You’re logged in !</p>
              <button
                className="btn btn-error w-full"
                onClick={() => setOpen(false)}
              >
                Continue Browsing
              </button>
            </div>
          )}

          <Dialog.Close asChild>
            <button className="btn btn-sm btn-circle absolute right-3 top-3">✕</button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}