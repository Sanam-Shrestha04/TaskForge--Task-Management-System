const express = require("express");
const {
  registerUser,
  loginUser,
  verifyOtp,
  resendOtp,
  resendVerificationForOldUsers,
  getUserProfile,
  updateUserProfile,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");
const { protect } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/uploadMiddleware");

const router = express.Router();

// Auth routes
router.post("/register", upload.single("image"), registerUser);
router.post("/login", loginUser);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);
router.post("/resend-verification-old-users", resendVerificationForOldUsers);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.get("/profile", protect, getUserProfile);
router.put("/profile", protect, updateUserProfile);

router.post("/upload-image", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });
  const imageUrl = `uploads/${req.file.filename}`;

  res.status(200).json({ imageUrl });
});

module.exports = router;
