import jwt from "jsonwebtoken";

export const generateToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.TokenTTL || "1d",
  });
};
export const auth = async (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "No token, authorization denied" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: "Token is not valid" });
  }
};
export const isAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};
export const isManager = (req, res, next) => {
  if (req.user?.role !== "admin" && req.user?.role !== "manager") {
    return res.status(403).json({ error: "Manager access required" });
  }
  next();
};
export const isSupport = (req, res, next) => {
  if (
    req.user?.role !== "admin" &&
    req.user?.role !== "manager" &&
    req.user?.role !== "support"
  ) {
    return res.status(403).json({ error: "Support access required" });
  }
  next();
};

// module.exports = { generateToken, auth };
