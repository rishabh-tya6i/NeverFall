import { Router } from "express";
import { signUpload, deleteObject } from "../Controllers/media.controller.js";

const router = Router();

router.post("/media/sign", signUpload);

router.delete("/media/object", deleteObject);

export default router;
