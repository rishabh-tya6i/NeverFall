import { Router } from "express";
import {
  signUploadDemo,
  deleteObjectDemo,
} from "../controllers/mediaController.demo.js";

const router = Router();

router.post("/media/sign", signUploadDemo);

router.delete("/media/object", deleteObjectDemo);

export default router;
