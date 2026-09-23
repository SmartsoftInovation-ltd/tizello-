/**
 * Chat's person-scoped surface, mounted at `/api/v1/chat` from
 * `src/routes/index.js`.
 *
 * NOT workspace-scoped, for the notification bell's reason: a person may be in
 * five workspaces and wants one badge. The owner is `req.user.id` and there is
 * no id in the path to tamper with. No limiter — it is ambient, fetched on
 * every shell render, same as `/notifications`.
 *
 * See docs/api/chat.md §4
 */

import express from 'express';

import controller from './chat.controller.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { authGuard } from '../../shared/middlewares/auth.js';

const router = express.Router();

router.get('/unread', authGuard, asyncHandler(controller.unreadSummary));

export default router;
