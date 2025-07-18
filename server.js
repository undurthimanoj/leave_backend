import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// PORT
const PORT = process.env.PORT || 5000;

// MongoDB
const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://manoj:manoj@cluster0.j8r8s.mongodb.net/leaveDB?retryWrites=true&w=majority&appName=Cluster0";

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Schema
const LeaveSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  cell: { type: String, required: true },
  course: { type: String, required: true },
  subject: { type: String, required: true },
  reason: { type: String, required: true },
  date: { type: Date, default: Date.now },
  status: { type: String, default: "Pending" },
});

const LeaveApplication = mongoose.model(
  "LeaveApplication",
  LeaveSchema,
  "leaveapplications"
);

// Email setup
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Transporter verification failed:", error);
  } else {
    console.log("📧 Server is ready to send emails");
  }
});

// ✅ Professional email function with logo
const sendNotificationEmail = async (application, status) => {
  try {
    const subjectPrefix = status === "Approved" ? "APPROVED" : "NOT APPROVED";

    const emailBody = `
      <div style="font-family: Arial, sans-serif; background-color: #f6f8fa; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.15);">
          <div style="background-color: #0b5ed7; padding: 20px; text-align: center;">
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Emblem_of_Andhra_Pradesh.svg/1200px-Emblem_of_Andhra_Pradesh.svg.png" alt="Logo" style="height: 80px; margin-bottom: 10px;" />
            <h1 style="color: #ffffff; margin: 0; font-size: 22px;">Government of Andhra Pradesh</h1>
          </div>
          <div style="padding: 30px;">
            <h2 style="color: #333333; font-size: 20px; margin-top:0;">Leave Application ${subjectPrefix}</h2>
            <p style="color: #555555; font-size: 16px;">Dear <strong>${application.name}</strong>,</p>
            ${
              status === "Approved"
                ? `<p style="color: #28a745; font-size: 16px;">✅ We are pleased to inform you that your leave application for <strong>${application.subject}</strong> has been approved.</p>`
                : `<p style="color: #dc3545; font-size: 16px;">❌ We regret to inform you that your leave application for <strong>${application.subject}</strong> has not been approved.</p>`
            }
            <div style="background-color: #f0f0f0; padding: 15px; border-radius: 6px; margin-top: 20px;">
              <p style="margin: 4px 0; font-size: 15px; color: #333;"><strong>Course:</strong> ${application.course}</p>
              <p style="margin: 4px 0; font-size: 15px; color: #333;"><strong>Subject:</strong> ${application.subject}</p>
              <p style="margin: 4px 0; font-size: 15px; color: #333;"><strong>Reason:</strong> ${application.reason}</p>
              <p style="margin: 4px 0; font-size: 15px; color: #333;"><strong>Date Submitted:</strong> ${new Date(
                application.date
              ).toLocaleDateString()}</p>
            </div>
            <p style="margin-top: 25px; font-size: 15px; color: #555;">
              If you have any questions regarding this decision, please contact the hostel warden.
            </p>
            <p style="margin-top: 30px; font-size: 14px; color: #888;">Regards,<br><strong>Hostel Warden</strong></p>
          </div>
          <div style="background-color: #f1f1f1; text-align: center; padding: 15px;">
            <p style="margin: 0; font-size: 13px; color: #777;">© ${new Date().getFullYear()} Government of Andhra Pradesh. All rights reserved.</p>
          </div>
        </div>
      </div>
    `;

    const mailOptions = {
      from: EMAIL_USER,
      to: application.email,
      subject: `Leave Application ${subjectPrefix}: ${application.subject}`,
      html: emailBody,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully:", info.response);
    return true;
  } catch (error) {
    console.error("❌ Error sending email:", error);
    return false;
  }
};

// Routes
app.get("/", (req, res) => {
  res.json({ message: "Welcome to the Leave Application API!" });
});

app.get("/health", (req, res) => {
  res.json({ status: "Server is healthy" });
});

app.get("/api/leave-applications", async (req, res) => {
  try {
    const applications = await LeaveApplication.find();
    res.json(applications);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching applications", error: error.message });
  }
});

app.post("/submit-application", async (req, res) => {
  try {
    console.log("Received form data:", req.body);
    const { name, email, cell, course, subject, reason } = req.body;
    if (!name || !email || !cell || !course || !subject || !reason) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    const newApplication = new LeaveApplication({
      name,
      email,
      cell,
      course,
      subject,
      reason,
    });
    const savedApplication = await newApplication.save();
    console.log("✅ Application saved:", savedApplication);
    res.status(201).json({
      message: "Application submitted successfully",
      applicationId: savedApplication._id,
    });
  } catch (error) {
    console.error("❌ Error submitting application:", error);
    res.status(500).json({ message: "Error submitting application", error: error.message });
  }
});

app.patch("/api/leave-applications/:id", async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ message: "Status is required" });

    const application = await LeaveApplication.findById(req.params.id);
    if (!application) return res.status(404).json({ message: "Application not found" });

    const oldStatus = application.status;
    application.status = status;
    await application.save();

    if ((status === "Approved" || status === "Not Approved") && oldStatus !== status) {
      const emailSent = await sendNotificationEmail(application, status);
      res.json({
        message: "Status updated successfully",
        updatedApplication: application,
        emailStatus: emailSent
          ? "Email notification sent"
          : "Failed to send email notification",
      });
    } else {
      res.json({
        message: "Status updated successfully",
        updatedApplication: application,
        emailStatus: "No email notification needed",
      });
    }
  } catch (error) {
    res.status(500).json({ message: "Error updating status", error: error.message });
  }
});

// Start server
const server = app
  .listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  })
  .on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log(`Port ${PORT} is busy, trying alternative port ${PORT + 1}...`);
      app.listen(PORT + 1, () => {
        console.log(`🚀 Server running on alternative port ${PORT + 1}`);
      });
    } else {
      console.error("❌ Server error:", err);
    }
  });
