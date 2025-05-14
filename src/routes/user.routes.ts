import express from "express";
import {
  deleteUserController,
  getUser,
  getUsers,
  login,
  registerUser,
  updateUserController,
} from "../controllers/user.controller";

const router = express.Router();

router.post("/registerr", registerUser);

router.post("/login", login); // Added login route

router.get("/getAllUsers", getUsers);

router.get("/getUserById/:id", getUser);

router.put("/updateUserById/:id", updateUserController);

router.delete("/deleteUserById/:id", deleteUserController);

export default router;
