import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
const DEMO_EMAIL = "ashishupadhyay7353@gmail.com";

const resendKey = Deno.env.get("RESEND_API_KEY");
console.log("RESEND_API_KEY exists:", !!resendKey);

if (!resendKey) {
  throw new Error("RESEND_API_KEY is missing in Supabase secrets");
}

const resend = new Resend(resendKey);



const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StatusNotificationRequest {
  applicantName: string;
  applicantEmail: string;
  newStatus: string;
  preferredCourse: string;
}

const getStatusMessage = (status: string, name: string, course: string) => {
  const statusMessages: Record<string, { subject: string; body: string }> = {
    reviewed: {
      subject: "Your Application is Under Review",
      body: `
        <h2>Hello ${name},</h2>
        <p>We're writing to let you know that your application for <strong>${course}</strong> is currently being reviewed by our admissions team.</p>
        <p>We will notify you once a decision has been made. Thank you for your patience!</p>
        <p>Best regards,<br>The Admissions Team</p>
      `,
    },
    accepted: {
      subject: "Congratulations! Your Application Has Been Accepted",
      body: `
        <h2>Dear ${name},</h2>
        <p>🎉 <strong>Congratulations!</strong> We are thrilled to inform you that your application for <strong>${course}</strong> has been <span style="color: #22c55e; font-weight: bold;">accepted</span>!</p>
        <p>Our team was impressed with your qualifications and we look forward to having you join our program.</p>
        <p>You will receive further instructions regarding the next steps shortly.</p>
        <p>Welcome aboard!<br>The Admissions Team</p>
      `,
    },
    rejected: {
      subject: "Update on Your Application",
      body: `
        <h2>Dear ${name},</h2>
        <p>Thank you for your interest in <strong>${course}</strong> and for taking the time to apply.</p>
        <p>After careful consideration, we regret to inform you that we are unable to offer you admission at this time.</p>
        <p>We encourage you to continue developing your skills and consider reapplying in the future.</p>
        <p>We wish you all the best in your future endeavors.</p>
        <p>Sincerely,<br>The Admissions Team</p>
      `,
    },
    pending: {
      subject: "Application Status Update",
      body: `
        <h2>Hello ${name},</h2>
        <p>Your application for <strong>${course}</strong> status has been updated to pending.</p>
        <p>We will review your application and get back to you soon.</p>
        <p>Best regards,<br>The Admissions Team</p>
      `,
    },
  };

  return statusMessages[status] || statusMessages.pending;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("Status notification function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
console.log("RAW BODY:", rawBody);

if (!rawBody) {
  throw new Error("Request body is empty");
}

const parsed: StatusNotificationRequest = JSON.parse(rawBody);

const { applicantName, applicantEmail, newStatus, preferredCourse } = parsed;

console.log("Parsed:", parsed);

    
    console.log(`Sending ${newStatus} notification to ${applicantEmail}`);

    const { subject, body } = getStatusMessage(newStatus, applicantName, preferredCourse);

    const emailResponse = await resend.emails.send({
      from: "Admissions <onboarding@resend.dev>",
      to: [DEMO_EMAIL],

      subject: subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">Application Update</h1>
            </div>
            <div class="content">
              ${body}
            </div>
            <div class="footer">
              <p>This is an automated message from our admissions system.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }  catch (error: any) {
  console.error("❌ Error sending status notification:", error);
  console.error("❌ Full error:", JSON.stringify(error, null, 2));

  return new Response(
    JSON.stringify({
      success: false,
      error: error?.message || "Unknown error",
    }),
    {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    }
  );
}

};

serve(handler);
