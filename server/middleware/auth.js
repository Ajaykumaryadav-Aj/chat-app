import jwt from "jsonwebtoken";
import User from "../models/User.js";
// Middleware to protect routes

export const protectRoute = async (req, res, next) => {
  try {
    const token = req.headers.token;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId).select("-password");
    if (!user) return res.json({ success: false, message: "User not found" });

    req.user = user;
    next();
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};





// import jwt from "jsonwebtoken";
// import User from "../models/User.js";

// export const protectRoute = async (req, res, next) => {
//   try {
//     const token =
//       req.headers.token || // your frontend sets this
//       (req.headers.authorization && req.headers.authorization.startsWith("Bearer")
//         ? req.headers.authorization.split(" ")[1]
//         : null);

//     if (!token) {
//       return res.status(401).json({ success: false, message: "Token not provided" });
//     }

//     const decoded = jwt.verify(token, process.env.JWT_SECRET);

//     const user = await User.findById(decoded.userId).select("-password");
//     if (!user) {
//       return res.status(404).json({ success: false, message: "User not found" });
//     }

//     req.user = user;
//     next();
//   } catch (error) {
//     console.log(error.message);
//     return res.status(401).json({ success: false, message: error.message });
//   }
// };
