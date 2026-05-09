import { useState, useEffect, useContext, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { UserContext } from "../../context/userContext";
import { AnimatePresence } from "framer-motion";
import axiosInstance from "../../utils/axiosInstance";

export default function VerifyOTP() {
  const location = useLocation();
  const navigate = useNavigate();
  const { updateUser } = useContext(UserContext);

  const queryParams = new URLSearchParams(location.search);
  const email = queryParams.get("email");

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verified, setVerified] = useState(false);

  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const [failedAttempts, setFailedAttempts] = useState(
    Number(localStorage.getItem("otpFailedAttempts")) || 0,
  );
  const [lockoutTimer, setLockoutTimer] = useState(
    Number(localStorage.getItem("otpLockoutTimer")) || 0,
  );

  const inputsRef = useRef([]);

  useEffect(() => {
    if (!email) setError("No email provided in URL.");
  }, [email]);

  // Persist lockout timer and failed attempts
  useEffect(() => {
    localStorage.setItem("otpLockoutTimer", lockoutTimer);
    localStorage.setItem("otpFailedAttempts", failedAttempts);
  }, [lockoutTimer, failedAttempts]);

  // Resend cooldown timer
  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Lockout timer countdown
  useEffect(() => {
    let timer;
    if (lockoutTimer > 0) {
      timer = setInterval(() => setLockoutTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [lockoutTimer]);

  const handleChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) inputsRef.current[index + 1].focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      const newOtp = [...otp];
      newOtp[index - 1] = "";
      setOtp(newOtp);
      inputsRef.current[index - 1].focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting || lockoutTimer > 0) return;
    if (!email) return setError("No email provided.");

    const otpValue = otp.join("");
    if (otpValue.length !== 6) return setError("Please enter the 6-digit OTP.");

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const res = await axiosInstance.post("/api/auth/verify-otp", {
        email: String(email).trim(),
        otp: otpValue,
      });

      const { message, user, token } = res.data;
      updateUser({ ...user, token });

      setSuccess(message || "OTP verified successfully!");
      setVerified(true);

      console.log("OTP verified successfully!");
      setFailedAttempts(0);
      localStorage.setItem("otpFailedAttempts", 0);

      setTimeout(() => {
        navigate(
          user.role === "admin" ? "/admin/dashboard" : "/user/dashboard",
        );
      }, 1500);
    } catch (err) {
      console.error(
        "OTP verification error:",
        err.response?.data || err.message,
      );
      setError(err.response?.data?.message || "OTP verification failed.");

      setFailedAttempts((prev) => {
        const attempts = prev + 1;
        console.log(`Failed OTP attempt #${attempts}`);
        if (attempts >= 5) {
          console.log("Maximum attempts reached. Locking out for 5 minutes.");
          setLockoutTimer(300); // 5 minutes
          return 0;
        }
        return attempts;
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!email || lockoutTimer > 0) return;
    if (resendCooldown > 0) return;

    setResendLoading(true);
    setResendSuccess("");
    setError("");
    setOtp(["", "", "", "", "", ""]);

    try {
      const res = await axiosInstance.post("/api/auth/resend-otp", {
        email: String(email).trim(),
      });

      setResendSuccess(res.data.message || "OTP sent to your email!");
      setResendCooldown(30);
      inputsRef.current[0].focus();
    } catch (err) {
      console.error("Resend OTP error:", err.response?.data || err.message);
      setError(err.response?.data?.message || "Failed to resend OTP.");
    } finally {
      setResendLoading(false);
    }
  };

  if (!email)
    return (
      <p className="text-center mt-20 text-gray-700">No email provided.</p>
    );

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(1, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="bg-white shadow-xl rounded-3xl p-10 w-full max-w-md relative">
        <h2 className="text-3xl font-bold mb-2 text-center text-gray-800">
          Verify Your Email
        </h2>
        <p className="text-gray-500 text-center mb-6">
          Enter the 6-digit code sent to{" "}
          <span className="font-semibold">{email}</span>
        </p>

        {/* Lockout message displayed once in blue */}
        {lockoutTimer > 0 && (
          <p className="text-red-600 text-center mb-4 font-semibold">
            Too many attempts. Please wait {formatTime(lockoutTimer)} before
            trying again.
          </p>
        )}

        {/* Error and success messages */}
        {lockoutTimer === 0 && error && (
          <p className="text-red-500 text-center mb-4">{error}</p>
        )}
        {success && (
          <p className="text-green-600 text-center mb-4">{success}</p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex justify-between gap-3 relative">
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => (inputsRef.current[i] = el)}
                type="text"
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                maxLength={1}
                className="w-12 h-14 text-center text-xl font-semibold border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                disabled={verified || lockoutTimer > 0}
              />
            ))}
          </div>

          {/* Verify Button (always colorful, just disabled functionally) */}
          <button
            type="submit"
            disabled={submitting || verified || lockoutTimer > 0}
            className="py-3 rounded-xl text-white font-semibold transition-shadow bg-blue-500 hover:bg-blue-600 shadow-lg cursor-pointer disabled:cursor-not-allowed"
          >
            Verify & Login
          </button>
        </form>

        {/* Resend OTP Button (always colorful, just disabled functionally) */}
        <div className="mt-6 text-center relative">
          <button
            type="button"
            onClick={handleResend}
            disabled={
              resendLoading ||
              resendCooldown > 0 ||
              verified ||
              lockoutTimer > 0
            }
            className="w-full py-3 rounded-xl text-white font-medium transition-shadow bg-green-500 hover:bg-green-600 shadow-lg cursor-pointer disabled:cursor-not-allowed"
          >
            Resend OTP
          </button>

          {resendSuccess && (
            <p className="absolute left-1/2 transform -translate-x-1/2 mt-2 text-sm text-green-600">
              {resendSuccess}
            </p>
          )}
        </div>

        <div className="mt-6 text-center text-gray-400 text-sm">
          Didn't receive the code? Check your spam folder or try resending.
        </div>
      </div>
    </div>
  );
}
