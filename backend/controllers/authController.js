const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sendEmail = require("../utils/sendEmail");

// Generate JWT Token
const generateToken = (userID) => {
  return jwt.sign({ id: userID }, process.env.JWT_SECRET, {
    expiresIn: "100d",
  });
};

// Register User with OTP
const registerUser = async (req, res) => {
  try {
    const { name, email, password, profileImageUrl, adminInviteToken } = req.body;

    // Build profileImageUrl safely
    let profileUrl = "";
    if (req.file) {
      profileUrl = `uploads/${req.file.filename}`;
    } else if (typeof profileImageUrl === "string") {
      profileUrl = profileImageUrl;
    } else if (typeof profileImageUrl === "object" && profileImageUrl?.url) {
      profileUrl = profileImageUrl.url;
    }

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: "User already exists" });

    // Determine role
    let role = "user";
    if (adminInviteToken && adminInviteToken === process.env.ADMIN_INVITE_TOKEN) {
      role = "admin";
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 10 mins

    // Create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      profileImageUrl: profileUrl,
      role,
      otp,
      otpExpiresAt,
      isVerified: false,
    });

    
    // Send OTP email
    const joinUrl = (base, path) => `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
const verificationLink = `${process.env.FRONTEND_URL}/verify?email=${user.email}`;

const htmlMessage = `
<div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
  <div style="max-width: 600px; margin: auto; background: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    
    <p style="color: #555555; font-size: 16px;">Hi ${user.name},</p>
    <p style="color: #555555; font-size: 16px;">
      Thanks for signing up! You're almost ready to get started.
    </p><p style="color: #555555; font-size: 16px;">
      Click the link below to verify your email:
    </p>

    <p style="text-align: center; margin: 30px 0;">
      <a href="${verificationLink}" 
         style="background-color: #4CAF50; color: #ffffff; padding: 12px 25px; border-radius: 5px; text-decoration: none; font-size: 16px;">
         Verify Email
      </a>
    </p>

    <p style="color: #555555; font-size: 16px;">
      Please enter this OTP on the verification page to complete your verification:
    </p>
    <p style="text-align: center; font-size: 20px; font-weight: bold; color: #333333; margin: 15px 0;">
      ${otp}
    </p>

    <p style="color: #999999; font-size: 14px; text-align: center;">
      This OTP is valid for the next 5 minutes.
    </p>
    <p style="color: #555555; font-size: 16px;">
            If you didn’t request a password reset, you can safely ignore this email.
          </p>

    <p style="color: #555555; font-size: 16px;">Welcome aboard,<br><strong>${process.env.FROM_NAME} Team</strong></p>
  </div>
