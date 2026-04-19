const Wallet = require("../models/Wallet.model");

/**
 * Get or create wallet for a user
 */
const getOrCreateWallet = async (userId) => {
  let wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    wallet = await Wallet.create({ userId, balance: 0, transactions: [] });
  }
  return wallet;
};

/**
 * Credit wallet
 */
const creditWallet = async (userId, amount, description = "Credit", referenceId = null) => {
  const wallet = await getOrCreateWallet(userId);
  wallet.balance = parseFloat((wallet.balance + amount).toFixed(2));
  wallet.transactions.push({
    type: "credit",
    amount,
    description,
    referenceId,
    balanceAfter: wallet.balance,
  });
  await wallet.save();
  return wallet;
};

/**
 * Debit wallet — throws if insufficient balance
 */
const debitWallet = async (userId, amount, description = "Debit", referenceId = null) => {
  const wallet = await getOrCreateWallet(userId);
  if (wallet.balance < amount) {
    throw new Error("Insufficient wallet balance");
  }
  wallet.balance = parseFloat((wallet.balance - amount).toFixed(2));
  wallet.transactions.push({
    type: "debit",
    amount,
    description,
    referenceId,
    balanceAfter: wallet.balance,
  });
  await wallet.save();
  return wallet;
};

module.exports = { getOrCreateWallet, creditWallet, debitWallet };