// services/wallet.service.js
import WalletTransaction from "../Models/WalletTransaction.js";
import User from "../Models/User.js";

/**
 * Hold (deduct) wallet amount immediately and create a pending WalletTransaction.
 * Returns the walletTx doc.
 */
export async function holdWalletAmount({ userId, amount, refId, session }) {
  if (!amount || amount <= 0) return null;
  const user = await User.findById(userId).session(session);
  const available = user.walletBalance || 0;
  const toHold = Math.min(available, amount);
  if (toHold <= 0) return null;

  // create pending debit tx and deduct immediate balance
  const [wt] = await WalletTransaction.create(
    [
      {
        user: userId,
        type: "debit",
        amount: toHold,
        currency: "INR",
        status: "pending", // pending until exchange completes
        source: "exchange_hold",
        refId,
        meta: { note: "Held for exchange payment" },
      },
    ],
    { session }
  );

  user.walletBalance = available - toHold;
  await user.save({ session });

  return wt;
}

/**
 * Release held wallet tx (refund) - used when exchange cancelled or QC failed.
 */
export async function releaseHeldWalletTx({ walletTxId, session }) {
  if (!walletTxId) return null;
  const wt = await WalletTransaction.findById(walletTxId).session(session);
  if (!wt) return null;
  if (wt.status !== "pending") return wt;

  // mark refund (we'll create a credit tx)
  wt.status = "rejected";
  await wt.save({ session });

  // credit back to user
  const [credit] = await WalletTransaction.create(
    [
      {
        user: wt.user,
        type: "credit",
        amount: wt.amount,
        currency: wt.currency,
        status: "available",
        source: "exchange_hold_refund",
        refId: wt.refId,
        meta: { note: "Refund held wallet for cancelled exchange" },
      },
    ],
    { session }
  );

  // update user balance
  const user = await User.findById(wt.user).session(session);
  user.walletBalance = (user.walletBalance || 0) + wt.amount;
  await user.save({ session });

  return credit;
}

/**
 * Finalize held wallet tx: mark pending -> available/used
 */
export async function finalizeHeldWalletTx({ walletTxId, session }) {
  if (!walletTxId) return null;
  const wt = await WalletTransaction.findById(walletTxId).session(session);
  if (!wt) return null;
  if (wt.status !== "pending") return wt;
  wt.status = "Return-Order"; // or "completed" depending on your conventions
  await wt.save({ session });
  return wt;
}