</div>
`;

await sendEmail({
  email: user.email,
  subject: "Confirm Your Email to Get Started",
  html: htmlMessage,
});

// Log OTP sent
console.log(`[${new Date().toISOString()}] OTP resent to: ${user.email}`);

res.status(201).json({ message: "User registered! Please verify your email." });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Verify OTP
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      console.log("⚠️ Missing email or OTP in request");
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      console.log(`❌ No user found for email: ${email}`);
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isVerified) {
      console.log(`✅ User already verified: ${email}`);
      return res.status(400).json({ message: "User already verified" });
    }

    // Check if user is temporarily blocked
    if (user.otpBlockedUntil && new Date() < new Date(user.otpBlockedUntil)) {
      const waitMinutes = Math.ceil((new Date(user.otpBlockedUntil) - new Date()) / 60000);
      console.log(`🚫 User temporarily blocked (${email}) — wait ${waitMinutes} min`);
      return res.status(429).json({
        message: `Too many failed attempts. Please wait ${waitMinutes} minute(s) before trying again.`,
      });
    }

    // Check if OTP exists and valid
    if (!user.otp || !user.otpExpiresAt) {
      console.log(`⚠️ OTP not set or expired for ${email}`);
      return res.status(400).json({ message: "OTP not found or expired" });
    }

    // Check if OTP is expired
    if (new Date() > new Date(user.otpExpiresAt)) {
      console.log(`⌛ OTP expired for ${email}`);
      return res.status(400).json({ message: "OTP expired. Please request a new one." });
    }

    const storedOtp = String(user.otp).trim();
    const enteredOtp = String(otp).trim();

    if (storedOtp !== enteredOtp) {
      user.otpFailedCount = (user.otpFailedCount || 0) + 1;
      console.log(`❌ Invalid OTP for ${email} | Attempt: ${user.otpFailedCount}`);

      // Block after 5 failed attempts
      if (user.otpFailedCount >= 5) {
        user.otpBlockedUntil = new Date(Date.now() + 5 * 60 * 1000); // 5 min block
        user.otpFailedCount = 0;
        console.log(`🚫 Max OTP attempts reached — ${email} blocked for 5 minutes`);
      }

      await user.save({ validateBeforeSave: false });
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // ✅ OTP matches
    user.isVerified = true;
    user.otp = null;
    user.otpExpiresAt = null;
    user.otpFailedCount = 0;
    user.otpBlockedUntil = null;
    await user.save({ validateBeforeSave: false });

    console.log(`✅ User verified successfully: ${user.email}`);

    const token = generateToken(user._id);
    res.status(200).json({
      message: "Email verified successfully!",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error(`💥 OTP verification error for user: ${req.body?.email || "unknown"}`, error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


// Resend OTP
const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isVerified) return res.status(400).json({ message: "User already verified" });

    // Check resend attempts
    if (user.otpBlockedUntil && new Date() < new Date(user.otpBlockedUntil)) {
      const waitMinutes = Math.ceil((new Date(user.otpBlockedUntil) - new Date()) / 60000);
      return res.status(429).json({
        message: `You have reached maximum resend attempts. Please wait ${waitMinutes} minute(s) before trying again.`,
      });
    }

    // Increment resend counter
    user.otpResendCount = (user.otpResendCount || 0) + 1;

    // Block user if resend attempts exceed 5
    if (user.otpResendCount > 5) {
      user.otpBlockedUntil = new Date(Date.now() + 5 * 60 * 1000); // 5 min block
      user.otpResendCount = 0; // reset counter after block
      await user.save({ validateBeforeSave: false });
      return res.status(429).json({
        message: "You have reached maximum resend attempts. Please wait 5 minutes before trying again.",
      });
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    user.otp = otp;
    user.otpExpiresAt = otpExpiresAt;
    await user.save({ validateBeforeSave: false });

    // HTML email template (your existing template can be used)
    const htmlResendOTP = `
      <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <h2 style="color: #333333; text-align: center;">Your New Verification Code</h2>
          <p style="color: #555555; font-size: 16px;">Hi ${user.name},</p>
          <p style="color: #555555; font-size: 16px;">
            Please enter this OTP on the verification page to verify your email:
          </p>

          <p style="text-align: center; font-size: 20px; font-weight: bold; color: #333333; margin: 15px 0;">
            ${otp}
          </p>

          <p style="color: #999999; font-size: 14px; text-align: center;">
            This OTP is valid for the next 5 minutes.
          </p>

          <p style="color: #555555; font-size: 16px;">If you didn’t request this, you can safely ignore this email.</p>

          <p style="color: #555555; font-size: 16px;">Welcome aboard,<br><strong>${process.env.FROM_NAME} Team</strong></p>
        </div>
      </div>
    `;

    await sendEmail({
      email: user.email,
      subject: "Your OTP for Email Verification",
      html: htmlResendOTP,
    });

    // Log OTP resent
console.log(`[${new Date().toISOString()}] OTP resent to: ${user.email}`);

    res.json({ message: "OTP resent successfully!" });
  } catch (err) {
    console.error("Resend OTP error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


const resendVerificationForOldUsers = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isVerified) return res.status(400).json({ message: "User already verified" });

    // 🔒 Check lockout status
    if (user.otpBlockedUntil && new Date() < new Date(user.otpBlockedUntil)) {
      const waitMs = new Date(user.otpBlockedUntil) - new Date();
      const waitMinutes = Math.floor(waitMs / 60000);
      const waitSeconds = Math.floor((waitMs % 60000) / 1000);
      return res.status(429).json({
        message: `Too many attempts. Please wait ${waitMinutes}:${waitSeconds
          .toString()
          .padStart(2, "0")} minutes before trying again.`,
        blockedUntil: user.otpBlockedUntil, // ⏱ send this to frontend for visible timer
      });
    }

    // 🔢 Count resend attempts
    user.otpResendCount = (user.otpResendCount || 0) + 1;

    if (user.otpResendCount > 5) {
      user.otpBlockedUntil = new Date(Date.now() + 5 * 60 * 1000); // block 5 minutes
      user.otpResendCount = 0;
      await user.save({ validateBeforeSave: false });
      return res.status(429).json({
        message: "Too many attempts. Please wait 5 minutes before trying again.",
        blockedUntil: user.otpBlockedUntil,
      });
    }

    // ✅ Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    user.otp = otp;
    user.otpExpiresAt = otpExpiresAt;
    await user.save({ validateBeforeSave: false });

    const joinUrl = (base, path) => `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
    const verificationLink = `${process.env.FRONTEND_URL}/verify?email=${user.email}`;

    const htmlMessage = `
      <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <p style="color: #555555; font-size: 16px;">Hi ${user.name},</p>
          <p style="color: #555555; font-size: 16px;">We noticed you haven't verified your email yet.Click the button below to verify.</p>
          <p style="text-align: center; margin: 20px 0;">
            <a href="${verificationLink}" 
               style="background-color: #4CAF50; color: #ffffff; padding: 12px 25px; border-radius: 5px; text-decoration: none; font-size: 16px;">
               Verify Email
            </a>
          </p>
          <p style="color: #555555; font-size: 16px;">
            Enter this OTP to verify : <strong>${otp}</strong>
          </p>
          <p style="color: #999999; font-size: 14px; text-align: center;">This OTP is valid for the next 5 minutes.</p>
          <p style="color: #555555; font-size: 16px;">
            If you didn’t request a password reset, you can safely ignore this email.
          </p>
          <p style="color: #555555; font-size: 16px;">Best regards,<br><strong>${process.env.FROM_NAME} Team</strong></p>
        </div>
      </div>
    `;

    await sendEmail({
      email: user.email,
      subject: "Verify Your Email Account",
      html: htmlMessage,
    });

    console.log(`[${new Date().toISOString()}] Verification email sent to: ${user.email}`);
    res.status(200).json({
      message: "Verification email sent successfully!",
    });
  } catch (err) {
    console.error("Error resending verification for old users:", err.message);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};





