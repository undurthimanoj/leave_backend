import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import nodemailer from "nodemailer";
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// Set port - use environment variable or fallback with alternative
const PORT = process.env.PORT || 5000;

// Connect to MongoDB using environment variable for connection string
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://manojlovely679:dypJK1gca7wt4AQe@cluster0.j8r8s.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("MongoDB connection error:", err));

// Schema for leave applications
const LeaveSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  cell: { type: String, required: true }, // Added missing field from form
  course: { type: String, required: true },
  subject: { type: String, required: true },
  reason: { type: String, required: true },
  date: { type: Date, default: Date.now },
  status: { type: String, default: "Pending" },
});

const LeaveApplication = mongoose.model("LeaveApplication", LeaveSchema);

// Configure email with your Gmail credentials
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

// Create a transporter using gmail with App Password
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
});

// Verify transporter configuration
transporter.verify(function(error, success) {
  if (error) {
    console.error("Transporter verification failed:", error);
  } else {
    console.log("Server is ready to send emails");
  }
});

// Function to send notification emails
const sendNotificationEmail = async (application, status) => {
  try {
    const subjectPrefix = status === "Approved" ? "APPROVED" : "NOT APPROVED";
    const emailBody = status === "Approved" 
      ? `<p>Dear ${application.name},</p>
         <p>We are pleased to inform you that your leave application for "${application.subject}" has been approved.</p>
         <p>Details of your application:</p>
         <ul>
           <li>Course: ${application.course}</li>
           <li>Subject: ${application.subject}</li>
           <li>Reason: ${application.reason}</li>
           <li>Date Submitted: ${new Date(application.date).toLocaleDateString()}</li>
         </ul>
         <p>Thank you for using our application system.</p>
         <p>Regards,<br>Hostel Warden</p>`
      : `<p>Dear ${application.name},</p>
         <p>We regret to inform you that your leave application for "${application.subject}" has not been approved.</p>
         <p>Details of your application:</p>
         <ul>
           <li>Course: ${application.course}</li>
           <li>Subject: ${application.subject}</li>
           <li>Reason: ${application.reason}</li>
           <li>Date Submitted: ${new Date(application.date).toLocaleDateString()}</li>
         </ul>
         <p>If you have any questions regarding this decision, please contact the Hostel Warden.</p>
         <p>Regards,<br>Hostel Warden</p>`;
    
    const mailOptions = {
      from: EMAIL_USER,
      to: application.email,
      subject: `Leave Application ${subjectPrefix}: ${application.subject}`,
      html: emailBody
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.response);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
};

// API Routes
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
    res.status(500).json({ message: "Error fetching applications", error: error.message });
  }
});

app.post("/submit-application", async (req, res) => {
  try {
    console.log("Received form data:", req.body);
    
    // Validate required fields
    const { name, email, cell, course, subject, reason } = req.body;
    
    if (!name || !email || !cell || !course || !subject || !reason) {
      return res.status(400).json({ 
        message: "Missing required fields", 
        receivedData: req.body 
      });
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
    console.log("Application saved:", savedApplication);
    res.status(201).json({ 
      message: "Application submitted successfully",
      applicationId: savedApplication._id 
    });
  } catch (error) {
    console.error("Error submitting application:", error);
    // Send detailed error for debugging
    res.status(500).json({ 
      message: "Error submitting application", 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

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
      try {
        const emailSent = await sendNotificationEmail(application, status);
        res.json({ 
          message: "Status updated successfully", 
          updatedApplication: application,
          emailStatus: emailSent ? "Email notification sent" : "Failed to send email notification"
        });
      } catch (emailError) {
        res.json({ 
          message: "Status updated but email notification failed", 
          updatedApplication: application,
          emailError: emailError.message
        });
      }
    } else {
      res.json({ 
        message: "Status updated successfully", 
        updatedApplication: application,
        emailStatus: "No email notification needed"
      });
    }
  } catch (error) {
    res.status(500).json({ message: "Error updating status", error: error.message });
  }
});

// Start the server with error handling for port in use
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is busy, trying alternative port ${PORT + 1}...`);
    app.listen(PORT + 1, () => {
      console.log(`Server running on alternative port ${PORT + 1}`);
    });
  } else {
    console.error('Server error:', err);
  }
});