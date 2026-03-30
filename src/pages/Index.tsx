import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Upload, CheckCircle, User, Mail, Calendar, GraduationCap, Briefcase, BookOpen, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const formSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters").max(100, "Name must be less than 100 characters"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  email: z.string().email("Invalid email address").max(255, "Email must be less than 255 characters"),
  highestDegree: z.string().min(1, "Please select your highest degree"),
  yearsOfExperience: z.coerce.number().min(0, "Experience must be 0 or more").max(50, "Experience must be 50 or less"),
  preferredCourse: z.string().min(1, "Please select a course"),
  comments: z.string().max(1000, "Comments must be less than 1000 characters").optional(),
});

type FormData = z.infer<typeof formSchema>;

const degrees = [
  "High School Diploma",
  "Associate's Degree",
  "Bachelor's Degree",
  "Master's Degree",
  "Doctorate (PhD)",
  "Other",
];

const courses = [
  "JLPT N5 Preparation (WEEKDAY)",
  "JLPT N5 Preparation (WEEKEND)",
  "JLPT N4 Preparation (WEEKDAY)",
  "JLPT N4 Preparation (WEEKEND)",
  "JLPT N3 Preparation (WEEKDAY)",
  "JLPT N3 Preparation (WEEKEND)",
  "JLPT N2 Preparation (WEEKDAY)",
  "JLPT N2 Preparation (WEEKEND)",
  "JLPT N1 Preparation (WEEKDAY)",
  "JLPT N1 Preparation (WEEKEND)",
  "Business Japanese (WEEKDAY)",
  "Business Japanese (WEEKEND)",
  "Conversational Japanese (WEEKDAY)",
  "Conversational Japanese (WEEKEND)",
  "Japanese for Travel (WEEKDAY)",
  "Japanese for Travel (WEEKEND)",
];

const Index = () => {
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      dateOfBirth: "",
      email: "",
      highestDegree: "",
      yearsOfExperience: 0,
      preferredCourse: "",
      comments: "",
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast.error("Please upload a PDF file only");
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error("File size must be less than 5MB");
        return;
      }
      setCvFile(file);
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!cvFile) {
      toast.error("Please upload your CV");
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload CV to storage
      const fileName = `${Date.now()}-${cvFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("cvs")
        .upload(fileName, cvFile);

      if (uploadError) throw uploadError;

      // Insert applicant data
      const { data: applicantData, error: insertError } = await supabase.from("applicants").insert({
        full_name: data.fullName,
        date_of_birth: data.dateOfBirth,
        email: data.email,
        highest_degree: data.highestDegree,
        years_of_experience: data.yearsOfExperience,
        preferred_course: data.preferredCourse,
        cv_file_path: fileName,
        comments: data.comments || null,
      }).select("id").single();

      if (insertError) throw insertError;

      // Trigger CV parsing in the background
      if (applicantData?.id) {
        supabase.functions.invoke("parse-cv", {
          body: {
            applicantId: applicantData.id,
            cvFilePath: fileName,
          },
        }).catch((error) => {
          console.error("CV parsing error (non-blocking):", error);
        });
      }

      setIsSuccess(true);
      toast.success("Application submitted successfully!");
    } catch (error: any) {
      console.error("Submission error:", error);
      toast.error(error.message || "Failed to submit application");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card-elevated p-8 md:p-12 max-w-lg w-full text-center animate-scale-in">
          <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-success" />
          </div>
          <h1 className="font-display text-3xl font-bold mb-4">Application Submitted!</h1>
          <p className="text-muted-foreground mb-8">
            Thank you for applying. We have received your application and will review it shortly. 
            You will be contacted via email regarding the next steps.
          </p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Submit Another Application
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg gradient-hero flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-xl">JapanLearn ATS</span>
          </div>
          <Link to="/admin/login">
            <Button variant="ghost" size="sm">Admin Login</Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 md:py-24">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center mb-12 animate-fade-in">
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-6 tracking-tight">
              Start Your Japanese Learning Journey
            </h1>
            <p className="text-lg text-muted-foreground">
              Apply now to join our comprehensive Japanese language courses. 
              Fill out the form below and upload your CV to get started.
            </p>
          </div>

          {/* Application Form */}
          <div className="max-w-2xl mx-auto">
            <div className="card-elevated p-6 md:p-10 animate-slide-up">
              <h2 className="font-display text-2xl font-semibold mb-8">Application Form</h2>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Full Name */}
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          Full Name
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Enter your full name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Date of Birth */}
                  <FormField
                    control={form.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Date of Birth
                        </FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Email */}
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          Email Address
                        </FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="your.email@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Highest Degree */}
                  <FormField
                    control={form.control}
                    name="highestDegree"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <GraduationCap className="w-4 h-4" />
                          Highest Degree
                        </FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select your highest degree" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {degrees.map((degree) => (
                              <SelectItem key={degree} value={degree}>
                                {degree}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Years of Experience */}
                  <FormField
                    control={form.control}
                    name="yearsOfExperience"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Briefcase className="w-4 h-4" />
                          Years of Experience
                        </FormLabel>
                        <FormControl>
                          <Input type="number" min={0} max={50} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Preferred Course */}
                  <FormField
                    control={form.control}
                    name="preferredCourse"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4" />
                          Preferred Japanese Course
                        </FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a course" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {courses.map((course) => (
                              <SelectItem key={course} value={course}>
                                {course}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* CV Upload */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      CV Upload (PDF only)
                    </label>
                    <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handleFileChange}
                        className="hidden"
                        id="cv-upload"
                      />
                      <label htmlFor="cv-upload" className="cursor-pointer">
                        {cvFile ? (
                          <div className="flex items-center justify-center gap-2 text-success">
                            <CheckCircle className="w-5 h-5" />
                            <span>{cvFile.name}</span>
                          </div>
                        ) : (
                          <div className="text-muted-foreground">
                            <Upload className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>Click to upload your CV</p>
                            <p className="text-xs mt-1">PDF only, max 5MB</p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  {/* Comments */}
                  <FormField
                    control={form.control}
                    name="comments"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4" />
                          Comments (Optional)
                        </FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Any additional information you'd like to share..."
                            rows={4}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    variant="hero" 
                    size="lg" 
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Submitting..." : "Submit Application"}
                  </Button>
                </form>
              </Form>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
