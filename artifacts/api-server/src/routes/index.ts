import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import engineersRouter from "./engineers";
import ordersRouter from "./orders";
import bidsRouter from "./bids";
import reviewsRouter from "./reviews";
import chatRouter from "./chat";
import statsRouter from "./stats";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(engineersRouter);
router.use(ordersRouter);
router.use(bidsRouter);
router.use(reviewsRouter);
router.use(chatRouter);
router.use(statsRouter);
router.use(adminRouter);

export default router;
