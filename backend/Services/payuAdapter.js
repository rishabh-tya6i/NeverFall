import crypto from "crypto";
import axios from "axios";

export default function createPayuAdapter({ key, salt }) {
  const baseUrl =
    process.env.PAYU_ENV === "test"
      ? "https://test.payu.in"
      : "https://secure.payu.in";

  return {
    name: "payu",

    async createOrder({
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      phone,
      surl,
      furl,
    }) {
      const data = {
        key,
        txnid,
        amount,
        productinfo,
        firstname,
        email,
        phone,
        surl,
        furl,
        service_provider: "payu_paisa",
      };
      const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${salt}`;
      const hash = crypto.createHash("sha512").update(hashString).digest("hex");

      return { ...data, hash, baseUrl };
    },

    verifyPayment({
      postedHash,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      status,
    }) {
      const reverseHash = `${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
      const calculated = crypto
        .createHash("sha512")
        .update(reverseHash)
        .digest("hex");
      return calculated === postedHash;
    },
  };
}
