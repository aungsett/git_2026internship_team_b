Applicant Tracking System (ATS)

1. Project Overview

This project is a full-stack Applicant Tracking System (ATS) designed to streamline the recruitment process. Applicants can submit their details along with resumes, which are automatically processed to extract relevant information. The system stores this data in a database and provides an admin dashboard for managing applications and updating their status.

2. Features

2.1 Applicant Features
  - Submit personal and professional details
  - Upload resume (PDF format)
  - Automatic resume parsing and data extraction

2.2 Admin Features
  - Admin login functionality
  - View all submitted applications
  - Access detailed applicant information
  - Update application status

2.3 System Features
  - Resume text extraction from PDF files
  - Database integration using Supabase
  - Email notifications for status updates
  - Responsive and user-friendly interface

3. Tech Stack
 
3.1 Frontend
  - React (TypeScript)
  - Vite
  - Tailwind CSS

3.2 Backend
  - Supabase (Database and Serverless Functions)

3.3 Additional Tools
  - PDF parsing utilities
  - Email notification service

4. Application Flow

  - The user fills out the application form and uploads a resume.
  - The resume is sent to the backend for processing.
  - A serverless function extracts relevant data from the resume.
  - Extracted data is stored in the Supabase database.
  - The admin logs into the dashboard to view applications.
  - The admin updates the application status.
  - A notification email is sent to the applicant.


5. Setup Guide
   
5.1 Clone the Repository

   git clone https://github.com/aungsett/git_2026internship_team_b.git
   
   cd git_2026internship_team_b
   
5.2 Install Dependencies

   npm install
   
5.3 Run Locally

   npm run dev
