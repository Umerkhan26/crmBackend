import { Router } from "express";
import {
  resolveBrandController,
  customerLoginController,
  customerProfileController,
  customerSalesController,
} from "../controllers/customerArea.controller";
import { verifyCustomerToken } from "../middleware/verifyCustomer.middleware";

const router = Router();

// Public — Customer Area portal (subdomain apps)
router.get("/resolve-brand", resolveBrandController);
router.post("/login", customerLoginController);

// Authenticated — customer JWT
router.get("/me", verifyCustomerToken, customerProfileController);
router.get("/my-sales", verifyCustomerToken, customerSalesController);

export default router;