// Login User (handles unverified users)
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1️⃣ Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // 2️⃣ Check if user is verified
    if (!user.isVerified) {
  return res.status(401).json({
    message: "Your account is unverified. Please verify your email.",
    action: "resend_verification",
    email: user.email,
  });
}

    // 3️⃣ Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // 4️⃣ Success: send user data + JWT token
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImageUrl: user.profileImageUrl,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};



// Get User Profile
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update User Profile
const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;

    if (req.body.profileImageUrl) {
      if (typeof req.body.profileImageUrl === "string") {
        user.profileImageUrl = req.body.profileImageUrl;
      } else if (typeof req.body.profileImageUrl === "object" && req.body.profileImageUrl.url) {
        user.profileImageUrl = req.body.profileImageUrl.url;
      }
    }

    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(req.body.password, salt);
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      profileImageUrl: updatedUser.profileImageUrl,
      token: generateToken(updatedUser._id),
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Forgot Password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: "User not found" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "5m" });
    const joinUrl = (base, path) => `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;

    const htmlMessage = `
      <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <p style="color: #555555; font-size: 16px;">Hi ${user.name},</p>
          <p style="color: #555555; font-size: 16px;">
            We received a request to reset your password. Click the button below to securely set a new password:
          </p>

          <p style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" 
               style="background-color: #4CAF50; color: #ffffff; padding: 12px 25px; border-radius: 5px; text-decoration: none; font-size: 16px;">
               Reset Password
            </a>
          </p>

          <p style="color: #999999; font-size: 14px; text-align: center;">
            This link is valid for 5 minutes.
          </p>
          <p style="color: #555555; font-size: 16px;">
            If you didn’t request a password reset, you can safely ignore this email.
          </p>

          <p style="color: #555555; font-size: 16px;">Best regards,<br><strong>${process.env.FROM_NAME} Team</strong></p>
        </div>
      </div>
    `;

    await sendEmail({
      email: user.email,
      subject: "Password Reset Request",
      message: "Click the button in this email to reset your password.",
      html: htmlMessage,
    });

    res.json({ msg: "Password reset link sent to your email." });
  } catch (err) {
    console.error("Forgot password error:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
};



// Reset Password
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(400).json({ msg: "Invalid token" });

    user.password = await bcrypt.hash(newPassword, await bcrypt.genSalt(10));

    if (!user.profileImageUrl) user.profileImageUrl = "";
    else if (typeof user.profileImageUrl === "object") user.profileImageUrl = user.profileImageUrl.url || "";

    await user.save();
    res.json({ msg: "Password updated successfully!" });
  } catch (err) {
    console.error("Reset password error:", err.message);
    res.status(400).json({ msg: "Invalid or expired token", error: err.message });
  }
};

module.exports = {
  registerUser,
  verifyOtp,
  resendOtp,
  resendVerificationForOldUsers,
  loginUser,
  getUserProfile,
  updateUserProfile,
  forgotPassword,
  resetPassword,
};
