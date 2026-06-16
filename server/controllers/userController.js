import { generateToken } from "../lib/utils.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import cloudinary from "../lib/cloudinary.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const findUserByEmail = (email) =>
  User.findOne({
    email: { $regex: `^${escapeRegex(email)}$`, $options: "i" },
  });

// Signup a new user

export const signup = async (req, res) => {
  const { fullName, email, password, bio } = req.body;
  const normalizedEmail = email?.trim().toLowerCase();

  try {
    if (!fullName || !email || !password || !bio) {
      return res.status(400).json({ success: false, message: "Missing details" });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    const user = await findUserByEmail(normalizedEmail);

    if (user) {
      return res.status(409).json({ success: false, message: "Account already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUser = await User.create({
      fullName: fullName.trim(),
      email: normalizedEmail, 
      password: hashedPassword,
      bio: bio.trim(),
    });
    const token = generateToken(newUser._id);

    res.json({
      success: true,
      userData: newUser,
      token,
      message: "Account created successfully",
    });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

// Controller to login a user

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const userData = await findUserByEmail(normalizedEmail);

    if (!userData) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, userData.password);

    if (!isPasswordCorrect) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = generateToken(userData._id);

    res.json({ success: true, userData, token, message: "Login successful" });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

// Controller to check if user is authenticated

export const checkAuth = (req, res) => {
  res.json({ success: true, user:req.user});
};

// Controller to update user profile details
export const updateProfile = async (req, res) => {
  try {
    const { profilePic, bio, fullName } = req.body;
    const userId = req.user._id;
    let updatedUser;
if (!profilePic) {
  updatedUser = await User.findByIdAndUpdate(userId, {bio, fullName},{new:true});
}else{
  const upload = await cloudinary.uploader.upload(profilePic)
  updatedUser = await User.findByIdAndUpdate(userId, {profilePic:upload.secure_url, bio, fullName},{new:true})
}
res.json({success: true, user: updatedUser})
  } catch (error) {
    console.log(error.message);
    res.json({success: false, message:error.message})
    
  }
};
