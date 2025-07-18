import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();  

const app = express();
app.use(express.json());
app.use(cors());

// Port and MongoDB URI
const PORT = process.env.PORT || 5000;
const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://manoj:manoj@cluster0.j8r8s.mongodb.net/leaveDB?retryWrites=true&w=majority&appName=Cluster0";

// MongoDB connection
mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Schema and model
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

// Nodemailer setup
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

transporter.verify(function (error, success) {
  if (error) {
    console.error("❌ Transporter verification failed:", error);
  } else {
    console.log("✅ Server ready to send emails");
  }
});

const sendNotificationEmail = async (application, status) => {
  try {
    const subjectPrefix = status === "Approved" ? "APPROVED" : "NOT APPROVED";
    const emailBody =
      status === "Approved"
        ? `<p>Dear ${application.name},</p>
           <p>Your leave application for "${application.subject}" has been approved.</p>
           <ul>
             <li>Course: ${application.course}</li>
             <li>Subject: ${application.subject}</li>
             <li>Reason: ${application.reason}</li>
             <li>Date Submitted: ${new Date(application.date).toLocaleDateString()}</li>
           </ul>
           <p>Regards,<br>Hostel Warden</p>`
        : `<p>Dear ${application.name},</p>
           <p>Your leave application for "${application.subject}" has not been approved.</p>
           <ul>
             <li>Course: ${application.course}</li>
             <li>Subject: ${application.subject}</li>
             <li>Reason: ${application.reason}</li>
             <li>Date Submitted: ${new Date(application.date).toLocaleDateString()}</li>
           </ul>
           <p>Regards,<br>Hostel Warden</p>`;

    const mailOptions = {
      from: EMAIL_USER,
      to: application.email,
      subject: `Leave Application ${subjectPrefix}: ${application.subject}`,
      html: emailBody,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("📧 Email sent:", info.response);
    return true;
  } catch (error) {
    console.error("❌ Error sending email:", error);
    return false;
  }
};

// ✅ Routes
app.get("/", (req, res) => {
  res.json({ message: "Welcome to the Leave Application API!" });
});

app.get("/health", (req, res) => {
  res.json({ status: "Server is healthy" });
});

// Get all applications
app.get("/api/leave-applications", async (req, res) => {
  try {
    const applications = await LeaveApplication.find();
    res.json(applications);
  } catch (error) {
    res.status(500).json({ message: "Error fetching applications", error: error.message });
  }
});

// Submit new application
app.post("/submit-application", async (req, res) => {
  try {
    const { name, email, cell, course, subject, reason } = req.body;
    if (!name || !email || !cell || !course || !subject || !reason) {
      return res.status(400).json({ message: "Missing required fields", receivedData: req.body });
    }
    const newApplication = new LeaveApplication({ name, email, cell, course, subject, reason });
    const savedApplication = await newApplication.save();
    res.status(201).json({ message: "Application submitted successfully", applicationId: savedApplication._id });
  } catch (error) {
    res.status(500).json({ message: "Error submitting application", error: error.message });
  }
});

// Update status (approve/not approve)
app.patch("/api/leave-applications/:id", async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const application = await LeaveApplication.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    const oldStatus = application.status;
    application.status = status;
    await application.save();

    if ((status === "Approved" || status === "Not Approved") && oldStatus !== status) {
      const emailSent = await sendNotificationEmail(application, status);
      res.json({ message: "Status updated successfully", updatedApplication: application, emailStatus: emailSent ? "Email notification sent" : "Failed to send email notification" });
    } else {
      res.json({ message: "Status updated successfully", updatedApplication: application, emailStatus: "No email notification needed" });
    }
  } catch (error) {
    res.status(500).json({ message: "Error updating status", error: error.message });
  }
});

// ✅ DELETE route for admin
app.delete("/api/leave-applications/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log("🗑️ Delete request received for ID:", id);

    const deletedApp = await LeaveApplication.findByIdAndDelete(id);
    if (!deletedApp) {
      return res.status(404).json({ message: "Application not found" });
    }

    console.log("✅ Application deleted:", deletedApp._id);
    res.json({ message: "Application deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting application:", error);
    res.status(500).json({ message: "Error deleting application", error: error.message });
  }
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
}).on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.log(`⚠️ Port ${PORT} is busy, trying alternative port ${PORT + 1}...`);
    app.listen(PORT + 1, () => {
      console.log(`🚀 Server running on alternative port ${PORT + 1}`);
    });
  } else {
    console.error("❌ Server error:", err);
  }
});
