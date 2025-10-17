import { Router } from "express";
import { signUpload, deleteObject } from "../controllers/media.controller.js";

const router = Router();

router.post("/media/sign", signUpload);

router.delete("/media/object", deleteObject);

export default router;
