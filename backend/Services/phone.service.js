import request from "request";

export function sendSms(phone, otp) {
  return new Promise((resolve, reject) => {
    const options = {
      method: "GET",
      url: "https://console.authkey.io/request",
      qs: {
        authkey: process.env.MOBILE_SERVICE_SECRET,
        sms: `Your OTP is ${otp}. Please do not share it with anyone.`,
        mobile: phone,
        country_code: "91",
        sender: process.env.SENDER_ID || "AUTHKY",
      },
    };

    request(options, (error, response, body) => {
      if (error) {
        console.log(" SMS sending failed:", error);
        reject(error);
      } else {
        console.log(" SMS sent successfully:", body);
        resolve(body);
      }
    });
  });
}
