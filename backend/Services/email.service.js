import { Resend } from "resend";

const resend = new Resend(
  process.env.EMAIL_SERVICE_API_KEY || "re_gqkWstoN_LCZ16oHE72Bi724zrjRXnn7s"
);

export async function sendEmail(to, subject, html) {
  try {
    const email = await resend.emails.send({
      from: "nikhilsethin494@gmail.com",
      to,
      subject,
      html,
    });
    console.log("email status:", email, "\n", "resend:", resend);
    console.log("Email sent successfully:", email);
    return email;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}

// resend.emails.send({
//   from: "nikhilsethin494@gmail.com",
//   to: ``,
//   subject: "Welcome to NevrFall , Do not share OTP with anyone",
//   html: "<p>Congrats on sending your <strong>first email</strong>!</p>",
// });
